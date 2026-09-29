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

console.info('Zależności serwera:', dependencies);
if (skipped.length) console.info('Pominięte (brak w node_modules — opcjonalne):', skipped);
