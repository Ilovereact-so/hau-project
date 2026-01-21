import { defineType, defineField } from "sanity";

export default defineType({
  name: "subcategory",
  title: "Subcategory",
  type: "document",
  fields: [
    defineField({ name: "title", title: "Title", type: "string", validation: (Rule) => Rule.required() }),
    defineField({ name: "slug", title: "Slug", type: "slug", options: { source: "title" } }),
    defineField({ name: 'description', type: 'text', title: 'Description' }),
    defineField({ name: 'availableFilters', type: 'array', of: [{type: 'reference',to: [{ type: 'filter' }],},], title: 'Available filters' }),

    defineField({
      name: "parent",
      title: "Parent category",
      type: "reference",
      to: [{ type: "category" }],
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
  preview: { select: { title: "title", subtitle: "parent.title", media: "imageWithAlt", },
    prepare({ title, media, subtitle }) {
      return {
        title: title || "Brak tytułu",
        subtitle: subtitle,
        media,
      };
    }, },
});
