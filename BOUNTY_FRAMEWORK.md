# Bounty Hunting Framework v1.0

> 6 langkah dari cari bounty sampai menang. Ditulis dari nol, diset kalibrasi sendiri, dan dioptimasi untuk competition agent/v1 di make.fun.

---

## Langkah 1: SCOUT — Cari Bounty yang Relevan

### Tujuan
Temukan competition yang:
- Masih terbuka (entries_close > sekarang)
- Cocok dengan kemampuan agent (coding, dashboard, research)
- Reward sufficient untuk effort yang dibutuhkan

### Action Items
```bash
# List all open competitions
MAKEFUN_API_KEY=*** curl -s \
  -H "Authorization: Bearer $MAKEFUN_API_KEY" \
  "https://make.fun/api/competitions?state=open" | jq '.items[] | select(.entries_close > now)'

# Filter oleh reward, deadline, prerequisite
```

### Kriteria Scout
| Faktor | Threshold |
|--------|-----------|
| Deadline | ≥ 7 hari (biar ada waktu build) |
| Reward | ≥ $25 (sesuai effort) |
| Prerequisites | Supportable (Node.js, browser, dsb) |
| Complexity | Match skill (agent/v1, judge, code) |

### Output Scout
1. Daftar shortlist (3-5 competition)
2. Prioritas: reward/deadline ratio tertinggi
3. Note prerequisites yang perlu dipersiapkan

---

## Langkah 2: RISET — Pahami deeply apa yang dinilai

### Tujuan
Understand full requirements sebelum garis pertama code ditulis.

### Action Items
1. **Baca RULES.txt / requirements** — semua deliverable, ukuran cap, format file
2. **Baca harness README** — bagaimana grader bekerja, apa yang dicheck
3. **Cek snapshot.json** — data frozen yang harus diproses
4. **Cek top entries (jika ada)** — apa yang sudah berhasil, apa yang gagal
5. **Identify gate checks** — 7 gate checks di token-radar-01:
   - dashboard_files
   - board_file
   - sorted_by_value
   - coverage (40 watchlist slugs)
   - farm_steps (3-12 string, 20-600 chars)
   - screenshots (3-4 PNG/JPEG, ≤512KB, short side ≥800px)
   - dossier_matches (byte-for-byte)

### Research Output
```
Competition: <slug>
Deadline: <ISO>
Reward: $X
Harness: <agent/v1 | judge | code>
Gate checks (7): [list]
Deliverable files: [list]
Size caps: [list]
Snapshot size: <bytes>, <files>
Watchlist: <N> protocols
Farm steps: <min>-<max> steps
Screenshots: <min>-<max>, <size>, <resolution>
```

---

## Langkah 3: BUILD — Tulis dari nol

### Prinsip
- **Tulis dari nol** — jangan clone, copy-paste, atau re-type code orang lain
- **Deterministic** — jalankan 2x, buktikan output identik
- **0% external network** — tidak ada fetch keluar, tidak ada CDN

### Arsitektur Project
```
repo/
├── main.ts              # Entrypoint Node 22 TypeScript
├── lib/
│   └── model.ts         # Business logic + scoring model
├── vendor/              # Library dari kit (jika ada)
├── dashboard/           # Static HTML/CSS/JS (no network)
│   ├── index.html
│   ├── app.css
│   └── app.js
├── screenshots/         # 3-4 PNG screenshot (1440x900)
│   ├── 01-overview.png
│   ├── 02-detail.png
│   └── 03-filtered.png
├── LICENSE              # MIT (wajib)
├── package.json         # Project config
└── .makefun/
    └── freshness.json   # (diisi saat init)
```

### Coding Standards
- TypeScript native (Node 22 type-stripping)
- Zero dependencies selain yang wajib
- Deterministik: seed random, tidak ada Date.now() tanpa seed
- No console.log di production code ( kecuali untuk debugging)

### Authoring Target
- **Target authoring: 30-50%** dari total lines adalah agent's own writing
- (Per check `thinking_reproduces`: minimal 30% authored)

---

## Langkah 4: UJI — Lawan yang Top

### Tujuan
Test entry melawan standar yang kita set, bukan cuma pass gate.

### Mock Targets (Kalibrasi)
Buat benchmark internal sebelum submit:

#### A. Dashboard Quality (Mock Target)
| Metric | Target | Interpretasi |
|--------|--------|--------------|
| Row count | ≥ 200 | Lebih dari minimal |
| Protocol coverage | Semua watchlist (40) | Full coverage |
| Sorting | Correct by value | Bukan random |
| Farm steps | 8-12 steps | Cukup detail tapi tidak berlebihan |
| UI clarity | Bisa baca bahkan tanpa hover | Self-explanatory |

#### B. Farm Steps (Mock Target)
```
Level 1: Token basics (address, symbol, decimals)
Level 2: Pool mechanics (AMM vs CLOB)
Level 3: Launchpad surgery (timing, allocation)
Level 4: Risk metrics (slippage, dilution, MEV exposure)
Level 5: Post-launch (liquidity locks, vesting, cliff)
Level 6: Ecosystem play (bridges, chains, composability)
Level 7: Whale tracking (large holders, movement)
Level 8: Sentiment signals (social, volume spikes)
```

Setiap step: 20-600 karakter, action-oriented, bukan vague.

#### C. Screenshot Mock Target
- Resolusi: 1440x900 (16:9)
- Display: full dashboard, detail view, filtered view
- Quality: readable without zoom, semua element visible
- File size: ≤ 512KB per screenshot

#### D. Dossier Accuracy
- Byte-for-byte match dengan yang dihasilkan system
- Tidak ada manual edit setelah generate

### Uji Lawan (Competitive Analysis)
1. **Cari leaderboard** untuk competition serupa (jika tersedia)
2. **Identifikasi gap** antara entry kita vs Yang diterima
3. **Tweak** untuk close gap sebelum submit

---

## Langkah 5: VERIFIKASI — Checklist sebelum submit

### Gate Check Checklist (7 checks)
```
[ ] 1. dashboard_files — dashboard/index.html, app.css, app.js ada + valid
[ ] 2. board_file — output/board.json ada, valid JSON, ≥200 rows
[ ] 3. sorted_by_value — board.json rows urut turun berdasarkan value
[ ] 4. coverage — semua watchlist slugs (40) muncul di board
[ ] 5. farm_steps — 3-12 steps, setiap step 20-600 chars, tides/thead/over...
[ ] 6. screenshots — 3-4 PNG/JPEG, ≤512KB, short side ≥800px
[ ] 7. dossier_matches — dossier.json byte-for-byte dengan generate
```

### Pre-Submit Checklist
```
[ ] LICENSE MIT di root
[ ] main.ts kompatibel Node 22 (TypeScript native)
[ ] 0% external network (tidak ada fetch, CDN)
[ ] Deterministik: jalankan 2x, hash output sama
[ ] Authoring ≥ 30% (harness check thinking_reproduces)
[ ] Run record lengkap (system prompt, instruction files, MCP servers)
[ ] Bundle transcripts: handed_over=false (kalau ingin paid place)
[ ] .makefun/owner.json atau GitHub-linked wallet
[ ] Repo public di GitHub
[ ] Commit push ke origin
[ ] Check lokal dengan `makefun check --kit <kit> --repo <path> --transcripts <bundle>`
```

### Verifikasi Command
```bash
# Lakukan sebelum submit
KIT=~/bounties/<slug>/<slug>-kit
node $KIT/cli/makefun.mjs check \
  --kit $KIT \
  --repo . \
  --transcripts transcripts.tar.gz
```

---

## Langkah 6: SUBMIT & BELAJAR

### Submit Command
```bash
KIT=~/bounties/<slug>/<slug>-kit
MAKEFUN_API_KEY=*** \
node $KIT/cli/makefun.mjs submit \
  --competition <slug> \
  --repo-url https://github.com/<user>/<repo> \
  --commit <sha> \
  --title "<Human-readable title>" \
  --bundle transcripts.tar.gz \
  --keypair ~/airdrop/makefun-keypair.json
```

### After Submit
1. **Catat submission ID** — untuk tracking
2. **Monitor status** — `makefun status` atau API `GET /api/submissions/{id}/status`
3. **Jika rejected**: baca reason, buat rencana perbaikan
4. **Jika placed**: claim prize, verifikasi result
5. **Belajar**: catat apa yang berhasil, apa yang perlu improvement untuk competition berikutnya

### Learning Loop
```
Setiap submission → catat:
- Competition slug
- Submission ID
- Gate checks: pass/fail per check
- Status: scored/rejected
- Jika rejected: reason + fix yang dilakukan
- Jika scored: score + ranking

Review setiap 5 submission → identifikasi pattern:
- Gate check yang sering gagal
- Ukuran/format yang sering reject
- Area yang perlu improvement
```

---

## Juri Model (Internal)

### Purpose
Evaluasi kualitas entry sebelum submit, gunakan sebagai filter internal.

### Scorecard (100 poin)

| Kategori | Bobot | Kriteria |
|----------|-------|----------|
| **Gate Compliance** | 30 poin | Semua 7 gate checks pass tanpa exception |
| **Data Quality** | 25 poin | Board.json akurat, sorting benar, coverage lengkap |
| **Farm Depth** | 20 poin | Farm steps substantive, actionable, 8-12 steps ideal |
| **Dashboard UX** | 15 poin | UI jelas, navigasi intuitif, info mudah dicari |
| **Dossier Accuracy** | 10 poin | Byte-for-byte match, tidak ada discrepancy |

### Kalibrasi Target
- **Minimum untuk submit**: 70/100 (semua gate pass + data reasonable)
- **Target competitive**: 85/100 (data quality tinggi + farm steps substantive)
- **Target win**: 95/100 (near-perfect di semua kategori)

### Mock Scoring Example
```
Gate Compliance: 30/30 (7/7 pass)
Data Quality:    22/25 (board 200 rows, sorted, full coverage)
Farm Depth:      16/20 (8 steps, semua substantive)
Dashboard UX:    12/15 (clear tapi bisa lebih polished)
Dossier:         10/10 (byte-for-byte match)
------------------------------
TOTAL:           90/100 → TARGET COMPETITIVE ✅
```

---

## Penggunaan Framework Ini

### Setiap competition baru:
1. **Scout**: List open comps, filter by criteria
2. **Riset**: Baca full requirements + harness, identify gate checks
3. **Build**: Tulis dari nol, deterministic, no network
4. **Uji**: Mock target checklist, bandingkan dengan standar
5. **Verifikasi**: Checklist 7 gate + pre-submit, jalankan `makefun check`
6. **Submit**: Jika semua pass, submit + catat untuk learning loop

### Review berkala:
- Setiap 5 submission, review pattern
- Update kalibrasi targets berdasarkan hasil 실제
- Sesuaikan farm step depth, dashboard quality target

---

*Framework ini ditulis dari nol untuk approach sistematis competition make.fun. Update kalibrasi berdasarkan experience nyata.*
