import { NextResponse } from "next/server";
import { sanityClient } from "@/sanity/sanityClient.server";

import Papa from "papaparse";
import {
  splitList,
  mapCsvRowToProductPartial,
  generateVariants,
  generateSkuForVariant,
  ensureArrayKeys,

  // NOWE HELPERY ZIP
  extractZipImages,
  normalizeSlugForImages,
  matchZipImagesToSlug,
  parseFilterValues,
  parseCollectionNames,
} from "@/sanity/helpers/productImportHelpers";
import { buildCollectionRefs, ensureCollectionsByName } from "@/lib/admin/collections";

// audyt hurtowych importów (panela admina): zapisuj statystyki do import_jobs
import { db } from "@/lib/db";
import { importJobs } from "@/db/schema";
import { adminDenied } from "@/lib/admin/guard";
import { invalidateCatalogCache } from "@/lib/admin/catalog";
import { auth } from "@clerk/nextjs/server";
import { recordPriceChanges } from "@/lib/priceHistory";

// =========================
//      POST HANDLER
// =========================

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  // Trasa zapisuje do Sanity tokenem z uprawnieniami zapisu — wyłącznie dla admina.
  // (Middleware przepuszcza /api/sanity/* bez logowania, więc kontrola musi być tutaj.)
  const denied = await adminDenied();
  if (denied) {
    return NextResponse.json({ error: denied.error }, { status: denied.status });
  }
  const { userId } = await auth();

  try {
    const form = await req.formData();

    const csvText = form.get("csvText") as string;
    const zipEntry = form.get("zip");
    const zipFile = zipEntry instanceof File && zipEntry.size > 0 ? zipEntry : null;
    const csvName = String(form.get("csvName") ?? "").slice(0, 200);

    // tryb walidacji bez zapisu (panela admina: sucha próba przed właściwym importem)
    const dryRun = form.get("dryRun") === "1" || form.get("mode") === "dry-run";

    if (!csvText) {
      return NextResponse.json({ error: "Missing csvText" }, { status: 400 });
    }
    // ZIP ze zdjęciami jest OPCJONALNY — bez niego importujemy same dane.

    // --- PARSE CSV ---
    const parsed = Papa.parse<Record<string, string | undefined>>(csvText, {
      header: true,
      skipEmptyLines: true,
    });
    const rows = parsed.data;

    // --- PARSE ZIP (IF EXISTS) ---
    let zipImages: Record<string, Blob> = {};
    if (zipFile) {
      zipImages = await extractZipImages(zipFile);
    }
    
    const logs: string[] = [];
    // Produkty zapisane w tym imporcie — do rejestru cen po zakończeniu.
    const importedIds = new Set<string>();
    let savedId: string | null = null;

    // =========================
    //    MAIN IMPORT LOOP
    // =========================
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      try {
        //------------------------------------
        // 1. MAP CSV → INTERNAL PRODUCT MODEL
        //------------------------------------
        const partial = mapCsvRowToProductPartial(row);

        //------------------------------------
        // 2. RESOLVE CATEGORY REF
        //------------------------------------
        if (row.category_slug) {
          const category = await sanityClient.fetch(
            `*[_type=="category" && slug.current==$slug][0]{_id}`,
            { slug: row.category_slug }
          );
          if (category?._id) {
            partial.category = {
              _type: "reference",
              _ref: category._id,
            };
          }
        }
        // 2b. RESOLVE SUBCATEGORY REF (type -> reference)
        if (row.type) {
          const subcategory = await sanityClient.fetch(
            `*[_type=="subcategory" && slug.current==$slug][0]{_id}`,
            { slug: row.type }
          );

          if (subcategory?._id) {
            partial.type = {
              _type: "reference",
              _ref: subcategory._id,
            };
          } else {
            logs.push(`SUBCATEGORY NOT FOUND for slug: ${row.type}`);
          }
        }



        // 2c. KOLEKCJE (opcjonalnie) — brakujące powstają jako SZKIC kolekcji.
        // Pusta komórka nie zmienia kolekcji produktu; przy aktualizacji
        // kolekcje z CSV są DOKŁADANE do już przypisanych (nic nie znika).
        const collectionNames = parseCollectionNames(row);
        let collectionIds: string[] = [];
        if (collectionNames.length) {
          const { ids, created } = await ensureCollectionsByName(collectionNames, { dryRun });
          collectionIds = ids;
          if (created.length) {
            logs.push(`${dryRun ? "[dry-run] Utworzono by" : "Utworzono"} szkic kolekcji: ${created.join(", ")}`);
          }
        }

        //------------------------------------
        // 3. IMAGES FROM ZIP (IF PRESENT)
        //------------------------------------
        function makeImageDoc(
          assetId: string,
          baseLabel: string,
          index: number
        ) {
          const label = index === 0 ? baseLabel : `${baseLabel} (${index + 1})`;

          return {
            _type: "image",
            _key: `${assetId}-${index}`,               // unikalny key
            asset: { _type: "reference", _ref: assetId },
            alt: label,
            title: label,
          };
        }

        const imageAssets: any[] = [];

        const slugForImages = normalizeSlugForImages(row, partial);
        
        logs.push(`Slug for images: ${slugForImages}`);
        // w trybie dry-run NIE wysyłamy plików do Sanity (tylko raport, co by się stało)
        if (slugForImages && !dryRun) {
          const matched = matchZipImagesToSlug(zipImages, slugForImages);
          logs.push(`Matched ${matched.length} images for slug "${slugForImages}"`);
          const baseLabel =
            row.title ||
            partial.title ||
            normalizeSlugForImages(row, partial) ||
            row.sku ||
            "Product image";

          let imageIndex = 0;
          for (const file of matched) {
            const asset = await sanityClient.assets.upload("image", file.blob, {
              filename: file.filename,
            });
            
            imageAssets.push(makeImageDoc(asset._id, baseLabel, imageIndex));
            logs.push(`- Uploaded image: ${file.filename}, asset ID: ${asset._id}`);
            imageIndex++;
          }
        } else if (slugForImages) {
          const matched = matchZipImagesToSlug(zipImages, slugForImages);
          logs.push(`[dry-run] Matched ${matched.length} images (nie wgrano)`);
        }
        logs.push(`Total images uploaded for product ${i + 1}: ${imageAssets.length}`);

        if (imageAssets.length) partial.images = imageAssets;

        //------------------------------------
        // 5. OPTIONS → filterOption REF  
        //------------------------------------
    
        if(row.productOptions && row.productOptions.length > 0) {
          const optionRefs: any[] = [];
          const optionKeys = splitList(row.productOptions || '').map(opt => opt.trim()).filter(Boolean);
          for(const optKey of optionKeys) {
            const foundOption = await sanityClient.fetch(
              `*[_type=="filter" && key==$key][0]{_id}`,
              { key: optKey }
            );
            if (foundOption?._id) {
              optionRefs.push({
                _type: "reference",
                _ref: foundOption._id,
              });
            }else{
            logs.push(`FilterOption NOT FOUND for key: ${optKey}`)
          }
          }
          partial.productOptions = optionRefs;
        }
        //------------------------------------
        // 5b. FILTER VALUES → FILTERVALUE REF  
        //------------------------------------
        
        const filterValues = parseFilterValues(row);
        const filterValueRefs: any[] = [];
        for(const fv of filterValues) {
          const foundFV = await sanityClient.fetch(
            `*[_type=="filterValue" && slug.current==$fv][0]{_id}`,
            { fv }
          );
          if (foundFV?._id) {
            filterValueRefs.push({
              _type: "reference",
              _ref: foundFV._id,
            });
          }else {
            logs.push(`FilterValue NOT FOUND for slug: ${fv} of ${filterValues}`);
          }
        }
        partial.filterValues = filterValueRefs;
        //------------------------------------
        // if (partial.options?.length) {
        //   for (let oi = 0; oi < partial.options.length; oi++) {
        //     const opt = partial.options[oi];

        //     const found = await sanityClient.fetch(
        //       `*[_type=="optionList" && (title==$t || _id==$t)][0]{_id}`,
        //       { t: opt.name }
        //     );

        //     if (found?._id) {
        //       partial.options[oi] = {
        //         name: opt.name,
        //         optionList: {
        //           _type: "reference",
        //           _ref: found._id,
        //         },
        //       };
        //     }
        //   }
        // }

        //------------------------------------
        // 6. GENERATE VARIANTS
        //------------------------------------
        if (partial.options?.length) {
          const combos = generateVariants(partial.options);
          const getFilterId = async (key: string): Promise<string> => {
            const ref = await sanityClient.fetch(
              `*[_type=="filter" && key==$key][0]._id`,
              { key: key.toLowerCase() }
            );
            return ref;
          };

          const getFilterValueId = async (slug: string): Promise<string> => {
            const ref = await sanityClient.fetch(
              `*[_type=="filterValue" && slug.current==$key][0]._id`,
              { key: slug.toLowerCase() }
            );
            return ref;
          };
          partial.variants = await Promise.all(
            combos.map(async (combo: any, idx: number) => {
              const optionMap: Record<string, string> = {};

              if (combo.optionValues) {
                combo.optionValues.forEach((ov: any) => {
                  optionMap[ov.name] = ov.value;
                });
              } else {
                for (const [k, v] of Object.entries(combo)) {
                  optionMap[k] = String(v);
                }
              }

              const optionValues = await Promise.all(
                Object.entries(optionMap).map(async ([k, v]) => ({
                  label: `${k}: ${v}`,
                  name: {
                    _type: "reference",
                    _ref: await getFilterId(k),
                  },
                  value: {
                    _type: "reference",
                    _ref: await getFilterValueId(v),
                  },
                }))
              );

              return {
                sku: generateSkuForVariant(partial.sku, idx, optionMap),
                price: combo.price ?? partial.price,
                stock: partial.stock,
                optionValues,
              };
            })
          );
        }
        //------------------------------------
        // 6.1 ENSURE _key ON ARRAYS FOR SANITY
        //------------------------------------
        if (partial.filterValues?.length) {
          partial.filterValues = ensureArrayKeys(partial.filterValues) || partial.filterValues;
        }
        if (partial.productOptions?.length) {
          partial.productOptions = ensureArrayKeys(partial.productOptions) || partial.productOptions;
        }
        if (partial.variants?.length) {
          partial.variants =
            ensureArrayKeys(partial.variants) || partial.variants;
        }
        if (partial.images?.length) {
          partial.images = ensureArrayKeys(partial.images) || partial.images;
        }

        //------------------------------------
        // 7. SAVE TO SANITY
        //------------------------------------
        //const docId = partial.sku ? `product.${partial.sku}` : undefined;
        const existingProduct = await sanityClient.fetch(
                `*[_type=="product" && sku==$sku][0]{_id, title, "collectionIds": collections[]._ref}`,
                { sku: partial.sku }
            );
        if (collectionIds.length) {
          const current: string[] = Array.isArray(existingProduct?.collectionIds)
            ? existingProduct.collectionIds.filter((id: unknown): id is string => typeof id === "string")
            : [];
          partial.collections = buildCollectionRefs([...current, ...collectionIds]);
        }
        if (dryRun) {
          logs.push(`[dry-run] ${i + 1}/${rows.length}: SKU ${partial.sku} → ${existingProduct ? 'UPDATE' : 'CREATE'} (bez zapisu)`);
        } else if (existingProduct) {
          // ------------------------------------
          // OPCJA 1: AKTUALIZACJA (PATCH)
          // ------------------------------------
          savedId = existingProduct._id;
          const { options, ...payload } = partial;
          
          // Aktualizujemy istniejący dokument za pomocą patch
          await sanityClient.patch(<string>savedId)
              .set(payload)
              .commit();
              

          importedIds.add(<string>savedId);
          logs.push(`Updated ${i + 1}/${rows.length}: ${savedId} (SKU: ${partial.sku}, Patched)`);

        }else {
            // ------------------------------------
            // OPCJA 2: TWORZENIE (CREATE)
            // ------------------------------------
            const { options, ...payload } = partial;
            const saved = await sanityClient.create(payload);
            savedId = saved._id;
            importedIds.add(saved._id);

            // Uwaga: Tutaj nie potrzebujemy dodatkowego patcha, ponieważ 
            // pole lastImportedAt już wymusza publiczny commit!
            
            logs.push(`Created ${i + 1}/${rows.length}: ${savedId} (SKU: ${partial.sku}, New Auto-ID)`);
        }
      } catch (err: any) {
        console.error(err);
        logs.push(`Failed ${i + 1}/${rows.length}: ${err?.message}`);
      }
    }


    // ── audyt: zapisz statystyki do import_jobs (panela admina) ────────────────
    try {
      const okRows    = logs.filter((l) => l.startsWith('Created') || l.startsWith('Updated') || l.startsWith('[dry-run]')).length
      const failedRows = logs.filter((l) => l.startsWith('Failed') || l.startsWith('SUBCATEGORY NOT FOUND') || l.startsWith('FilterOption NOT FOUND') || l.startsWith('FilterValue NOT FOUND')).length
      await db.insert(importJobs).values({
        id:         crypto.randomUUID(),
        type:       'products',
        fileName:   [csvName || 'produkty.csv', zipFile?.name].filter(Boolean).join(' + ').slice(0, 256),
        totalRows:  rows.length,
        okRows,
        failedRows,
        status:     rows.length > 0 && okRows === 0 ? 'failed' : 'done',
        logJson:    JSON.stringify(logs),
        createdBy:  userId ?? 'admin',
        createdAt:  new Date(),
      })
    } catch (e) {
      console.error('import_jobs audit failed:', e)
    }

    if (!dryRun) {
      await invalidateCatalogCache();
      // Rejestr najniższej ceny z 30 dni — ceny z importu (nowe i zmienione).
      if (importedIds.size) await recordPriceChanges([...importedIds], "import");
    }

    return NextResponse.json({ logs });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
