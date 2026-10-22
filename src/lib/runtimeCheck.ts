import 'server-only'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/*
 * Zgodność paczki z zależnościami na serwerze.
 *
 * Na hostingu `node_modules` NIE przychodzi z deployem — instaluje je przycisk
 * „Uruchom NPM Install” z `package.json` wygenerowanego przez
 * `scripts/deployPackage.mjs` (w `public_html/node_modules`). Gdy build powstał
 * na innej wersji Next.js niż ta, którą serwer faktycznie ładuje, strony
 * dynamiczne działają, ale trasy prerenderowane przy budowaniu (favicon,
 * manifest, statyczne /api) dają 500: „Cannot read properties of undefined
 * (reading 'kind')” — format wpisów cache różni się między wersjami.
 *
 * Node szuka pakietu od katalogu `server.js` (`public_html/standalone`) w górę.
 * „Uruchom NPM Install” instaluje do `public_html/node_modules` (środowisko
 * nodevenv katalogu `public_html`), ale stary `public_html/standalone/node_modules`
 * z dawnego deployu — jeśli istnieje — PRZYKRYWA tę instalację i „NPM Install”
 * niczego nie zmienia (awaria 22.10.2026). Dlatego zbieramy wszystkie kopie na
 * ścieżce wyszukiwania, a nie tylko pierwszą. Sprawdzamy to raz na proces.
 */

export type NextCopy = { path: string; version: string }

export type NextVersionInfo = {
  /** Wersja, na której zbudowano paczkę (`HAU_NEXT_BUILD_VERSION` z `next.config.ts`). */
  built: string
  /** Kopia, którą Node faktycznie ładuje (pierwsza na ścieżce wyszukiwania). */
  running: NextCopy
  /** Pozostałe kopie wyżej w drzewie — przykryte przez `running`. */
  shadowed: NextCopy[]
}

let cached: NextVersionInfo | null | undefined

/** Wersja Next.js z builda i kopie w `node_modules` serwera; `null`, gdy nie da się ustalić. */
export function nextVersions(): NextVersionInfo | null {
  if (cached !== undefined) return cached
  cached = null
  const built = (process.env.HAU_NEXT_BUILD_VERSION ?? '').trim()
  if (!built) return cached
  try {
    const copies = findPackageCopies('next', process.cwd())
    if (!copies.length) return cached
    cached = { built, running: copies[0], shadowed: copies.slice(1) }
  } catch {
    cached = null
  }
  return cached
}

/**
 * Wszystkie `node_modules/<pakiet>/package.json` na ścieżce wyszukiwania Node:
 * od katalogu procesu (`server.js` robi `chdir` do swojego katalogu) w górę,
 * w kolejności, w jakiej sprawdza je Node. Ręcznie, bo webpack podmienia
 * w kodzie serwera i `require`, i `createRequire` — JSON zostałby wklejony
 * przy buildzie albo funkcja byłaby pusta.
 */
function findPackageCopies(name: string, from: string): NextCopy[] {
  const copies: NextCopy[] = []
  let dir = from
  for (;;) {
    const file = join(dir, 'node_modules', name, 'package.json')
    if (existsSync(file)) {
      try {
        copies.push({ path: dirname(file), version: String(JSON.parse(readFileSync(file, 'utf8')).version ?? '?') })
      } catch {
        copies.push({ path: dirname(file), version: '?' })
      }
    }
    const parent = dirname(dir)
    if (parent === dir) return copies
    dir = parent
  }
}

/** Komunikat o rozjeździe wersji albo `null`, gdy wszystko się zgadza (albo nie da się sprawdzić). */
export function nextVersionMismatch(): string | null {
  const versions = nextVersions()
  if (!versions || versions.built === versions.running.version) return null
  const { built, running, shadowed } = versions
  const hidden = shadowed.find((copy) => copy.version === built)
  const runningModules = dirname(running.path)
  const fix = hidden
    ? // Poprawna instalacja (z „Uruchom NPM Install”) istnieje wyżej, ale przykrywa ją
      // stary katalog bliżej `server.js` — zwykle `standalone/node_modules` z dawnego deployu.
      `Poprawna wersja leży w ${hidden.path}, ale przykrywa ją starszy katalog ${runningModules}. ` +
      `Przenieś go w bezpieczne miejsce (np. mv ${runningModules} ~/node_modules_stare) i zrestartuj aplikację.`
    : `Sprawdź, czy ${join(dirname(runningModules), 'package.json')} przypina "next": "${built}", ` +
      'kliknij „Uruchom NPM Install” w panelu Node.js i zrestartuj aplikację.'
  return (
    `Paczka sklepu jest zbudowana na Next.js ${built}, a serwer ładuje ${running.version} z ${running.path}. ` +
    `Favicon, manifest i część tras /api mogą zwracać błąd 500. ${fix}`
  )
}

/** Jedna linijka do logu przy starcie: skąd i w jakiej wersji ładowany jest Next.js. */
export function nextVersionSummary(): string | null {
  const versions = nextVersions()
  if (!versions) return null
  const extra = versions.shadowed.length
    ? `; przykryte kopie: ${versions.shadowed.map((copy) => `${copy.version} (${copy.path})`).join(', ')}`
    : ''
  return `Next.js: paczka ${versions.built}, serwer ${versions.running.version} (${versions.running.path})${extra}`
}
