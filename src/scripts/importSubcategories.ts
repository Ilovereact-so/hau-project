import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createClient } from '@sanity/client';
import { ensureArrayKeys } from '@/sanity/helpers/productImportHelpers';

const projectId =
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ||
  process.env.NEXT_PUBLIC_SANITY_PROJECT_I ||
  process.env.SANITY_PROJECT_ID;

const dataset =
  process.env.NEXT_PUBLIC_SANITY_DATASET ||
  process.env.SANITY_DATASET ||
  'production';

const apiVersion = process.env.SANITY_API_VERSION || '2025-01-01';

const token =
  process.env.SANITY_API_TOKEN ||
  process.env.NEXT_PUBLIC_TOKEN_API_WRITE;

if (!projectId) throw new Error('Brak projectId');
if (!token) throw new Error('Brak tokenu');

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
  availableFilters?: string[];
  parentSlug: string;
  imagePath: string;
};

// 🔹 cache assetów – ten sam plik uploadowany tylko raz
const imageAssetCache = new Map<string, string>();

async function deleteAllSubcategories() {
  console.log('🧹 Deleting existing subcategories...');

  const ids: string[] = await client.fetch(
    `*[_type == "subcategory"]._id`
  );

  if (!ids.length) {
    console.log('ℹ️ No subcategories to delete');
    return;
  }

  console.log(`🗑️ Found ${ids.length} subcategories`);

  let transaction = client.transaction();

  ids.forEach((id) => {
    transaction = transaction.delete(id);
  });

  await transaction.commit();

  console.log('✅ All subcategories deleted');
}

async function uploadImageOnce(imagePath: string) {
  if (imageAssetCache.has(imagePath)) {
    return imageAssetCache.get(imagePath)!;
  }

  const fullPath = path.join(
    process.cwd(),
    'public',
    imagePath
  );

  if (!fs.existsSync(fullPath)) {
    throw new Error(`❌ Image not found: ${fullPath}`);
  }

  const stream = fs.createReadStream(fullPath);

  const asset = await client.assets.upload('image', stream, {
    filename: imagePath,
  });

  imageAssetCache.set(imagePath, asset._id);
  console.log(`🖼️ Uploaded image: ${imagePath} → ${asset._id}`);

  return asset._id;
}

async function run() {
  await deleteAllSubcategories();
  const filePath = path.join(process.cwd(), 'src', 'data', 'subcat.json');
  const raw = fs.readFileSync(filePath, 'utf8');
  const items: SubcatInput[] = JSON.parse(raw);

  console.log(`Found ${items.length} subcategories`);

  for (const item of items) {
    try {
      const parent = await client.fetch(
        `*[_type == "category" && slug.current == $slug][0]{_id, title}`,
        { slug: item.parentSlug }
      );
      
      if (!parent?._id) {
        console.warn(`⚠️ Parent not found: ${item.parentSlug}`);
        continue;
      }

      const imageAssetId = await uploadImageOnce(item.imagePath);
      const doc = {
        _type: 'subcategory',
        title: item.title,
        slug: { _type: 'slug', current: item.slug },
        description: item.description,
        availableFilters: [],
        parent: {
          _type: 'reference',
          _ref: parent._id,
        },
        imageWithAlt: {
          _type: 'image',
          asset: {
            _type: 'reference',
            _ref: imageAssetId,
          },
          alt: `${item.title} – ${parent.title}`,
        },
      };

      if(item.availableFilters){
        const filtersRefs:any = [];
        for(const filterSlug of item.availableFilters){
          const filterDoc = await client.fetch(
            `*[_type == "filter" && key == $key][0]{_id}`,
            { key: filterSlug }
          );
          if(filterDoc?._id){
            filtersRefs.push({
              _type: 'reference',
              _ref: filterDoc._id
            });
          }
        }
        if(filtersRefs.length > 0){
          doc.availableFilters = ensureArrayKeys(filtersRefs) || filtersRefs;
        }
        console.log('Available filters references:', filtersRefs);
      }
      console.log('Upserting subcategory:', doc);
      await client.create(doc);

      console.log(`✅ Upserted: ${item.title}`);
    } catch (err: any) {
      console.error(`❌ Error for "${item.title}":`, err?.message || err);
    }
  }

  console.log('🎉 Subcategories import + images DONE');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
