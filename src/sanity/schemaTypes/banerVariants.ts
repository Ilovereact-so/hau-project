import { defineType, defineField } from "sanity";

export default defineType({
    name: "banerVariants",
    title: "Baner Variants",
    type: "document",
    fields: [
        defineField({name: "title", title: "Title", type:"string", validation: (Rule) => Rule.required()}),
        defineField({ name: "slug", title: "Slug", type: "slug", options: { source: "title" } }),
        defineField({ name: "description", title: "Description", type: "array", of: [{ type: "block" }] }),
        // Przycisk banera prowadzi do strony kolekcji (/kolekcje/<slug>).
        // Słaba referencja — baner można przygotować zanim kolekcja zostanie
        // opublikowana; do tego czasu przycisk się nie wyświetla.
        defineField({
            name: "collection",
            title: "Kolekcja",
            type: "reference",
            to: [{ type: "collection" }],
            weak: true,
            description: "Po kliknięciu „Sprawdź ofertę” klient trafi na stronę z produktami tej kolekcji.",
        }),
        defineField({
            name: "ctaLabel",
            title: "Tekst przycisku",
            type: "string",
            initialValue: "Sprawdź ofertę",
            validation: (Rule) => Rule.max(40),
        }),
        defineField({ name: "imageWithAlt", title: "Image", type: "image", options: { hotspot:true }, fields: [
            defineField({
            name: 'alt',
            title: 'Alt text',
            type: 'string',
            description: 'Opis obrazu dla SEO i dostępności',
            validation: (Rule) =>
                Rule.required().error('Alt text jest wymagany'),
            }),
        ], }),
    ],
    preview: {
    select: {
      title: "title",
      alt: "imageWithAlt.alt",
      media: "imageWithAlt",
      collection: "collection.title",
    },
    prepare({ title, alt, media, collection }) {
      return {
        title: title || alt || "Brak tytułu",
        subtitle: collection ? `→ kolekcja: ${collection}` : "bez kolekcji (przycisk ukryty)",
        media,
      };
    },
  },
})