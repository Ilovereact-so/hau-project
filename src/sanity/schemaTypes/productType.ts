// productType.updated.ts
// Zaktualizowana schema produktu dla Sanity (TypeScript-flavored schema file)
// Zmiany: dodano pola `subtitle`, `intro`, `category` jako reference, `options` z referencją do `optionList` + fallback inline values.
// Dodatkowo dołączone kilka przydatnych skryptów/utility (eksportowane) do generowania wariantów, normalizacji wartości i parsowania CSV.

import { TrolleyIcon } from "@sanity/icons";
import { ImageVariantsInput } from "../components/ImageVariantsInput";

const productType = {
  name: "product",
  title: "Product",
  type: "document",
  icon: TrolleyIcon,
  fields: [
    { name: "title", title: "Title", type: "string", validation: (Rule: any) => Rule.required() },
    { name: "subtitle", title: "Subtitle", type: "string", description: "Krótki podtytuł wyświetlany pod tytułem produktu" },
    { name: "intro", title: "Intro", type: "text", description: "Krótki wstęp/lead dla produktu (pokazywany na listingach)", rows: 3 },

    { name: "sku", title: "SKU", type: "string", description: "Unikalny kod produktu — przy imporcie używany jako źródłowy identyfikator" },
    { name: "slug", title: "Slug", type: "slug", options: { source: "title", maxLength: 96 } },

    { name: "shortDescription", title: "Short description", type: "text" },
    { name: "description", title: "Description", type: "array", of: [{ type: "block" },{ type: 'image', options: { hotspot: true } }] },

    // Pricing
    {
      name: "price",
      title: "Price",
      type: "number",
      description: "Cena sprzedaży brutto. Każda zmiana po publikacji trafia do historii cen — sklep sam wylicza najniższą cenę z 30 dni i obniżkę.",
    },
    { name: "currency", title: "Currency", type: "string", initialValue: "PLN" },
    // Wycofane: obniżkę i cenę sprzed obniżki (najniższą z 30 dni) sklep
    // wylicza sam z rejestru cen (src/lib/priceHistory.ts). Pole zostaje, żeby
    // nie gubić starych danych, ale jest tylko do odczytu i ukryte, gdy puste.
    {
      name: "compareAtPrice",
      title: "Compare at price (nieużywane)",
      type: "number",
      readOnly: true,
      hidden: ({ value }: { value?: number }) => value === undefined || value === null,
      description: "Nieużywane. Obniżkę wpisz jako nową cenę — sklep sam pokaże najniższą cenę z 30 dni przed obniżką.",
    },

    // Stock / visibility
    { name: "stock", title: "Stock", type: "number" },
    { name: "visibility", title: "Visibility", type: "string", options: { list: ["draft", "published", "storefront"] }, initialValue: "published" },

    // Category as reference (tak jak w orginale) — załóżmy, że masz typ dokumentu `category`
    {
      name: "category",
      title: "Category",
      type: "reference",
      to: [{ type: "category" }],
      description: "Referencja do dokumentu kategorii (używana w filtrach i breadcrumbach)."
    },

    { name: "type", title: "Subcategory", type: "reference", to: [{ type: "subcategory" }] },

    // Kolekcje (opcjonalnie). Słabe referencje: przy dodawaniu produktu można
    // wskazać kolekcję, której jeszcze nie ma — „Create new” w polu tworzy ją
    // jako szkic, a produkt i tak się zapisze (patrz schemaTypes/collection.ts).
    {
      name: "collections",
      title: "Kolekcje",
      type: "array",
      description: "Opcjonalnie. Brakującą kolekcję utworzysz przyciskiem „Create new” — powstanie jako szkic.",
      of: [{ type: "reference", to: [{ type: "collection" }], weak: true }],
      validation: (Rule: any) => Rule.unique(),
    },
    { name: "brand", title: "Brand", type: "string" },
    { name: "vendor", title: "Vendor", type: "string" },

    { name: "tags", title: "Tags", type: "array", of: [{ type: "string" }] },

    // Images with alt + position
    {
      name: "images",
      title: "Images",
      type: "array",
      of: [
        {
          type: "image",
          fields: [
            { name: "alt", type: "string", title: "Alt text" },
            { name: "position", type: "number", title: "Position" },
            {
              // `_key` wariantów, do których należy zdjęcie (może być kilka).
              // Puste = zdjęcie wspólne. Logika: src/lib/variantImages.ts.
              name: "variantKeys",
              title: "Warianty",
              description: "Zaznacz warianty, przy których ma się pokazywać to zdjęcie. Nic nie zaznaczone = zdjęcie wspólne.",
              type: "array",
              of: [{ type: "string" }],
              components: { input: ImageVariantsInput },
            },
          ],
          preview: {
            select: { media: "asset", alt: "alt", keys: "variantKeys" },
            prepare({ media, alt, keys }: { media?: unknown; alt?: string; keys?: string[] }) {
              return {
                media: media as never,
                title: alt || "Zdjęcie",
                subtitle: keys?.length ? `Warianty: ${keys.length}` : "Wspólne",
              }
            },
          },
        }
      ]
    },

    // Dimensions / properties
    {
      name: "dimensions",
      title: "Dimensions",
      type: "object",
      fields: [
        { name: "width_cm", title: "Width (cm)", type: "number" },
        { name: "height_cm", title: "Height (cm)", type: "number" },
        { name: "depth_cm", title: "Depth (cm)", type: "number" },
        { name: "unit", title: "Unit", type: "string", initialValue: "cm" },
      ]
    },
    { name: "weight_g", title: "Weight (g)", type: "number" },
    { name: "shipping_weight_g", title: "Shipping weight (g)", type: "number" },

    { name: "material", title: "Material", type: "string" },
    { name: "care", title: "Care / washing instructions", type: "text" },

    // Booleans
    { name: "isMachineWashable", title: "Machine washable", type: "boolean" },
    { name: "isWaterproof", title: "Is waterproof", type: "boolean" },
    { name: "isFeatured", title: "Is featured", type: "boolean" },
    { name: "isBestseller", title: "Is bestseller", type: "boolean" },
    
    // Options | filterValues

    { name: 'filterValues', type: 'array', of: [{type: 'reference', to: [{ type: 'filterValue' }],},], title: 'Filter values' },
    { name: 'productOptions', type: 'array', of: [{type: 'reference',to: [{ type: 'filter' }],},], title: 'Option Reference to filter data' },
    
    // {
    // name: 'productOptions',
    // type: 'document',
    // fields: [
    //   { name: 'key', type: 'string' }, // size, color
    //   { name: 'label', type: 'string' },
    // ],
    // },
    // {
    //   name: "options",
    //   title: "Options",
    //   type: "array",
    //   of: [
    //     {
    //       type: "object",
    //       name: "productOption",
    //       fields: [
    //         { name: "name", title: "Name", type: "string", description: "Human friendly option name, np. Size, Color" },
    //         {
    //           name: "optionList",
    //           title: "Option list reference",
    //           type: "reference",
    //           to: [{ type: "optionList" }],
    //           description: "Jeżeli wartość pochodzi z globalnej listy opcji (optionList), zreferuj ją tutaj."
    //         },
    //         {
    //           name: "values",
    //           title: "Values (inline fallback)",
    //           type: "array",
    //           of: [
    //             {
    //               type: "object",
    //               fields: [
    //                 { name: "label", title: "Label", type: "string" },
    //                 { name: "value", title: "Value", type: "string" },
    //                 { name: "image", title: "Image for value", type: "image" }
    //               ]
    //             }
    //           ],
    //           description: "Warości inline jeżeli nie korzystasz z optionList. Importer potrafi wypełnić zarówno optionList jak i wartości inline." 
    //         }
    //       ]
    //     }
    //   ]
    // },

    // Variants — strukturę zostawiamy elastyczną, importer wygeneruje z options
    {
      name: "variants",
      title: "Variants",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            { name: "sku", title: "SKU", type: "string" },
            { name: "price", title: "Price (optional)", type: "number" },
            { name: "stock", title: "Stock (optional)", type: "number" },
            {
              name: "optionValues",
              title: "Option values",
              type: "array",
              of: [
                {
                  type: "object",
                  fields: [
                    { name: "name", title: "Name", type: 'reference', to: [{ type: 'filter' }], },
                    { name: "value", title: "Value", type: 'reference', to: [{ type: 'filterValue' }], },
                    // 👇 TYLKO DO UI
                    { name: "label", type: "string", readOnly: true, hidden: true, },
                  ]
                }
              ],
              preview: {
                select: { title: "label" },
              },
            },
            { name: "indexedOptions", title: "Indexed options", type: "array", of: [{ type: "string" }] },
            {
              name: "dimensions",
              title: "Variant dimensions",
              type: "object",
              fields: [
                { name: "width_cm", title: "Width (cm)", type: "number" },
                { name: "height_cm", title: "Height (cm)", type: "number" },
                { name: "depth_cm", title: "Depth (cm)", type: "number" }
              ]
            },
            { name: "weight_g", title: "Weight (g)", type: "number" }
          ]
        }
      ]
    },

    // Helpers
    { name: "indexedOptions", title: "Indexed options (flat)", type: "array", of: [{ type: "string" }], readOnly: true },
    // SEO
    { name: "metaTitle", title: "Meta title", type: "string" },
    { name: "metaDescription", title: "Meta description", type: "string" },

    // Logistics / external refs
    { name: "barcode", title: "Barcode / EAN / UPC", type: "string" },
    { name: "externalId", title: "External ID (CSV import id)", type: "string", description: "Optional ID from upstream system / CSV to avoid duplicates" },
    { name: "sourceCSV", title: "Imported from CSV", type: "string", readOnly: true },

    { name: "chew_strength", title: "Chew strength", type: "string", options: { list: ["light", "medium", "heavy"] } }
  ],

  preview: {
    select: {
      title: 'title',
      subtitle: 'subtitle',
      sku: 'sku',
      media: 'images.0.asset',
      price: 'price',
    },
    prepare(selection: any) {
      const { title, subtitle, sku, media } = selection

      return {
        title: title || 'Brak tytułu',
        subtitle: sku
          ? `${sku}${subtitle ? ` · ${subtitle}` : ''}`
          : subtitle || '',
        media,
      }
    },
  }
};

export default productType;



