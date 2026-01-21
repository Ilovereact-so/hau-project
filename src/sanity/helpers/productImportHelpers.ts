// -----------------------------
// Useful helper scripts (TypeScript) that you can import in your uploader
// These helpers do NOT run inside Sanity schema — są tu dla wygody deweloperskiej.
// Kopiuj je do pliku helpers/productImportHelpers.ts i używaj w komponencie upload.
// -----------------------------

/* eslint-disable max-lines */

import { customAlphabet } from 'nanoid';
const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 8);
import JSZip from "jszip";

export type SanitySlug = { _type: 'slug'; current: string };

export function ensureSlug(slugOrString?: any): SanitySlug | undefined {
  if (!slugOrString && slugOrString !== '') return undefined;

  // jeśli już jest obiektem slug i ma current — zwróć tak jak jest
  if (typeof slugOrString === 'object' && slugOrString !== null && 'current' in slugOrString) {
    // upewniamy się, że ma _type
    return { _type: 'slug', current: String(slugOrString.current) };
  }
  const s = String(slugOrString || '').trim();
  if (!s) return undefined;
  return { _type: 'slug', current: s };
}

export function ensureBlockContent(input?: string | any) {
  if (!input) return undefined;
  // if already seems to be blockContent (array) return as-is
  if (Array.isArray(input)) return input;
  const text = String(input || '').trim();
  return [
    {
      _type: 'block',
      style: 'normal',
      _key: nanoid(),
      children: [
        {
          _type: 'span',
          text,
          _key: nanoid(),
        },
      ],
    },
  ];
}


export function ensureArrayKeys<T extends Record<string, any>>(arr?: T[]): T[] | undefined {
  if (!arr) return undefined;

  return arr.map((item) => {
    const copy: any = { ...item };

    if (!copy._key) copy._key = nanoid();

    // jeśli to opcje/variants – zadbaj też o children
    if (Array.isArray(copy.values)) {
      copy.values = copy.values.map((v: any) => ({
        ...(v || {}),
        _key: v?._key || nanoid(),
      }));
    }

    if (Array.isArray(copy.optionValues)) {
      copy.optionValues = copy.optionValues.map((ov: any) => ({
        ...(ov || {}),
        _key: ov?._key || nanoid(),
      }));
    }

    // na wszelki wypadek: tablica obiektów images
    if (Array.isArray(copy.images)) {
      copy.images = copy.images.map((img: any) => ({
        ...(img || {}),
        _key: img?._key || nanoid(),
      }));
    }

    return copy as T;
  });
}



export function normalizeValue(input: string) {
  if (!input) return "";
  // lower-case, replace spaces with underscore, remove diacritics, remove special chars
  return input
    .toString()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function splitList(cell?: string) {
  if (!cell) return [];
  // accept commas or semicolons as separators
  return cell.split(/[;,]/).map(s => s.trim()).filter(Boolean);
}

export function parseFilterValues(row: Record<string, string | undefined>) {
  const filterValues: string[] = [];
  for (const key of Object.keys(row)) {
    if (key.toLowerCase().startsWith('filter_')) {
      const vals = splitList(row[key]);
      if (vals.length) {
        filterValues.push(...vals);
      }
    }
  }
  return filterValues;
}

export function parseOptionColumns(row: Record<string, string | undefined>) {
  const options: Array<any> = [];
  const availableOptions = row.productOptions ? splitList(row.productOptions) : []; 
  for (const key of Object.keys(row)) {
    if (key.toLowerCase().startsWith('filter_') && availableOptions.includes(key.toLocaleLowerCase().replace('filter_', ''))) {
      const name = key.replace(/^filter_/, '');
      const vals = splitList(row[key]);
      if (vals.length) {
        options.push({
          name,
          values: vals.map(v => ({ label: v, value: normalizeValue(v) }))
        });
      }
    }
  }
  return options;
}

// cartesian product generator for options
export function generateVariants(
  options: Array<{ name: string; values: Array<{ label: string; value: string }> }>
) {
  if (!options || options.length === 0) return [];

  const lists = options.map(opt =>
    opt.values.map(v => ({
      name: opt.name,
      label: v.label,
      value: v.value,
    }))
  );

  let combos: any[] = [{}];

  for (const list of lists) {
    combos = combos.flatMap(c =>
      list.map(item => ({
        ...c,
        [item.name]: item.value,
      }))
    );
  }

  return combos.map((c, idx) => {
    const optionValues = Object.entries(c).map(([k, v]) => ({
      _key: nanoid(),
      name: k,
      value: v as string,
    }));

    const indexedOptions = optionValues.map(ov => `${normalizeValue(ov.name)}:${ov.value}`);
    return {
      _key: nanoid(),              // 🔑 klucz wariantu (Sanity array item key)
      id: `variant-${idx + 1}`,
      sku: undefined,
      optionValues,               // 🔑 każdy ma _key
      indexedOptions, 
    };
  });
}


export function buildIndexedOptions(options: Array<{ name: string; values: Array<{label: string; value: string}> }>) {
  const indexed: string[] = [];
  for (const opt of options) {
    for (const v of opt.values) indexed.push(`${normalizeValue(opt.name)}:${v.value}`);
  }
  return indexed;
}

// helper that maps a CSV row to a product partial for Sanity create
export function mapCsvRowToProductPartial(row: Record<string, string | undefined>) {
  const images = splitList(row.images || '').map(url => url.trim()).filter(Boolean);
  const tags = splitList(row.tags || ';').map(t => t.trim()).filter(Boolean);
  const options = parseOptionColumns(row);
  const filterValues = parseFilterValues(row);
  const dimensions: any = {};
  console.log(row)
  if (row.properties_width_cm) dimensions.width_cm = Number(row.properties_width_cm);
  if (row.properties_height_cm) dimensions.height_cm = Number(row.properties_height_cm);
  if (row.properties_depth_cm) dimensions.depth_cm = Number(row.properties_depth_cm);
  if (row.properties_units) dimensions.unit = String(row.properties_units);
  const product: any = {
    _type: 'product',
    title: row.title || 'Untitled',
    subtitle: row.subtitle || undefined,
    intro: row.intro || undefined,
    sku: row.sku || undefined,
    slug: row.slug || undefined,
    shortDescription: row.shortDescription || undefined,
    description: row.description || undefined,
    price: row.price ? Number(row.price) : undefined,
    currency: row.currency || undefined,
    compareAtPrice: row.compareAtPrice ? Number(row.compareAtPrice) : undefined,
    stock: row.stock ? Number(row.stock) : undefined,
    visibility: row.visibility || undefined,
    category: row.category || undefined, // importer should resolve to reference
    type: row.type || undefined,
    brand: row.brand || undefined,
    vendor: row.vendor || undefined,
    tags,
    images,
    options,
    dimensions,
    weight_g: row.weight_g ? Number(row.weight_g) : undefined,
    material: row.material || undefined,
    care: row.care || undefined,
    isMachineWashable: parseBoolean(row.isMachineWashable),
    isWaterproof: parseBoolean(row.isWaterproof),
    isFeatured: parseBoolean(row.isFeatured),
    isBestseller: parseBoolean(row.isBestseller),
    chew_strength: row.chew_strength || undefined,
    metaTitle: row.metaTitle || undefined,
    metaDescription: row.metaDescription || undefined,
  };
  product.slug = ensureSlug(product.slug || row.slug || product.title?.toLowerCase().replace(/[^a-z0-9]+/g,'-'));
  product.description = ensureBlockContent(product.description || row.description || row.shortDescription);
  product.options = ensureArrayKeys(product.options);
  product.variants = ensureArrayKeys(product.variants);
  product.filterValues = ensureArrayKeys(product.filterValues);
  // add indexedOptions if possible
  const indexed = buildIndexedOptions(options);
  if (indexed.length) product.indexedOptions = indexed;

  return product;
}

export function parseBoolean(val?: string) {
  if (val === undefined || val === null) return undefined;
  const v = String(val).trim().toLowerCase();
  if (['prawda','true', '1', 'tak', 'yes', 'y'].includes(v)) return true;
  if (['fałsz','false', '0', 'nie', 'no', 'n'].includes(v)) return false;
  return undefined;
}

// small helper for generating SKU templates: e.g. baseSku + option values
export function generateSkuForVariant(baseSku: string | undefined, variantIdx: number, optionMap: Record<string,string>) {
  const parts = [baseSku || 'AUTO'];
  for (const k of Object.keys(optionMap)) parts.push(normalizeValue(optionMap[k]));
  parts.push(String(variantIdx + 1).padStart(2, '0'));
  return parts.filter(Boolean).join('-').toUpperCase();
}


// --- ZIP EXTRACTOR ---
export async function extractZipImages(zipFile: File): Promise<Record<string, Blob>> {
  const map: Record<string, Blob> = {};

  const arrayBuffer = await zipFile.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  const entries = Object.keys(zip.files);
  await Promise.all(
    entries.map(async (name) => {
      const entry = zip.files[name];
      if (!entry || entry.dir) return;
      const blob = await entry.async("blob");
      const base = name.split("/").pop() || name;
      map[base] = blob;
    })
  );

  return map;
}

// --- SLUG NORMALIZER ---
export function normalizeSlugForImages(row: any, partial: any): string | undefined {
  if (row.slug && row.slug.trim()) return row.slug.trim();

  if (partial.slug && typeof partial.slug === "object" && partial.slug.current) {
    return partial.slug.current;
  }

  if (partial.title) {
    return String(partial.title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  return undefined;
}

// --- IMAGE MATCHER ---
export function matchZipImagesToSlug(
  zipImages: Record<string, Blob>,
  slug: string
): { filename: string; blob: Blob; index: number }[] {
  const matches: { filename: string; blob: Blob; index: number }[] = [];

  for (const [filename, blob] of Object.entries(zipImages)) {
    const base = filename.split("/").pop() || filename;
    const noext = base.replace(/\.[^.]+$/, "");

    // EXACT MATCH: slug.jpg
    if (noext === slug) {
      matches.push({ filename: base, blob, index: 0 });
      continue;
    }

    // PATTERN MATCH: slug1, slug-1, slug_1
    const regex = new RegExp(`^${slug}[-_]?([0-9]+)$`);
    const match = noext.match(regex);

    if (match) {
      const index = parseInt(match[1], 10);
      matches.push({
        filename: base,
        blob,
        index: isNaN(index) ? 0 : index,
      });
    }
  }

  // SORT BY INDEX
  matches.sort((a, b) => a.index - b.index);

  return matches;
}


// End of helpers