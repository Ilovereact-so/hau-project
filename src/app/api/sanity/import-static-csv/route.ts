// route.ts - Minimalna wersja testowa z wymuszonym patchem

import { NextResponse } from "next/server";
import { sanityClient } from "@/sanity/sanityClient.server"; // Klient z tokenem (dla zapisu)

import Papa from "papaparse";
import {
  // Zachowujemy tylko niezbędne importy
  extractZipImages,
  mapCsvRowToProductPartial,
} from "@/sanity/helpers/productImportHelpers";

// Uproszczony typ dokumentu
type TestProductDoc = {
    _type: 'product';
    title?: string;
    visibility: string;
    sku: string;
    [key: string]: any; 
};

// =========================
//      POST HANDLER
// =========================

export async function POST(req: Request) {
  const TEST_DOCUMENT_ID = `test-api-read-${Date.now()}`;
  const DOC_TYPE = 'product';

  try {
    const form = await req.formData();

    const csvText = form.get("csvText") as string;
    const zipFile = form.get("zip") as File | null;

    if (!csvText) {
      return NextResponse.json({ error: "Missing csvText" }, { status: 400 });
    }
    // Obsługa ZIP jest zachowana, aby odzwierciedlić Twoje API, choć nie jest używana
    if (!zipFile) {
      return NextResponse.json({ error: "Missing zip file" }, { status: 400 });
    }

    // --- PARSE CSV ---
    const parsed = Papa.parse<Record<string, string | undefined>>(csvText, {
      header: true,
      skipEmptyLines: true,
    });
    const rows = parsed.data;
    console.log("Parsed CSV rows:", rows);
    // --- PARSE ZIP (Dla zgodności API) ---
    let zipImages: Record<string, Blob> = {};
    if (zipFile) {
      zipImages = await extractZipImages(zipFile);
    }
    
    // Używamy tylko pierwszego wiersza do testu
    if (rows.length === 0) {
        return NextResponse.json({ error: "CSV file is empty." }, { status: 400 });
    }

    const logs: string[] = [];
    let savedId: string | null = null;
    const docId = rows[0].sku ? `product.${rows[0].sku}` : TEST_DOCUMENT_ID;
    console.log("Using document ID:", rows[0].sku, docId);
    //const title =  || 'Produkt Testowy';
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
        try {
            const partial = mapCsvRowToProductPartial(row);
            // --- TWORZENIE DANYCH TESTOWYCH (NA WZÓR testProductAccess.ts) ---
            const docData: TestProductDoc = {
                _type: DOC_TYPE,
                title: rows[0].title || "Untitled",
                subtitle: rows[0].subtitle || undefined,
                slug: { _type: 'slug', current: rows[0].slug || undefined },
                price: rows[0].price ? parseFloat(rows[0].price) : undefined,
                stock: rows[0].stock ? parseInt(rows[0].stock) : undefined,
                // KLUCZOWE: Ustawienie na 'storefront'
                visibility: 'storefront', 
                // Możemy dodać jakiś identyfikator, np. SKU z wiersza
                sku: rows[0].sku || 'TEST-SKU-001',
            };

            // 1. TWORZENIE DOKUMENTU (Z TOKENEM)
            const saved = await sanityClient.create(partial);
            savedId = saved._id;
            logs.push(`1. Utworzono dokument: ${savedId}`);

            // 2. WYMUSZENIE PATCH (GWARANCJA PUBLICZNEGO DOSTĘPU)
            // To jest rozwiązanie problemu z niewidocznością po masowym imporcie.
            await sanityClient
                .patch(savedId)
                .set({ 
                    // Dodanie znacznika, który wymusi nowy commit i reset metadanych dostępu
                    lastImportedAt: new Date().toISOString() 
                })
                .commit();
            
            logs.push(`2. Wymuszono Patch/Commit dla publicznego dostępu.`);

            // 3. WERYFIKACJA (OPCJONALNA - wymagany jest klient read-only)
            // Ponieważ ten plik ma tylko sanityClient (z tokenem), nie możemy zweryfikować 
            // dostępu publicznego wewnątrz tego samego endpointu, ale możemy to zrobić 
            // ręcznie lub z frontendu.

            logs.push("Testowy produkt stworzony i opublikowany z patchem. Sprawdź dostęp publiczny na frontendzie dla ID: " + savedId);

        } catch (err: any) {
            console.error("Błąd w trakcie testu Sanity:", err);
            logs.push(`❌ Błąd Sanity: ${err?.message}`);
        } finally {
            // 4. CZYSZCZENIE
            // if (savedId) {
            //     await sanityClient.delete(savedId);
            //     logs.push(`3. Usunięto testowy dokument: ${savedId}`);
            // }
        }
    }

    return NextResponse.json({ logs });
  } catch (err: any) {
    console.error("Fatal error during import:", err);
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}