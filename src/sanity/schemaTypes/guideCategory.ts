import { defineField, defineType } from 'sanity'

/**
 * Kategoria poradnika (Żywienie, Szkolenie, Pielęgnacja, Zdrowie...).
 *
 * Celowo NIE jest to `category` używana w sklepie — tamta buduje menu i ścieżki
 * /subcategory/*, a poradniki żyją poza drzewem produktów. Wspólny typ oznaczałby,
 * że każda nowa kategoria poradnika natychmiast wyskakuje w menu sklepu jako pusta
 * kategoria produktowa (dokładnie ten problem miały "Poradniki" wpięte w `category`).
 */
export default defineType({
  name: 'guideCategory',
  title: 'Kategoria poradnika',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Nazwa',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Adres URL (slug)',
      description: 'Używany w filtrze na /poradniki — np. "zywienie".',
      type: 'slug',
      options: { source: 'title', maxLength: 96 },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Krótki opis',
      type: 'text',
      rows: 2,
    }),
    defineField({
      name: 'order',
      title: 'Kolejność',
      description: 'Niższa liczba = wcześniej na liście filtrów.',
      type: 'number',
      initialValue: 100,
    }),
  ],
  orderings: [
    {
      title: 'Kolejność na liście',
      name: 'orderAsc',
      by: [{ field: 'order', direction: 'asc' }],
    },
  ],
  preview: {
    select: { title: 'title', subtitle: 'slug.current' },
  },
})
