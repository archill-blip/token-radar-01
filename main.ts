/**
 * Token Launch Radar — make.fun bounty: token-radar-01
 * Program utama: Node 22, standard library only, TypeScript native.
 * 
 * Siklus sandbox:
 *   1. POST $MAKEFUN_ENV_URL/register → {port}
 *   2. Server jalan, jawab GET /healthz → 200
 *   3. Long-poll GET $MAKEFUN_ENV_URL/done
 * 
 * Deterministik: seed tetap, tanpa Date.now() di data output.
 * Zero network: tidak ada fetch, CDN, font eksternal.
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { buildDossier } from './vendor/makefun-board.ts';
import { buildRadar, parseSnapshot, dataScript, boardIssue } from './lib/model.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

/** Caps dari reference/gate.json */
const TEXT_MAX_BYTES = 65_536;
const SCREENSHOT_CAPS = { max: 4, max_bytes: 524_288 };
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/** Parse argumen --name <value> */
function arg(name: string, fallback: string): string {
  const at = process.argv.indexOf(`--${name}`);
  if (at >= 0 && at + 1 < process.argv.length) return process.argv[at + 1]!;
  const withEquals = process.argv.find((a) => a.startsWith(`--${name}=`));
  return withEquals === undefined ? fallback : withEquals.slice(name.length + 3);
}

const inputArg = arg('input', '/input');
const inputFile = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
if (!existsSync(inputFile)) {
  process.stderr.write(`token radar: no snapshot at ${inputFile}: pass --input <snapshot.json|directory> or mount /input\n`);
  process.exit(2);
}

const outDir = arg('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');
const maekfunEnvUrl = process.env.MAKEFUN_ENV_URL || '';

// Read snapshot
const snapshot = parseSnapshot(readFileSync(inputFile, 'utf8'));
const { board, radar } = buildRadar(snapshot);
const issue = boardIssue(board, snapshot);
if (issue !== null) {
  process.stderr.write(`token radar: the model wrote a board the gate refuses: ${issue}\n`);
  process.exit(1);
}

// Prepare output directory
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
writeFileSync(join(outDir, 'data.js'), dataScript(radar));

// Copy dashboard/ and screenshots/
function copyFiles(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const src = join(from, name);
    if (!statSync(src).isFile()) continue;
    copyFileSync(src, join(to, name));
    copied.push(name);
  }
  return copied;
}

copyFiles(join(here, 'dashboard'), join(outDir, 'dashboard'));
const shots = copyFiles(join(here, 'screenshots'), join(outDir, 'screenshots'));
if (shots.length < 3) {
  process.stderr.write(`token radar: screenshots/ holds ${shots.length} image(s): need 3\n`);
  process.exit(1);
}
for (const name of shots) {
  if (!IMAGE_NAME.test(name)) {
    process.stderr.write(`token radar: screenshots/${name}: invalid name\n`);
    process.exit(1);
  }
}

// Write dossier.json last (scorer rebuilds from /output dan compare bytes)
writeFileSync(join(outDir, 'dossier.json'), buildDossier(outDir, {
  text_max_bytes: TEXT_MAX_BYTES,
  screenshots: SCREENSHOT_CAPS,
  dashboard: { max_files: 400, max_bytes: 4_194_304 },
}));

process.stdout.write(
  `token radar: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} on watchlist, ${board.length} rows (${radar.early.length} early, ${radar.live.length} live)\n` +
  `token radar: wrote ${join(outDir, 'board.json')}, ${join(outDir, 'data.js')}, dashboard/ (3 files), screenshots/ (${shots.length} images), dossier.json\n`,
);

// ============================================================
// Sandbox lifecycle (hanya jalan jika MAKEFUN_ENV_URL di-set)
// ============================================================
if (maekfunEnvUrl) {
  const server = createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://localhost');
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    
    if (url.pathname === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('OK');
      return;
    }
    
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });
  
  const port = 3000;
  server.listen(port, '127.0.0.1', async () => {
    // 1. Register
    try {
      const reg = await fetch(`${maekfunEnvUrl}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ port }),
      });
      if (!reg.ok) process.stderr.write(`[WARN] register: ${reg.status}\n`);
    } catch (e) {
      process.stderr.write(`[WARN] register failed: ${e}\n`);
    }
    
    // 2. Long-poll /done
    try {
      await fetch(`${maekfunEnvUrl}/done`, { method: 'GET' });
    } catch (e) {
      // Expected: server akan di-kill oleh harness
    }
  });
  
  process.on('SIGTERM', () => { server.close(() => process.exit(0)); });
  process.on('SIGINT', () => { server.close(() => process.exit(0)); });
}
