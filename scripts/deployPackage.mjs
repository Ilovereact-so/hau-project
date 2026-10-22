// Składa `package.json` + `package-lock.json` dla serwera (przycisk „Uruchom
// NPM Install” w panelu Node.js). Odpalany w CI PO `next build`:
//
//   node scripts/deployPackage.mjs <katalog-docelowy>
//
// DLACZEGO NIE PEŁNY package.json: panel (CloudLinux Node.js Selector) instaluje
// pakiety w katalogu środowiska (~/nodevenv/…/lib), więc `.npmrc` z katalogu
// aplikacji nie działa, a pełna lista zależności ciągnie m.in. tsx/vite/sanity
// z trzema wersjami esbuilda. Skrypt instalacyjny esbuilda wywracał tam całą
// instalację („Expected "0.28.2" but got "0.25.12"”).
//
// Na serwerze potrzebne jest tylko to, czego skompilowane trasy wymagają
// w runtime — reszta jest wkompilowana w chunki `.next/server`. Zbieramy więc
// każde `require("pakiet")` z chunków, pomijamy moduły wbudowane Node i pakiety,
// których nie ma w node_modules (opcjonalne `require` w `try`, np.
// @emotion/is-prop-valid), i przypinamy DOKŁADNE wersje z builda.

import { execSync } from 'node:child_process';
import { builtinModules } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const outDir = process.argv[2];
if (!outDir) {
  console.error('Użycie: node scripts/deployPackage.mjs <katalog-docelowy>');
  process.exit(1);
}

const root = process.cwd();
const serverDir = path.join(root, '.next', 'server');
if (!fs.existsSync(serverDir)) {
  console.error('Brak .next/server — najpierw `next build`.');
  process.exit(1);
}

const builtins = new Set(builtinModules);
// Zawsze: serwer Next i jego peer-zależności (server.js ładuje je wprost).
const wanted = new Set(['next', 'react', 'react-dom']);

const REQUIRE_RE = /\b(?:require|import)\(\s*"([^"./][^"]*)"\s*\)/g;

function packageName(spec) {
  const parts = spec.split('/');
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.js')) {
      const src = fs.readFileSync(full, 'utf8');
      for (const [, spec] of src.matchAll(REQUIRE_RE)) {
        if (spec.startsWith('node:')) continue;
        const name = packageName(spec);
        if (!builtins.has(name)) wanted.add(name);
      }
    }
  }
}
walk(serverDir);

const dependencies = {};
const skipped = [];
for (const name of [...wanted].sort()) {
  const pkgJson = path.join(root, 'node_modules', name, 'package.json');
  if (!fs.existsSync(pkgJson)) {
    skipped.push(name);
    continue;
  }
  dependencies[name] = JSON.parse(fs.readFileSync(pkgJson, 'utf8')).version;
}

const rootPkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const deployPkg = {
  name: `${rootPkg.name}-server`,
  version: rootPkg.version,
  private: true,
  // `server.js` ze standalone jest modułem ESM (projekt ma "type": "module") —
  // bez tego pola w `standalone/package.json` Node potraktowałby go jak CommonJS.
  ...(rootPkg.type ? { type: rootPkg.type } : {}),
  description: 'Zależności runtime dla .next/standalone — generowane przez scripts/deployPackage.mjs',
  dependencies,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'package.json'), `${JSON.stringify(deployPkg, null, 2)}\n`);
fs.rmSync(path.join(outDir, 'package-lock.json'), { force: true });
// Lockfile zgodny z powyższą listą — bez instalacji i bez skryptów.
execSync('npm install --package-lock-only --ignore-scripts --no-audit --no-fund', {
  cwd: outDir,
  stdio: 'inherit',
});

// TO SAMO do `.next/standalone/`. `next build` kopiuje tam PEŁNY package.json
// projektu (zakresy `^`, bez lockfile) — gdyby ktoś zainstalował zależności
// w `standalone/`, dostałby inne wersje niż paczka (np. stare 15.5.25 spełnia
// `^15.5.7`, a paczka jest z 15.5.27 → 500 na favicon/manifeście/statycznych
// /api, „reading 'kind'”, awaria 22.10.2026). Teraz każdy package.json na
// serwerze ma te same, dokładnie przypięte wersje i lockfile. Instalacja i tak
// ma być w `public_html/node_modules` — `standalone/node_modules` nie powinien
// istnieć (przykrywa ją, bo Node szuka od katalogu `server.js` w górę).
const standaloneDir = path.join(root, '.next', 'standalone');
if (fs.existsSync(standaloneDir)) {
  for (const file of ['package.json', 'package-lock.json']) {
    fs.copyFileSync(path.join(outDir, file), path.join(standaloneDir, file));
  }
  console.info('Zapisano też .next/standalone/package.json i package-lock.json (przypięte wersje).');
}

// Ikony do KATALOGU GŁÓWNEGO public_html (ten katalog wgrywa krok
// „FTP — package.json w katalogu aplikacji”). Apache serwuje istniejące pliki
// z public_html sam, zanim żądanie trafi do Passengera — tak jak `_next/static`.
// Dzięki temu /favicon.ico działa niezależnie od procesu Next: także gdy ten
// wstaje, ma inną wersję w node_modules albo leży (awarie 22.10.2026).
// Kopie w `standalone/public` zostają jako zapas (lokalnie i bez Apache).
const ROOT_ICONS = ['favicon.ico', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];
for (const file of ROOT_ICONS) {
  const from = path.join(root, 'public', file);
  if (fs.existsSync(from)) fs.copyFileSync(from, path.join(outDir, file));
  else console.warn(`Uwaga: brak public/${file} — nie trafi do katalogu głównego serwera.`);
}

console.info('Zależności serwera:', dependencies);
if (skipped.length) console.info('Pominięte (brak w node_modules — opcjonalne):', skipped);
