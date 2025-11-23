import { TrolleyIcon } from "@sanity/icons";
import { defineField, defineType } from "sanity"; // używane w documentActions
import { sanityClient } from "../sanityClient";

/**
 * productType.ts
 * - zachowuje intro (intro) oraz subtitle (wcześniej subname)
 * - dodaje: indexedOptions, category/subcategory references
 * - dodaje documentActions:
 *    1) Generate variants -> tworzy kombinacje opcji (inline options + globalOptionLists)
 *    2) Populate indexedOptions -> tworzy tablicę stringów typu 'color:blue' na podstawie opcji/variantów
 *
 * UWAGA: akcje używają klienta sanity do patchowania dokumentu w Studio.
 * Dostosuj pola referencji (optionList、category) jeśli masz inne nazwy typów.
 */

export const productType = defineType({
  name: "product",
  title: "Product",
  type: "document",
  icon: TrolleyIcon,
  fields: [
    // Basic
    defineField({
      name: "title",
      title: "Product name",
      type: "string",
      validation: (Rule) => Rule.required().min(2).max(200),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "title", maxLength: 96 },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "subtitle",
      title: "Subtitle",
      type: "string",
      description: "Podtytuł lub krótki opis (wcześniej 'subname')",
    }),
    
    defineField({
      name: "intro",
      title: "Intro",
      type: "string",
      description: "Krótki wstęp / lead widoczny np. na listach produktów",
    }),
    
    defineField({
      name: "description",
      title: "Description",
      type: "array",
      of: [{ type: "block" }],
    }),
    defineField({
      name: "images",
      title: "Images",
      type: "array",
      of: [{ type: "image", options: { hotspot: true } }],
    }),

    // Category / Subcategory (references) — szybkie wyszukiwanie / filtrowanie
    defineField({
      name: "category",
      title: "Category",
      type: "reference",
      to: [{ type: "category" }],
      description: "Główna kategoria produktu (używana do szybkiego filtrowania)",
    }),
    defineField({
      name: "subcategory",
      title: "Subcategory",
      type: "reference",
      to: [{ type: "subcategory" }, { type: "category" }], // dopuszcza różne typy jeśli masz
      description: "Podkategoria (opcjonalnie). Przydatne do precyzyjnego wyszukiwania.",
    }),

    // Pricing & stock
    defineField({
      name: "price",
      title: "Base price (PLN)",
      type: "number",
      validation: (Rule) => Rule.required().min(0),
    }),
    defineField({
      name: "comparePrice",
      title: "Compare / Original price (optional)",
      type: "number",
    }),
    defineField({
      name: "currency",
      title: "Currency",
      type: "string",
      initialValue: "PLN",
    }),
    defineField({
      name: "sku",
      title: "Master SKU",
      type: "string",
    }),
    defineField({
      name: "stock",
      title: "Overall stock",
      type: "number",
      initialValue: 0,
    }),

    // Global option lists (references) e.g. Colors, Sizes
    defineField({
      name: "globalOptionLists",
      title: "Global option lists (references)",
      type: "array",
      of: [{ type: "reference", to: [{ type: "optionList" }] }],
      description:
        "Referencje do globalnych list opcji (np. Colors, Sizes). Pomaga utrzymać spójność w całym katalogu.",
    }),

    // Inline product-specific options
    defineField({
      name: "options",
      title: "Product options (inline overrides)",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            { name: "name", title: "Option name", type: "string" }, // e.g. 'color' or 'size'
            {
              name: "values",
              title: "Values",
              type: "array",
              of: [
                {
                  type: "object",
                  fields: [
                    { name: "label", title: "Label", type: "string" },
                    { name: "value", title: "Value", type: "string" },
                    { name: "hex", title: "HEX (optional)", type: "string" },
                    { name: "image", title: "Image (optional)", type: "image" },
                  ],
                },
              ],
            },
          ],
        },
      ],
      description:
        "Wartości specyficzne dla produktu (np. konkretne rozmiary, wzory). Nadpisują / uzupełniają globalne listy.",
    }),

    // Indexed options for fast filtering (e.g. 'color:blue', 'size:M')
    defineField({
      name: "indexedOptions",
      title: "Indexed options (for filtering/search)",
      type: "array",
      of: [{ type: "string" }],
      description:
        "Tablica prostych stringów ułatwiająca szybkie filtrowanie (np. w zapytaniach GROQ). Możesz wypełniać ręcznie lub użyć akcji 'Populate indexedOptions'.",
    }),

    // Variants
    defineField({
      name: "variants",
      title: "Variants",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            { name: "sku", title: "SKU", type: "string" },
            {
              name: "price",
              title: "Price (override, optional)",
              type: "number",
            },
            {
              name: "priceDelta",
              title: "Price delta (optional)",
              type: "number",
              description: "Alternatywa: różnica od base price.",
            },
            { name: "stock", title: "Stock", type: "number", initialValue: 0 },
            {
              name: "images",
              title: "Variant images (optional)",
              type: "array",
              of: [{ type: "image", options: { hotspot: true } }],
            },
            {
              name: "optionValues",
              title: "Option values",
              type: "array",
              of: [
                {
                  type: "object",
                  fields: [
                    { name: "optionName", title: "Option name", type: "string" }, // e.g. 'color'
                    { name: "value", title: "Value", type: "string" }, // e.g. 'blue'
                  ],
                },
              ],
              description:
                "Powiąż wariant z parą optionName/value. Muszą pasować do nazw używanych w options/globalOptionLists.",
            },
            {
              name: "weightForShipping_g",
              title: "Weight for shipping (g, optional)",
              type: "number",
            },
            {
              name: "boxDimensions",
              title: "Box dimensions (optional)",
              type: "object",
              fields: [
                { name: "width", title: "Width (cm)", type: "number" },
                { name: "length", title: "Length (cm)", type: "number" },
                { name: "height", title: "Height (cm)", type: "number" },
                { name: "unit", title: "Unit", type: "string", initialValue: "cm" },
              ],
            },
          ],
        },
      ],
    }),

    // Properties
    defineField({
      name: "properties",
      title: "Properties (informational)",
      type: "object",
      fields: [
        {
          name: "dimensions",
          title: "Dimensions",
          type: "object",
          fields: [
            { name: "width", title: "Width", type: "number" },
            { name: "length", title: "Length", type: "number" },
            { name: "height", title: "Height", type: "number" },
            { name: "unit", title: "Unit", type: "string", initialValue: "cm" },
          ],
        },
        { name: "weight_g", title: "Weight (g)", type: "number" },
        { name: "material", title: "Material", type: "string" },
        {
          name: "care",
          title: "Care instructions",
          type: "text",
          rows: 3,
        },
        { name: "isMachineWashable", title: "Machine washable", type: "boolean" },
        { name: "isWaterproof", title: "Waterproof", type: "boolean" },
      ],
    }),

    // Size chart
    defineField({
      name: "sizeChart",
      title: "Size chart",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            { name: "name", title: "Size name", type: "string" }, // XS, S, M...
            { name: "minCm", title: "Min (cm)", type: "number" },
            { name: "maxCm", title: "Max (cm)", type: "number" },
            { name: "recommendedWeightKg", title: "Recommended dog weight (kg)", type: "number" },
            { name: "notes", title: "Notes", type: "string" },
          ],
        },
      ],
    }),

    // Tags and quick flags
    defineField({
      name: "tags",
      title: "Tags",
      type: "array",
      of: [{ type: "string" }],
    }),
    defineField({
      name: "isFeatured",
      title: "Featured",
      type: "boolean",
    }),
    defineField({
      name: "isBestseller",
      title: "Bestseller",
      type: "boolean",
    }),

    // Meta: supplier, internal notes
    defineField({
      name: "supplier",
      title: "Supplier",
      type: "string",
    }),
    defineField({
      name: "internalNotes",
      title: "Internal notes",
      type: "text",
    }),

    // SEO / marketing
    defineField({
      name: "metaTitle",
      title: "Meta title",
      type: "string",
    }),
    defineField({
      name: "metaDescription",
      title: "Meta description",
      type: "text",
    }),
  ],

  preview: {
    select: {
      title: "title",
      media: "images.0",
      price: "price",
      comparePrice: "comparePrice",
      subtitle: "subtitle",
    },
    prepare(selection) {
      const { title, media, price, comparePrice, subtitle } = selection;
      const subtitlePrice =
        typeof price === "number"
          ? comparePrice && comparePrice > price
            ? `Promocja: ${price} (było ${comparePrice})`
            : `${price} PLN`
          : "Brak ceny";
      return {
        title,
        subtitle: subtitle ? `${subtitle} — ${subtitlePrice}` : subtitlePrice,
        media,
      };
    },
  },
});

/**
 * Document actions — rozszerzenia dla Studio
 * - Generate variants: tworzy kombinacje opcji bazując na inline options + globalOptionLists.values
 * - Populate indexedOptions: wypełnia pole indexedOptions (np. 'color:blue', 'size:M')
 *
 * Uwaga: te funkcje używają klienta sanity i patchują dokument w miejscu.
 * Możesz je modyfikować, by dopasować pattern SKU, priceDelta, itp.
 */

import type { DocumentActionDescription } from "sanity";

/**
 * Typ kontekstu, tak by TS wiedział co jest dostępne w `context`.
 * Dostosuj, jeśli masz dodatkowe pola.
 */
type ActionContext = {
  // Pobieramy klienta z kontekstu - wymaga auth gdy patchujemy
  getClient: (opts?: { apiVersion?: string; requireAuth?: boolean }) => any;

  // Dokument w edycji / wersja opublikowana / szkic
  document?: any;
  published?: any;
  draft?: any;

  // UI helpers
  toast: {
    push: (arg: { status?: "success" | "error" | "info"; title?: string; description?: string }) => void;
  };
  onComplete: () => void;
};

/**
 * productDocumentActions - typowana funkcja, zwraca listę akcji dokumentu
 */
export const productDocumentActions = (
  prev: DocumentActionDescription[],
  context: ActionContext
): DocumentActionDescription[] => {
  const defaultActions = prev ?? [];

  const getDocId = (): string | null =>
    context?.document?._id || context?.published?._id || context?.draft?._id || null;

  // ===== Generate variants action =====
  const generateVariantsAction: DocumentActionDescription = {
    label: "Generate variants",
    onHandle: async () => {
      const docId = getDocId();
      if (!docId) {
        context.toast.push({ status: "error", title: "Brak ID dokumentu" });
        context.onComplete();
        return;
      }

      const client = context.getClient({ apiVersion: "2023-10-01", requireAuth: true });

      try {
        const doc = await client.getDocument(docId);
        if (!doc) {
          context.toast.push({ status: "error", title: "Nie znaleziono dokumentu" });
          context.onComplete();
          return;
        }

        const optionArrays: Array<{ name: string; values: string[] }> = [];

        // globalOptionLists (referencje do optionList)
        if (Array.isArray(doc.globalOptionLists)) {
          for (const ref of doc.globalOptionLists) {
            if (!ref?._ref) continue;
            const ol = await client.getDocument(ref._ref);
            if (!ol) continue;
            const optionName = (ol.type || ol.title || "option").toString().toLowerCase();
            const vals = Array.isArray(ol.values)
              ? ol.values.map((v: any) => v.value ?? v.label).filter(Boolean)
              : [];
            if (vals.length) optionArrays.push({ name: optionName, values: vals });
          }
        }

        // inline options
        if (Array.isArray(doc.options)) {
          for (const opt of doc.options) {
            const name = (opt?.name || "option").toString().toLowerCase();
            const vals = Array.isArray(opt?.values)
              ? opt.values.map((v: any) => v.value ?? v.label).filter(Boolean)
              : [];
            if (vals.length) optionArrays.push({ name, values: vals });
          }
        }

        if (optionArrays.length === 0) {
          context.toast.push({ status: "info", title: "Brak opcji do wygenerowania wariantów" });
          context.onComplete();
          return;
        }

        // Cartesian product generator
        const cartesian = (arrays: Array<{ name: string; values: string[] }>) =>
          arrays.reduce(
            (acc, cur) => acc.flatMap((a: any) => cur.values.map((v) => ({ ...a, [cur.name]: v }))),
            [{}]
          );
        const combos = cartesian(optionArrays);

        const variants = combos.map((c: any, idx: number) => {
          const skuBase = doc.sku || (doc.slug && doc.slug.current) || "PROD";
          const sku = `${skuBase}-${idx + 1}`;
          const optionValues = Object.keys(c).map((k) => ({ optionName: k, value: c[k] }));
          return {
            _key: `${idx}-${Date.now()}`,
            sku,
            price: doc.price ?? undefined,
            stock: 0,
            optionValues,
          };
        });

        await client.patch(docId).set({ variants }).commit({ autoGenerateArrayKeys: true });

        context.toast.push({ status: "success", title: `Wygenerowano ${variants.length} wariantów` });
      } catch (err) {
        console.error("generateVariantsAction error:", err);
        context.toast.push({ status: "error", title: "Błąd podczas generowania wariantów" });
      } finally {
        context.onComplete();
      }
    },
  };

  // ===== Populate indexedOptions action =====
  const populateIndexedOptionsAction: DocumentActionDescription = {
    label: "Populate indexedOptions",
    onHandle: async () => {
      const docId = getDocId();
      if (!docId) {
        context.toast.push({ status: "error", title: "Brak ID dokumentu" });
        context.onComplete();
        return;
      }

      const client = context.getClient({ apiVersion: "2023-10-01", requireAuth: true });

      try {
        const doc = await client.getDocument(docId);
        if (!doc) {
          context.toast.push({ status: "error", title: "Nie znaleziono dokumentu" });
          context.onComplete();
          return;
        }

        const indexed: string[] = [];

        // z variants.optionValues
        if (Array.isArray(doc.variants)) {
          for (const v of doc.variants) {
            if (!Array.isArray(v.optionValues)) continue;
            for (const ov of v.optionValues) {
              if (ov?.optionName && ov?.value) {
                indexed.push(`${ov.optionName.toString().toLowerCase()}:${ov.value.toString().toLowerCase()}`);
              }
            }
          }
        }

        // z inline options
        if (Array.isArray(doc.options)) {
          for (const opt of doc.options) {
            const name = (opt?.name || "").toString().toLowerCase();
            if (!Array.isArray(opt.values)) continue;
            for (const v of opt.values) {
              const val = (v?.value || v?.label || "").toString().toLowerCase();
              if (name && val) indexed.push(`${name}:${val}`);
            }
          }
        }

        // z globalOptionLists
        if (Array.isArray(doc.globalOptionLists)) {
          for (const ref of doc.globalOptionLists) {
            if (!ref?._ref) continue;
            const ol = await client.getDocument(ref._ref);
            if (!ol) continue;
            const optionName = (ol?.type || ol?.title || "option").toString().toLowerCase();
            if (!Array.isArray(ol.values)) continue;
            for (const v of ol.values) {
              const val = (v?.value || v?.label || "").toString().toLowerCase();
              if (optionName && val) indexed.push(`${optionName}:${val}`);
            }
          }
        }

        const unique = Array.from(new Set(indexed));
        await client.patch(docId).set({ indexedOptions: unique }).commit({ autoGenerateArrayKeys: true });

        context.toast.push({ status: "success", title: `Zapisano ${unique.length} indexedOptions` });
      } catch (err) {
        console.error("populateIndexedOptionsAction error:", err);
        context.toast.push({ status: "error", title: "Błąd podczas zapisywania indexedOptions" });
      } finally {
        context.onComplete();
      }
    },
  };

  return [...defaultActions, generateVariantsAction, populateIndexedOptionsAction];
};

