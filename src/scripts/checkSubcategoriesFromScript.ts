// src/scripts/checkSubcategoriesFromScript.ts
import 'dotenv/config'
import { createClient } from '@sanity/client'

// --- bezpieczne pobranie ENV z kilkoma nazwami na wszelki wypadek ---
const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET
const apiVersion = process.env.SANITY_API_VERSION || '2025-01-01';
const token = process.env.SANITY_API_READ_TOKEN

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
});

async function run() {
  const res = await client.fetch(`*[_type == "product"]`)
  console.log('SCRIPT SUBCATEGORIES COUNT:', res.length)
  console.log(res)
}

run().catch(console.error)
