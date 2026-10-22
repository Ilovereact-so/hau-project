// Plik w `public/` i trasa w `src/app/` pod tym samym adresem = 500 przy każdym
// żądaniu („A conflicting public file and page file was found for path …”).
// Tak było z /favicon.ico 22.10.2026: nowy `public/favicon.ico` obok starego
// `src/app/favicon.ico`. Build w CI przechodził, a błąd wychodził dopiero na
// serwerze i w `next dev`. Ten skrypt zatrzymuje `npm run build` i `npm run dev`
// z nazwą konfliktu, zanim cokolwiek trafi na serwer.
//
//   node scripts/checkPublicConflicts.mjs        (uruchamiany przez prebuild/predev)

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const appDir = path.join(root, 'src', 'app');

function walk(dir, base = '') {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    return entry.isDirectory() ? walk(path.join(dir, entry.name), rel) : [rel];
  });
}

// Adresy, które obsługuje `src/app`: pliki metadanych (favicon, icon, robots…)
// oraz strony i trasy API. Grupy `(nazwa)` i `@slot` nie są częścią adresu;
// segmentów dynamicznych `[x]` nie porównujemy (nie wiadomo, co dopasują).
const METADATA = [
  [/^favicon\.ico$/, () => 'favicon.ico'],
  [/^(icon|apple-icon)(\d*)\.(ico|jpe?g|png|svg)$/, (m) => `${m[1]}${m[2]}.${m[3]}`],
  [/^(icon|apple-icon|opengraph-image|twitter-image)(\d*)\.(js|jsx|ts|tsx)$/, (m) => `${m[1]}${m[2]}`],
  [/^(opengraph-image|twitter-image)(\d*)\.(jpe?g|png|gif)$/, (m) => `${m[1]}${m[2]}.${m[3]}`],
  [/^robots\.(txt|js|ts)$/, () => 'robots.txt'],
  [/^sitemap\.(xml|js|ts)$/, () => 'sitemap.xml'],
  [/^manifest\.(js|ts)$/, () => 'manifest.webmanifest'],
  [/^manifest\.(json|webmanifest)$/, (m) => `manifest.${m[1]}`],
];

const appRoutes = new Map(); // adres → plik w src/app
for (const rel of walk(appDir)) {
  const parts = rel.split('/');
  const file = parts.pop();
  if (parts.some((p) => p.startsWith('['))) continue;
  const segs = parts.filter((p) => !(p.startsWith('(') && p.endsWith(')')) && !p.startsWith('@') && !p.startsWith('_'));
  if (parts.some((p) => p.startsWith('_'))) continue; // prywatne foldery `_x` nie są trasami
  for (const [re, toName] of METADATA) {
    const m = file.match(re);
    if (m) appRoutes.set([...segs, toName(m)].join('/'), `src/app/${rel}`);
  }
  if (/^(page|route)\.(js|jsx|ts|tsx)$/.test(file) && segs.length) appRoutes.set(segs.join('/'), `src/app/${rel}`);
}

const conflicts = walk(publicDir)
  .filter((rel) => appRoutes.has(rel))
  .map((rel) => `  /${rel}: public/${rel}  ←→  ${appRoutes.get(rel)}`);

if (conflicts.length) {
  console.error('\nKonflikt plików public/ z trasami src/app (Next odpowie 500 pod tym adresem):');
  console.error(conflicts.join('\n'));
  console.error('Usuń jeden z plików (np. `git rm src/app/favicon.ico`).\n');
  process.exit(1);
}
