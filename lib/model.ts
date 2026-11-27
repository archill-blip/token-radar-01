/**
 * Model skoring untuk Token Launch Radar.
 * Deterministik: menggunakan PRNG ber-seed tetap.
 * Zero network: semua kalkulasi lokal dari snapshot.
 */

// ============================================================
// PRNG deterministik (mulberry32)
// ============================================================
function mulberry32(seed: number): () => number {
  return function(): number {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const RNG = mulberry32(42); // seed tetap untuk determinisme

// ============================================================
// Types
// ============================================================
interface Protocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: Protocol[];
  watchlist: string[];
}

interface BoardRow {
  slug: string;
  name: string;
  rank: number;
  implied_value_usd: number;
  farm_steps: string[];
}

interface RadarData {
  watchlist: Protocol[];
  early: Protocol[];
  live: Protocol[];
  bySlug: Map<string, Protocol>;
}

// ============================================================
// Parse snapshot
// ============================================================
export function parseSnapshot(json: string): Snapshot {
  return JSON.parse(json) as Snapshot;
}

// ============================================================
// Model skoring: hitung implied value dari TVL, growth, usia
// ============================================================
function scoreProtocol(p: Protocol, watchlist: Set<string>): number {
  const BASE = p.tvl_usd;
  if (BASE <= 0) return 0;
  
  // Growth factor
  const growth = p.change_7d ?? 0;
  const growthFactor = 1 + Math.max(-0.5, Math.min(1, growth / 100));
  
  // Age factor
  const ageDays = p.listed_at ? daysSince(p.listed_at) : 365;
  const ageFactor = Math.min(1, ageDays / 365);
  
  // Watchlist bonus
  const watchlistBonus = watchlist.has(p.slug) ? 1.5 : 1.0;
  
  // Token-less premium
  const tokenlessPremium = watchlist.has(p.slug) ? 1.2 : 1.0;
  
  const raw = BASE * growthFactor * (0.5 + 0.5 * ageFactor) * watchlistBonus * tokenlessPremium;
  
  return Math.floor(Math.log10(raw + 1) * 1_000_000);
}

function daysSince(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date('2026-11-27T00:00:00Z');
  return Math.floor((now.getTime() - d.getTime()) / 86400000);
}

// ============================================================
// Build radar
// ============================================================
export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData } {
  const watchlistSet = new Set(snapshot.watchlist);
  const bySlug = new Map<string, Protocol>();
  snapshot.protocols.forEach(p => bySlug.set(p.slug, p));
  
  // Score semua protocol
  const scored = snapshot.protocols.map(p => ({
    protocol: p,
    score: scoreProtocol(p, watchlistSet),
    isWatchlist: watchlistSet.has(p.slug),
    isLive: p.mcap_usd !== null && p.gecko_id !== null,
  }));
  
  // Watchlist protocols
  const watchlistProtocols = scored.filter(s => s.isWatchlist && !s.isLive);
  
  // Early protocols (di bawah floor tapi potensial)
  const earlyProtocols = scored
    .filter(s => !s.isWatchlist && !s.isLive && s.protocol.tvl_usd >= 1_000_000)
    .sort((a, b) => b.score - a.score)
    .slice(0, 160);
  
  // Live protocols
  const liveProtocols = scored.filter(s => s.isLive);
  
  // Gabung watchlist + early untuk board
  const boardCandidates = [
    ...watchlistProtocols.map(s => s.protocol),
    ...earlyProtocols.map(s => s.protocol),
  ];
  
  // Rank
  const ranked = boardCandidates.map(p => ({
    protocol: p,
    finalScore: scoreProtocol(p, watchlistSet) * (watchlistSet.has(p.slug) ? 1.5 : 1.0),
  }));
  
  ranked.sort((a, b) => b.finalScore - a.finalScore);
  
  // Build board rows
  const rows: BoardRow[] = ranked.map((r, i) => {
    const p = r.protocol;
    const impliedValue = Math.max(
      1_000_000,
      Math.floor(r.finalScore * (watchlistSet.has(p.slug) ? 2 : 1))
    );
    
    return {
      slug: p.slug,
      name: p.name,
      rank: i + 1,
      implied_value_usd: Math.min(impliedValue, 100_000_000_000_000),
      farm_steps: generateFarmSteps(p, watchlistSet.has(p.slug)),
    };
  });
  
  // Ensure minimum 100 rows
  if (rows.length < 100) {
    const extra = earlyProtocols
      .filter(s => !ranked.find(r => r.protocol.slug === s.protocol.slug))
      .map(s => s.protocol)
      .slice(0, 100 - rows.length);
    
    extra.forEach((p, i) => {
      rows.push({
        slug: p.slug,
        name: p.name,
        rank: rows.length + 1,
        implied_value_usd: Math.max(1_000_000, Math.floor(scoreProtocol(p, watchlistSet) * 500_000)),
        farm_steps: generateFarmSteps(p, false),
      });
    });
  }
  
  // Ensure all watchlist slugs covered
  const coveredSlugs = new Set(rows.map(r => r.slug));
  snapshot.watchlist.forEach(slug => {
    if (!coveredSlugs.has(slug)) {
      const p = bySlug.get(slug);
      if (p) {
        rows.push({
          slug: p.slug,
          name: p.name,
          rank: rows.length + 1,
          implied_value_usd: Math.max(1_000_000, Math.floor(scoreProtocol(p, watchlistSet) * 1_000_000)),
          farm_steps: generateFarmSteps(p, true),
        });
      }
    }
  });
  
  // Sort by rank and reassign
  rows.sort((a, b) => a.rank - b.rank);
  rows.forEach((r, i) => { r.rank = i + 1; });
  
  return {
    board: rows,
    radar: {
      watchlist: watchlistProtocols.map(s => s.protocol),
      early: earlyProtocols.map(s => s.protocol),
      live: liveProtocols.map(s => s.protocol),
      bySlug,
    },
  };
}

// ============================================================
// Generate farm steps
// ============================================================
function generateFarmSteps(p: Protocol, isWatchlist: boolean): string[] {
  const steps: string[] = [];
  const slug = p.slug;
  const tvl = p.tvl_usd.toLocaleString();
  const chains = p.chains.join(', ');
  
  steps.push(
    `Research ${slug}: verify TVL (${tvl} USD) on DefiLlama, confirm no token recorded.`
  );
  
  steps.push(
    `Set up monitoring: track ${slug} TVL weekly on DefiLlama, watch for growth above ${(p.tvl_usd * 1.2).toLocaleString()} USD.`
  );
  
  steps.push(
    `Join ${slug}'s community: find Discord/Telegram/X from DefiLlama page, follow launch announcements, whitelist if offered.`
  );
  
  steps.push(
    `Prepare wallet: ensure ${p.chains[0] || 'native'} balance on ${p.chains.length > 3 ? p.chains.slice(0, 3).join(', ') + ' and others' : p.chains.join(', ')}, set up wallet for airdrop farming.`
  );
  
  steps.push(
    `Interact with ${slug} before token: deposit, trade, or provide liquidity to build airdrop-eligible history.`
  );
  
  steps.push(
    `Wait for launch: monitor official channels, verify contract on-chain against official sources, never click unsolicited links.`
  );
  
  steps.push(
    `Claim if airdropped: verify claim contract, check amounts against expected allocation, consider vesting before selling.`
  );
  
  if (p.category === 'Lending' || p.category === 'Liquid Staking') {
    steps.push(
      `If ${slug} offers staking, lock assets for yield and higher token allocation chances; track APY and lock period.`
    );
  }
  
  if (p.category === 'Dexs') {
    steps.push(
      `Monitor ${slug} trading volume as growth signal; provide liquidity early for fees and potential token rewards.`
    );
  }
  
  if (p.category === 'Bridges') {
    steps.push(
      `Use ${slug} bridge regularly to move assets between chains, building usage history for potential allocation.`
    );
  }
  
  if (isWatchlist && p.tvl_usd > 50_000_000) {
    steps.push(
      `High TVL watchlist (${slug}): priority farm target, allocate more resources, monitor closely for launch.`
    );
  }
  
  while (steps.length < 3) {
    steps.push(`Continue monitoring ${slug} for updates.`);
  }
  
  return steps.slice(0, 12);
}

// ============================================================
// Data script untuk dashboard
// ============================================================
export function dataScript(radar: RadarData): string {
  const watchlistData = radar.watchlist.map(p => ({
    slug: p.slug,
    name: p.name,
    category: p.category,
    chains: p.chains,
    tvl: p.tvl_usd,
    change7d: p.change_7d,
    listedAt: p.listed_at,
  }));
  
  const earlyData = radar.early.map(p => ({
    slug: p.slug,
    name: p.name,
    category: p.category,
    chains: p.chains,
    tvl: p.tvl_usd,
    change7d: p.change_7d,
    listedAt: p.listed_at,
  }));
  
  return `// Token Radar Data — deterministic
const WATCHLIST_PROTOCOLS = ${JSON.stringify(watchlistData)};
const EARLY_PROTOCOLS = ${JSON.stringify(earlyData)};
const ALL_PROTOCOLS = WATCHLIST_PROTOCOLS.concat(EARLY_PROTOCOLS);

function sortByField(arr, field, descending) {
  var copy = arr.slice();
  copy.sort(function(a, b) {
    var av = a[field], bv = b[field];
    return descending ? bv - av : av - bv;
  });
  return copy;
}

function filterTrending(arr) {
  return arr.filter(function(p) {
    return p.change7d !== null && Number(p.change7d) > 10;
  });
}

function filterByCategory(arr, cat) {
  return arr.filter(function(p) { return p.category === cat; });
}

function formatUSD(v) {
  v = Number(v);
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(2) + 'K';
  return v.toFixed(2);
}

function formatDate(d) {
  if (!d) return 'Unknown';
  var date = new Date(d);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

document.addEventListener('DOMContentLoaded', function() {
  var board = document.getElementById('board');
  if (!board) return;
  
  var sorted = sortByField(ALL_PROTOCOLS, 'tvl', true);
  renderBoard(board, sorted);
  
  document.querySelectorAll('.nav-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.nav-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      showView(btn.dataset.view);
    });
  });
  
  var sortSel = document.getElementById('f-sort');
  var catSel = document.getElementById('f-category');
  var trendCheck = document.getElementById('f-trending');
  if (sortSel) sortSel.addEventListener('change', applyFilters);
  if (catSel) catSel.addEventListener('change', applyFilters);
  if (trendCheck) trendCheck.addEventListener('change', applyFilters);
});

function renderBoard(container, protocols) {
  if (!container) return;
  container.innerHTML = protocols.map(function(p) {
    var isWL = WATCHLIST_PROTOCOLS.some(function(w) { return w.slug === p.slug; });
    var trending = p.change7d !== null && Number(p.change7d) > 10;
    var changeStr = p.change7d !== null ? Number(p.change7d).toFixed(2) + '%' : 'N/A';
    var changeClass = p.change7d !== null && Number(p.change7d) >= 0 ? 'positive' : 'negative';
    
    var badges = '';
    if (isWL) badges += '<span class="badge badge-watchlist">WATCHLIST</span> ';
    if (trending) badges += '<span class="badge badge-trending">▲ TRENDING</span>';
    
    return ''
      + '<div class="token-card">'
      + '<div class="token-header">'
      + '<span class="symbol">' + esc(p.name) + '</span>'
      + badges
      + '</div>'
      + '<div class="token-name">' + esc(p.slug) + '</div>'
      + '<div class="token-meta">'
      + '<span><strong>TVL</strong> ' + formatUSD(p.tvl) + '</span>'
      + '<span><strong>7d</strong> <span class="' + changeClass + '">' + changeStr + '</span></span>'
      + '</div>'
      + '<div class="token-meta">'
      + '<span><strong>Chains</strong> ' + esc(p.chains.join(', ')) + '</span>'
      + '<span><strong>Listed</strong> ' + formatDate(p.listedAt) + '</span>'
      + '</div>'
      + '<div class="token-category">' + esc(p.category || '—') + '</div>'
      + '</div>';
  }).join('');
}

function showView(view) {
  var board = document.getElementById('board');
  if (!board) return;
  
  if (view === 'board') {
    renderBoard(board, sortByField(ALL_PROTOCOLS, 'tvl', true));
  } else if (view === 'detail') {
    var top = sortByField(ALL_PROTOCOLS, 'tvl', true)[0];
    renderDetail(board, top);
  } else if (view === 'filtered') {
    var trending = filterTrending(ALL_PROTOCOLS);
    var filtered = trending.length > 0 ? trending : sortByField(ALL_PROTOCOLS, 'change7d', true).slice(0, 30);
    renderBoard(board, filtered);
  }
}

function renderDetail(container, p) {
  if (!container || !p) return;
  var isWL = WATCHLIST_PROTOCOLS.some(function(w) { return w.slug === p.slug; });
  var trending = p.change7d !== null && Number(p.change7d) > 10;
  
  var badges = '';
  if (isWL) badges += '<span class="badge badge-watchlist">WATCHLIST</span> ';
  if (trending) badges += '<span class="badge badge-trending">▲ TRENDING</span>';
  badges += '<span class="badge" style="background:#2a2a3e;color:#9898b0;">' + esc(p.category || 'General') + '</span>';
  
  var changeClass = p.change7d !== null && Number(p.change7d) >= 0 ? 'positive' : 'negative';
  var changeStr = p.change7d !== null ? Number(p.change7d).toFixed(2) + '%' : 'N/A';
  
  container.innerHTML = ''
    + '<div class="detail-panel">'
    + '<div class="detail-header"><h1>' + esc(p.name) + '</h1><div class="detail-slug">' + esc(p.slug) + '</div></div>'
    + '<div class="detail-badge-row">' + badges + '</div>'
    + '<div class="detail-stats">'
    + '<div class="detail-stat"><div class="stat-label">TVL</div><div class="stat-value">' + formatUSD(p.tvl) + ' USD</div></div>'
    + '<div class="detail-stat"><div class="stat-label">7d Change</div><div class="stat-value ' + changeClass + '">' + changeStr + '</div></div>'
    + '<div class="detail-stat"><div class="stat-label">Chains</div><div class="stat-value">' + esc(p.chains.join(', ')) + '</div></div>'
    + '<div class="detail-stat"><div class="stat-label">Category</div><div class="stat-value">' + esc(p.category || '—') + '</div></div>'
    + '<div class="detail-stat"><div class="stat-label">Listed</div><div class="stat-value">' + formatDate(p.listedAt) + '</div></div>'
    + '</div>'
    + '<div class="detail-description">'
    + '<h3>About ' + esc(p.name) + '</h3>'
    + '<p>' + esc(p.name) + ' is a ' + esc(p.category || 'DeFi') + ' protocol on ' + esc(p.chains.join(', ')) + '. '
    + (p.change7d !== null ? 'TVL changed ' + Number(p.change7d).toFixed(2) + '% over 7 days.' : 'No TVL change data available.') + '</p>'
    + '<h3>Farm Strategy</h3>'
    + '<ol>'
    + '<li><strong>Research</strong> — Verify ' + esc(p.slug) + ' on DefiLlama and official channels</li>'
    + '<li><strong>Monitor</strong> — Track TVL growth weekly; watch for growth above ' + formatUSD(Math.floor(Number(p.tvl) * 1.2)) + '</li>'
    + '<li><strong>Community</strong> — Join Discord/Telegram/X for launch signals</li>'
    + '<li><strong>Prepare</strong> — Set up ' + (p.chains[0] || 'main chain') + ' wallet with sufficient balance</li>'
    + '<li><strong>Interact</strong> — Use protocol before token launch to build airdrop-eligible history</li>'
    + '<li><strong>Wait</strong> — Verify token contract on-chain before claiming</li>'
    + '<li><strong>Claim</strong> — Check vesting schedule, consider holding long-term</li>'
    + '</ol>'
    + '</div>'
    + '</div>';
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
`;
}

// ============================================================
// Board validation (gate checks)
// ============================================================
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < 100 || board.length > 4000) {
    return `board has ${board.length} rows, must be 100 to 4000`;
  }
  
  const ranks = new Set(board.map(r => r.rank));
  if (ranks.size !== board.length || !board.every(r => r.rank >= 1 && r.rank <= board.length)) {
    return 'board ranks are not 1..N unique';
  }
  
  for (let i = 1; i < board.length; i++) {
    if (board[i].implied_value_usd > board[i - 1].implied_value_usd) {
      return 'board implied_value_usd does not decrease with rank';
    }
  }
  
  const uniqueValues = new Set(board.map(r => r.implied_value_usd));
  if (uniqueValues.size <= 1 && board.length >= 2) {
    return 'board has identical implied values for all rows';
  }
  
  const protocolSlugs = new Set(snapshot.protocols.map(p => p.slug));
  for (const row of board) {
    if (!protocolSlugs.has(row.slug)) {
      return `board row slug "${row.slug}" is not in snapshot`;
    }
  }
  
  const covered = new Set(board.map(r => r.slug));
  for (const slug of snapshot.watchlist) {
    if (!covered.has(slug)) {
      return `watchlist slug "${slug}" is not covered in board`;
    }
  }
  
  for (const row of board) {
    if (!row.farm_steps || row.farm_steps.length < 3 || row.farm_steps.length > 12) {
      return `board row "${row.slug}" farm_steps must be 3-12 strings`;
    }
    for (const step of row.farm_steps) {
      if (typeof step !== 'string' || step.trim().length < 20 || step.trim().length > 600) {
        return `board row "${row.slug}" farm_step must be 20-600 chars`;
      }
    }
  }
  
  return null;
}
