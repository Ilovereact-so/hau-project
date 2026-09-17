#!/usr/bin/env node
// `npm run typegen` (sanity schema extract && sanity typegen generate) fully
// overwrites sanity.types.ts — that's how Sanity TypeGen works, it's not a
// bug. The problem is that this project has one hand-written type
// (`GetSlugProduct`) living inside that generated file, so every regeneration
// silently deleted it, which broke `tsc --noEmit` across ~20 files that
// import it (components, pages, store.ts).
//
// This script re-appends that block right after `sanity typegen generate`
// runs (see the `typegen` script in package.json), so the type survives
// regeneration without anyone having to remember to re-add it by hand.
//
// If you need to add more hand-written types here in the future, add them to
// CUSTOM_TYPES below rather than editing sanity.types.ts directly — direct
// edits will be wiped by the next `npm run typegen` same as before.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FILE = path.join(__dirname, '..', 'sanity.types.ts')
const MARKER = '// ── Custom augmentations'

const CUSTOM_TYPES = `
${MARKER} (not part of Sanity TypeGen output) ──────────────
// Re-appended automatically after \`npm run typegen\` by
// scripts/appendCustomTypes.mjs — see that file for why.
//
// GetSlugProduct — canonical shape returned by the "full product projection"
// used by PRODUCT_BY_ID_QUERY, PRODUCT_BY_SUBCATEGORY_QUERY and
// PRODUCT_SEARCH_QUERY (src/sanity/helpers/index.ts). All three queries share
// an identical object projection, so this type aliases the single-item shape
// and is used both for a single product and (as GetSlugProduct[]) for lists.
export type GetSlugProduct = NonNullable<PRODUCT_BY_ID_QUERYResult>;
`

const current = readFileSync(FILE, 'utf8')

if (current.includes(MARKER)) {
  console.log('[appendCustomTypes] Custom types already present in sanity.types.ts, skipping.')
  process.exit(0)
}

writeFileSync(FILE, current.trimEnd() + '\n' + CUSTOM_TYPES)
console.log('[appendCustomTypes] Appended custom types (GetSlugProduct) to sanity.types.ts')
