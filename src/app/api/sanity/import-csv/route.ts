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
} from "@/sanity/helpers/productImportHelpers";

// =========================
//      POST HANDLER
// =========================

export async function POST(req: Request) {
  try {
    const form = await req.formData();

    const csvText = form.get("csvText") as string;
    const zipFile = form.get("zip") as File | null;

    if (!csvText) {
      return NextResponse.json({ error: "Missing csvText" }, { status: 400 });
    }
    if (!zipFile) {
      return NextResponse.json({ error: "Missing zip file" }, { status: 400 });
    }

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
        if (slugForImages) {
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
        }
        logs.push(`Total images uploaded for product ${i + 1}: ${imageAssets.length}`);

        if (imageAssets.length) partial.images = imageAssets;

        //------------------------------------
        // 5. OPTIONS → OPTIONLIST REF
        //------------------------------------
        if (partial.options?.length) {
          for (let oi = 0; oi < partial.options.length; oi++) {
            const opt = partial.options[oi];

            const found = await sanityClient.fetch(
              `*[_type=="optionList" && (title==$t || _id==$t)][0]{_id}`,
              { t: opt.name }
            );

            if (found?._id) {
              partial.options[oi] = {
                name: opt.name,
                optionList: {
                  _type: "reference",
                  _ref: found._id,
                },
              };
            }
          }
        }

        //------------------------------------
        // 6. GENERATE VARIANTS
        //------------------------------------
        if (partial.options?.length) {
          const combos = generateVariants(partial.options);

          partial.variants = combos.map((combo: any, idx: number) => {
            const optionMap: Record<string, string> = {};

            if (combo.optionValues) {
              combo.optionValues.forEach((ov: any) => {
                optionMap[ov.optionName] = ov.value;
              });
            } else {
              for (const [k, v] of Object.entries(combo)) {
                optionMap[k] = String(v);
              }
            }

            return {
              sku: generateSkuForVariant(partial.sku, idx, optionMap),
              price: combo.price ?? partial.price,
              stock: partial.stock,
              optionValues:
                combo.optionValues ??
                Object.entries(optionMap).map(([k, v]) => ({
                  optionName: k,
                  value: v,
                })),
            };
          });
        }
        //------------------------------------
        // 6.1 ENSURE _key ON ARRAYS FOR SANITY
        //------------------------------------
        if (partial.options?.length) {
          partial.options = ensureArrayKeys(partial.options) || partial.options;
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
                `*[_type=="product" && sku==$sku][0]{_id, title}`,
                { sku: partial.sku }
            );
        if (existingProduct) {
          // ------------------------------------
          // OPCJA 1: AKTUALIZACJA (PATCH)
          // ------------------------------------
          savedId = existingProduct._id;
          
          // Aktualizujemy istniejący dokument za pomocą patch
          await sanityClient.patch(<string>savedId)
              .set(partial)
              .commit();
              

          logs.push(`Updated ${i + 1}/${rows.length}: ${savedId} (SKU: ${partial.sku}, Patched)`);

        }else {
            // ------------------------------------
            // OPCJA 2: TWORZENIE (CREATE)
            // ------------------------------------

            // Tworzymy nowy dokument (Sanity generuje _id)
            const saved = await sanityClient.create(partial);
            savedId = saved._id;

            // Uwaga: Tutaj nie potrzebujemy dodatkowego patcha, ponieważ 
            // pole lastImportedAt już wymusza publiczny commit!
            
            logs.push(`Created ${i + 1}/${rows.length}: ${savedId} (SKU: ${partial.sku}, New Auto-ID)`);
        }
      } catch (err: any) {
        console.error(err);
        logs.push(`Failed ${i + 1}/${rows.length}: ${err?.message}`);
      }
    }


    return NextResponse.json({ logs });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
