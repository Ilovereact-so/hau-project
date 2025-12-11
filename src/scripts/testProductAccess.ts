import { createClient, SanityClient } from '@sanity/client';
import 'dotenv/config'; // <- ZAŁADUJE .env / .env.local automatycznie (jeśli są w root)

// Upewnij się, że masz te zmienne środowiskowe ustawione w terminalu lub pliku .env
const PROJECT_ID =
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ||
  process.env.NEXT_PUBLIC_SANITY_PROJECT_I || // Twój stary wariant
  process.env.SANITY_PROJECT_ID;

const DATASET =
  process.env.NEXT_PUBLIC_SANITY_DATASET ||
  process.env.SANITY_DATASET ||
  'production';

const API_VERSION =
  process.env.SANITY_API_VERSION || '2025-10-11';

const WRITE_TOKEN =
  process.env.SANITY_API_TOKEN ||
  process.env.NEXT_PUBLIC_TOKEN_API_WRITE; // jeśli używasz takiego w dev

const DOC_TYPE = 'product'; 
const TEST_DOCUMENT_ID = `test-public-read-${DOC_TYPE}-isolated`;

if (!PROJECT_ID || !DATASET || !WRITE_TOKEN) {
    console.error("Błąd: Ustaw zmienne środowiskowe NEXT_PUBLIC_SANITY_PROJECT_ID i SANITY_API_TOKEN.");
    process.exit(1);
}

/**
 * Konfiguruje klienta Sanity zgodnie z Twoimi plikami
 */
function getClient(useToken: boolean): SanityClient {
    return createClient({
        projectId: PROJECT_ID!,
        dataset: DATASET,
        apiVersion: API_VERSION,
        useCdn: false, // Zgodnie z Twoją konfiguracją w sanityClient.server.ts
        token: useToken ? WRITE_TOKEN : undefined,
        perspective: 'published', // Zgodnie z Twoją konfiguracją
    });
}

async function runTest() {
    console.log(`--- Test Dostępu Publicznego do Dokumentu Produktu ---`);
    console.log(`ID Dokumentu: ${TEST_DOCUMENT_ID}`);
    console.log(`API Version: ${API_VERSION}\n`);

    const adminClient = getClient(true); // Klient z tokenem (do zapisu)
    const publicClient = getClient(false); // Klient BEZ tokena (do odczytu)

    let createdId: string | null = null;
    
    try {
        // KROK 1: PRZYGOTOWANIE DANYCH
        const docData = {
            _id: TEST_DOCUMENT_ID,
            _type: DOC_TYPE,
            title: 'Testowy Produkt Publiczny',
            subtitle: 'Wariant Testowy',
            sku: 'TEST-SKU-001',
            slug: { _type: 'slug', current: 'test-product-public' },
            price: 99.99,
            stock: 10,
            // KLUCZOWE: Ustawienie na 'storefront' zgodnie z Twoimi danymi z ręcznego produktu
            visibility: 'storefront', 
        };

        // KROK 2: TWORZENIE DOKUMENTU (Z TOKENEM)
        console.log("1. Tworzenie dokumentu...");
        
        const createdDoc = await adminClient.create(docData);
        createdId = createdDoc._id;
        console.log(`   ✅ Dokument stworzony (ID: ${createdId}).`);
        
        // KROK 3: WYMUSZENIE PATCH (DRUGI COMMIT) - Najbardziej prawdopodobne rozwiązanie Twojego problemu
        console.log("2. Wymuszanie PATCH/Commit (Reset metadanych publikacji)...");
        await adminClient
          .patch(createdId)
          .set({ 
              // Drobna zmiana, która wymusi nowy stan publikacji
              last_import_status: 'test-ok' 
          })
          .commit();
        console.log("   ✅ Patch zatwierdzony.");

        // Opóźnienie (na wszelki wypadek, choć useCdn: false)
        console.log("   Czekam 2 sekundy...");
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // KROK 4: WERYFIKACJA BEZ TOKENA (GŁÓWNY TEST)
        console.log("\n3. Weryfikacja dostępu (BEZ TOKENA, useCdn: false)...");
        const query = `*[_id == $id][0]`;
        const result = await publicClient.fetch(query, { id: createdId });

        if (result) {
            console.log(`   🎉 BEZ Tokena: Dokument JEST WIDOCZNY! (Test pozytywny)`);
        } else {
            console.log(`   ❌ BEZ Tokena: Dokument NIE JEST WIDOCZNY! (Test negatywny)`);
            console.log(`   WYNIK: Potwierdzamy, że problem jest niezależny od kodu importu.`);
        }

    } catch (error) {
        console.error("\n💥 Wystąpił błąd w trakcie testu:", error instanceof Error ? error.message : String(error));
    } finally {
        // KROK 5: CZYSZCZENIE
        // if (createdId) {
        //     console.log("\n4. Sprzątanie: Usuwanie testowego dokumentu...");
        //     try {
        //         await adminClient.delete(createdId);
        //         console.log(`   ✅ Dokument ${createdId} został pomyślnie usunięty.`);
        //     } catch (e) {
        //         console.error(`   ⚠️ Błąd podczas usuwania dokumentu ${createdId}. Musisz usunąć go manualnie.`);
        //     }
        // }
    }
    console.log(`\n--- KONIEC TESTU ---\n`);
}

runTest();