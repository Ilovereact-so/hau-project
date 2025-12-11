import { createClient } from '@sanity/client';
import 'dotenv/config';

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

// --- PARAMETRY USUWANIA ---
const DOCUMENT_TYPE = 'subcategory';
const DRY_RUN = false;            

async function deleteDevDocuments() {    
    console.log(`\n--- START USUWANIA DOKUMENTÓW Z Sanity ---`);
    console.log(`Typ dokumentu: ${DOCUMENT_TYPE}`);
    console.log(`Tryb: ${DRY_RUN ? 'SUCHY BIEG (DRY RUN)' : 'USUWANIE DANYCH'}`);
    console.log('------------------------------------------');

    const groqQuery = `*[_type == "subcategory"]._id`;

    try {
        console.log(`Wyszukiwanie dokumentów za pomocą GROQ: ${groqQuery}`);
        
        const documentIds: string[] = await client.fetch(groqQuery);

        if (documentIds.length === 0) {
            console.log("Nie znaleziono żadnych dokumentów pasujących do kryterium. Koniec.");
            return;
        }

        console.log(`Znaleziono ${documentIds.length} dokumentów do usunięcia.`);

        if (DRY_RUN) {
            console.log("\n--- DRY RUN ---");
            console.log("Znalezione ID (nie usunięto):");
            documentIds.forEach(id => console.log(`- ${id}`));
            console.log(`\nAby usunąć, zmień DRY_RUN na 'false' i uruchom ponownie.`);
            return;
        }

        let transaction = client.transaction();
        documentIds.forEach(id => {
            transaction = transaction.delete(id);
        });

        const result = await transaction.commit();
        
        console.log("\n--- SUKCES ---");
        console.log(`Usunięto ${documentIds.length} dokumentów.`);

    } catch (error) {
        console.error("\nWystąpił błąd podczas komunikacji z Sanity:", error);
    }
}

deleteDevDocuments();