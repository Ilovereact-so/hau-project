import { defineType, defineField } from "sanity";

export default defineType({
    name: "banerVariants",
    title: "Baner Variants",
    type: "document",
    fields: [
        defineField({name: "title", title: "Title", type:"string", validation: (Rule) => Rule.required()}),
        defineField({ name: "slug", title: "Slug", type: "slug", options: { source: "title" } }),
        defineField({ name: "description", title: "Description", type: "array", of: [{ type: "block" }] }),
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
    },
    prepare({ title, alt, media }) {
      return {
        title: title || alt || "Brak tytułu",
        media,
      };
    },
  },
})