import { defineField, defineType } from 'sanity'
import { StackCompactIcon } from '@sanity/icons'
import { CollectionProductsInput } from '../components/CollectionProductsInput'

/**
 * Kolekcja produktów (np. „Jesień 2026”, „Dla szczeniaka”).
 *
 * Źródło prawdy o przynależności jest JEDNO: pole `collections` w produkcie
 * (słabe referencje). Pole „Produkty w kolekcji” poniżej nie zapisuje nic
 * w dokumencie kolekcji — to panel, który dopisuje/usuwa referencję
 * w produktach. Dzięki temu dodanie produktu z poziomu kolekcji i przypisanie
 * kolekcji z poziomu produktu to ta sama operacja i nie mogą się rozjechać.
 *
 * Referencje są słabe (`weak`), bo:
 *  - produkt może wskazywać kolekcję, która istnieje tylko jako szkic
 *    (tworzona „w locie” przy dodawaniu produktu),
 *  - usunięcie kolekcji nie jest blokowane przez setki produktów.
 */
export default defineType({
  name: 'collection',
  title: 'Kolekcja',
  type: 'document',
  icon: StackCompactIcon,
  fields: [
    defineField({
      name: 'title',
      title: 'Nazwa',
      type: 'string',
      validation: (Rule) => Rule.required().max(120),
    }),
    defineField({
      name: 'slug',
      title: 'Adres (slug)',
      type: 'slug',
      description: 'Strona kolekcji: /kolekcje/<slug>. Wymagany do publikacji.',
      options: { source: 'title', maxLength: 96 },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Opis',
      type: 'text',
      rows: 3,
      validation: (Rule) => Rule.max(600),
    }),
    defineField({
      name: 'imageWithAlt',
      title: 'Zdjęcie (nagłówek strony kolekcji)',
      type: 'image',
      options: { hotspot: true },
      fields: [
        defineField({
          name: 'alt',
          title: 'Alt text',
          type: 'string',
          description: 'Opis obrazu dla SEO i dostępności',
        }),
      ],
    }),
    defineField({
      name: 'sort',
      title: 'Kolejność produktów',
      type: 'string',
      initialValue: 'newest',
      options: {
        layout: 'radio',
        list: [
          { title: 'Najnowsze', value: 'newest' },
          { title: 'Cena rosnąco', value: 'price-asc' },
          { title: 'Cena malejąco', value: 'price-desc' },
          { title: 'Alfabetycznie', value: 'title' },
        ],
      },
    }),
    defineField({
      name: 'productsManager',
      title: 'Produkty w kolekcji',
      description:
        'Dodawanie i usuwanie przypisuje kolekcję w samym produkcie (pole „Kolekcje”). Zmiana działa od razu — nie wymaga publikacji kolekcji.',
      type: 'string',
      components: { input: CollectionProductsInput },
    }),
    defineField({ name: 'metaTitle', title: 'Meta title', type: 'string' }),
    defineField({ name: 'metaDescription', title: 'Meta description', type: 'string' }),
  ],
  preview: {
    select: { title: 'title', slug: 'slug.current', media: 'imageWithAlt' },
    prepare({ title, slug, media }) {
      return {
        title: title || 'Kolekcja bez nazwy',
        subtitle: slug ? `/kolekcje/${slug}` : 'brak adresu — uzupełnij przed publikacją',
        media,
      }
    },
  },
})
