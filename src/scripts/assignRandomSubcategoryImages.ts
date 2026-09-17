// src/scripts/assignRandomSubcategoryImages.ts
//
// Wrzuca do każdej subkategorii w Sanity losowe zdjęcie z puli plików
// w folderze IMAGE_DIR — dla szybkiego wypełnienia placeholderami zanim
// dojdą docelowe zdjęcia produktowe.
//
// Użycie (PowerShell, z katalogu głównego projektu):
//   npx tsx src/scripts/assignRandomSubcategoryImages.ts
//
// Przygotowanie: wrzuć kilka zdjęć (.jpg/.jpeg/.png/.webp) do
// src/data/subcategory-images/ — nazwy plików nie mają znaczenia.
//
// UWAGA: nadpisuje `imageWithAlt` u WSZYSTKICH subkategorii, również tych,
// które już mają zdjęcie. Jeśli kiedyś ma to zmienić tylko braki, dopisz
// warunek `!defined(imageWithAlt.asset)` do GROQ niżej.
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createClient } from '@sanity/client';

// --- Konfiguracja Sanity — te same nazwy env co w importSubcategories.ts,
// żeby nie trzeba było niczego dokładać do .env. ---
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
  process.env.SANITY_API_DEPLOY_TOKEN ||
  process.env.NEXT_PUBLIC_TOKEN_API_WRITE;

if (!projectId) throw new Error('Brak projectId — ustaw NEXT_PUBLIC_SANITY_PROJECT_ID w .env');
if (!token) throw new Error('Brak tokenu — ustaw SANITY_API_TOKEN (token z uprawnieniem write) w .env');

const client = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false,
  token,
});

// --- Konfiguracja skryptu ---
const IMAGE_DIR = path.join(process.cwd(), 'src', 'data', 'subcategory-images');
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

type SubcategoryDoc = {
  _id: string;
  title: string;
};

function listImageFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    throw new Error(
      `Folder ze zdjęciami nie istnieje: ${dir}\nUtwórz go i wrzuć tam kilka plików .jpg/.png/.webp, potem odpal skrypt jeszcze raz.`
    );
  }
  const files = fs
    .readdirSync(dir)
    .filter((name) => IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase()))
    .map((name) => path.join(dir, name));

  if (files.length === 0) {
    throw new Error(`Folder ${dir} jest pusty — wrzuć do niego przynajmniej jedno zdjęcie.`);
  }
  return files;
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

// Cache assetów: to samo zdjęcie wylosowane dla kilku subkategorii jest
// uploadowane do Sanity tylko raz, reszta subkategorii dostaje referencję
// do już istniejącego assetu.
const assetIdCache = new Map<string, string>();

async function uploadImageOnce(filePath: string): Promise<string> {
  const cached = assetIdCache.get(filePath);
  if (cached) return cached;

  const stream = fs.createReadStream(filePath);
  const asset = await client.assets.upload('image', stream, {
    filename: path.basename(filePath),
  });

  assetIdCache.set(filePath, asset._id);
  console.log(`🖼️  Wgrano: ${path.basename(filePath)} → ${asset._id}`);
  return asset._id;
}

async function run() {
  const imageFiles = listImageFiles(IMAGE_DIR);
  console.log(`Znaleziono ${imageFiles.length} zdjęć w puli: ${imageFiles.map((f) => path.basename(f)).join(', ')}`);

  const subcategories: SubcategoryDoc[] = await client.fetch(
    `*[_type == "subcategory"]{_id, title} | order(title asc)`
  );

  if (subcategories.length === 0) {
    console.log('ℹ️  Brak subkategorii w Sanity — nic do zrobienia.');
    return;
  }

  console.log(`Znaleziono ${subcategories.length} subkategorii — przypisuję losowe zdjęcia (nadpisując istniejące)...\n`);

  let done = 0;
  for (const subcategory of subcategories) {
    try {
      const chosenFile = pickRandom(imageFiles);
      const assetId = await uploadImageOnce(chosenFile);

      await client
        .patch(subcategory._id)
        .set({
          imageWithAlt: {
            _type: 'image',
            asset: { _type: 'reference', _ref: assetId },
            alt: `${subcategory.title} — zdjęcie subkategorii`,
          },
        })
        .commit();

      done += 1;
      console.log(`✅ ${subcategory.title} → ${path.basename(chosenFile)}`);
    } catch (error) {
      console.error(`❌ Błąd dla "${subcategory.title}":`, error instanceof Error ? error.message : error);
    }
  }

  console.log(`\n🎉 Gotowe: ${done}/${subcategories.length} subkategorii dostało zdjęcie.`);
}

run().catch((err) => {
  console.error('\nKrytyczny błąd skryptu:', err instanceof Error ? err.message : err);
  process.exit(1);
});
