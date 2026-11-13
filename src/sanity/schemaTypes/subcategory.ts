import { defineType, defineField } from "sanity";
import { metaFields, seoContentField } from "./seoContent";

export default defineType({
  name: "subcategory",
  title: "Subcategory",
  type: "document",
  fields: [
    defineField({ name: "title", title: "Title", type: "string", validation: (Rule) => Rule.required() }),
    defineField({ name: "slug", title: "Slug", type: "slug", options: { source: "title" } }),
    defineField({ name: 'description', type: 'text', rows: 2, title: 'Opis (nagłówek listingu)', description: 'Krótkie zdanie wyświetlane dużą czcionką na górze strony subkategorii.' }),
    seoContentField(),
    ...metaFields(),
    defineField({ name: 'availableFilters', type: 'array', of: [{type: 'reference',to: [{ type: 'filter' }],},], title: 'Available filters' }),

    defineField({
      name: "parent",
      title: "Parent category",
      type: "reference",
      to: [{ type: "category" }],
    }),
    defineField({
      name: 'menuHidden',
      title: 'Ukryj w menu sklepu',
      type: 'boolean',
      description: 'Podkategoria znika z menu, z pigułek na stronie kategorii i z kafelków na stronie głównej. Jej strona nadal działa pod swoim adresem.',
    }),
    defineField({
      name: 'menuOrder',
      title: 'Kolejność w menu',
      type: 'number',
      description: 'Ustawiana w panelu (Produkty → Menu sklepu). Mniejsza liczba = wcześniej; puste = na końcu.',
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
  orderings: [
    { title: 'Kolejność w menu', name: 'menuOrder', by: [{ field: 'menuOrder', direction: 'asc' }, { field: 'title', direction: 'asc' }] },
    { title: 'Nazwa', name: 'title', by: [{ field: 'title', direction: 'asc' }] },
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
