// src/scripts/importSubcategories.ts
import 'dotenv/config'; // <- ZAŁADUJE .env / .env.local automatycznie (jeśli są w root)
import fs from 'fs';
import path from 'path';
import { createClient } from '@sanity/client';

// --- bezpieczne pobranie ENV z kilkoma nazwami na wszelki wypadek ---
const projectId =
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ||
  process.env.NEXT_PUBLIC_SANITY_PROJECT_I || // Twój stary wariant
  process.env.SANITY_PROJECT_ID;

const dataset =
  process.env.NEXT_PUBLIC_SANITY_DATASET ||
  process.env.SANITY_DATASET ||
  'production';

const apiVersion =
  process.env.SANITY_API_VERSION || '2025-01-01';

const token =
  process.env.SANITY_API_TOKEN ||
  process.env.NEXT_PUBLIC_TOKEN_API_WRITE; // jeśli używasz takiego w dev

if (!projectId) {
  throw new Error('Brak projectId – ustaw NEXT_PUBLIC_SANITY_PROJECT_ID lub NEXT_PUBLIC_SANITY_PROJECT_I lub SANITY_PROJECT_ID w .env');
}
if (!token) {
  throw new Error('Brak tokenu – ustaw SANITY_API_TOKEN (prywatny token z uprawnieniem write)');
}

console.log('Using Sanity config:', { projectId, dataset, apiVersion });

// osobny klient tylko dla skryptu
const client = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false,
  token,
});

type SubcatInput = {
  title: string;
  slug: string;
  description: string;
  parentSlug: string;
};

async function run() {
  // jeśli trzymasz subcat.json w src/data
  const filePath = path.join(process.cwd(), 'src', 'data', 'subcat.json');
  const raw = fs.readFileSync(filePath, 'utf8');
  const items: SubcatInput[] = JSON.parse(raw);

  console.log(`Found ${items.length} subcategories in JSON`);

  for (const item of items) {
    try {
      const parent = await client.fetch(
        `*[_type == "category" && slug.current == $slug][0]{_id, title, slug}`,
        { slug: item.parentSlug }
      );

      if (!parent?._id) {
        console.warn(
          `⚠️ Parent category not found for subcategory "${item.title}" (parentSlug: ${item.parentSlug})`
        );
        continue;
      }

      const docId = `subcategory.${item.slug}`;

      const doc = {
        _type: 'subcategory',
        title: item.title,
        slug: { _type: 'slug', current: item.slug },
        description: item.description,
        parent: {
          _type: 'reference',
          _ref: parent._id,
        },
      };

      const created = await client.create(doc);
      console.log(
        `✅ Created/exists: ${created._id} (${item.title}) → parent: ${parent.slug?.current}`
      );
    } catch (err: any) {
      console.error(`❌ Error for "${item.title}":`, err?.message || err);
    }
  }

  console.log('🎉 Done importing subcategories.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
