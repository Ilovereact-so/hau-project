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

const TEST_DOCUMENT_ID = 'test-public-read-optionlist';
const DOC_TYPE = 'optionList'; // Typ dokumentu z Twojego schematu

if (!PROJECT_ID || !DATASET || !WRITE_TOKEN) {
    console.log(PROJECT_ID, DATASET, WRITE_TOKEN ? '(token ustawiony)' : '(brak tokena)');
    console.error("Błąd: Ustaw zmienne środowiskowe SANITY_PROJECT_ID, SANITY_DATASET i SANITY_WRITE_TOKEN.");
    process.exit(1);
}

/**
 * Konfiguruje klienta Sanity
 * @param useToken Czy klient ma używać tokena (odczyt/zapis)
 * @param useCdn Czy ma używać CDN (tylko dla klienta publicznego)
 */
function getClient(useToken: boolean, useCdn: boolean): SanityClient {
    return createClient({
        projectId: PROJECT_ID!,
        dataset: DATASET!,
        apiVersion: API_VERSION,
        useCdn: useToken ? false : useCdn, // Używaj useCdn tylko w kliencie publicznym, z tokenem zawsze false
        token: useToken ? WRITE_TOKEN : undefined,
    });
}

async function runTest() {
    console.log(`--- Test Dostępu Publicznego do Dokumentu Sanity ---`);
    console.log(`ID Dokumentu: ${TEST_DOCUMENT_ID}`);
    console.log(`Typ Dokumentu: ${DOC_TYPE}`);
    console.log(`API Version: ${API_VERSION}\n`);

    const adminClient = getClient(true, false); // Klient z tokenem (do zapisu i usuwania)
    const publicClient = getClient(false, false); // Klient BEZ tokena (używamy useCdn: false jak w Twojej konfiguracji)

    let createdId: string | null = null;
    
    try {
        // KROK 1: TWORZENIE DOKUMENTU (Z TOKENEM)
        console.log("1. Tworzenie dokumentu...");
        
        const docData = {
            _id: TEST_DOCUMENT_ID,
            _type: DOC_TYPE,
            title: 'Opcja testowa - Widoczność publiczna',
            type: 'test-public-visibility',
            slug: { _type: 'slug', current: 'test-public-read' },
            values: [{ label: 'TestValue', value: 'test' }],
            // Ustawiamy pole 'visibility', aby było zgodne z ręcznie tworzonymi (jeśli to był problem)
            visibility: 'storefront' // Spróbuj użyć 'storefront' zamiast 'published'
        };

        const createdDoc = await adminClient.create(docData);
        createdId = createdDoc._id;
        console.log(`   ✅ Dokument stworzony (ID: ${createdId}).\n`);

        // Dodatkowe opóźnienie (na wszelki wypadek, mimo useCdn: false)
        console.log("   Czekam 2 sekundy na upewnienie się, że Sanity przetworzyło publikację...");
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // KROK 2: WERYFIKACJA Z TOKENEM (SANITY CHECK)
        console.log("2. Weryfikacja dostępu (Z TOKENEM)...");
        const queryWithToken = `*[_id == $id][0]`;
        const resultWithToken = await adminClient.fetch(queryWithToken, { id: createdId });
        
        if (resultWithToken) {
            console.log(`   ✅ Z Tokenem: Dokument jest widoczny.`);
        } else {
            console.log(`   ❌ Z Tokenem: BŁĄD. Dokument NIE jest widoczny, co jest nieprawidłowe. (Koniec testu)`);
            return;
        }

        // KROK 3: WERYFIKACJA BEZ TOKENA (GŁÓWNY TEST)
        console.log("\n3. Weryfikacja dostępu (BEZ TOKENA, useCdn: false)...");
        const queryWithoutToken = `*[_id == $id][0]`;
        const resultWithoutToken = await publicClient.fetch(queryWithoutToken, { id: createdId });

        if (resultWithoutToken) {
            console.log(`   🎉 BEZ Tokena: Dokument JEST WIDOCZNY! (Test pozytywny)`);
        } else {
            console.log(`   ❌ BEZ Tokena: Dokument NIE JEST WIDOCZNY! (Test negatywny)`);
            console.log(`   WYNIK: Potwierdzamy Twój problem. Dostęp publiczny jest blokowany, mimo że dokument istnieje i nie używasz CDN.`);
            console.log(`   ---> Wskazuje to na problem z regułami dostępu (Permissions) na poziomie projektu Sanity, a nie z kodem klienta.`);
        }

    } catch (error) {
        console.error("\n💥 Wystąpił błąd w trakcie testu:", error instanceof Error ? error.message : String(error));
    } finally {
        // KROK 4: CZYSZCZENIE (USUWANIE DOKUMENTU)
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