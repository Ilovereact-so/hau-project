import { defineArrayMember, defineField, defineType } from 'sanity'

/**
 * Dokument Centrum pomocy (Regulamin, Dostawa, Polityka prywatności itd.).
 *
 * Treść trzymamy jako Portable Text, a nie jako HTML/markdown, bo edytor bloków
 * Sanity potrafi sparsować WKLEJKĘ ze schowka (Word, Google Docs, strona www) i
 * zmapować ją na zdefiniowane niżej style/dekoratory. Dlatego lista `styles`,
 * `decorators` i `lists` jest tu celowo hojna — edytor przy wklejaniu potrafi
 * użyć tylko tego, co jest tu zadeklarowane. Gdyby brakowało np. `h3` albo
 * `underline`, formatowanie z Worda zostałoby po cichu spłaszczone do zwykłego
 * akapitu. Renderer po stronie strony (components/PortableTextContent.tsx)
 * mapuje 1:1 te same klucze na style wizualne sklepu.
 */
export default defineType({
  name: 'helpDocument',
  title: 'Centrum pomocy — dokument',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Tytuł',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Adres URL (slug)',
      description: 'Fragment adresu po /help/ — np. "regulamin" da /help/regulamin.',
      type: 'slug',
      options: { source: 'title', maxLength: 96 },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'lead',
      title: 'Krótki wstęp',
      description: 'Opcjonalne 1–2 zdania wyświetlane pod tytułem, nad właściwą treścią.',
      type: 'text',
      rows: 3,
    }),
    defineField({
      name: 'order',
      title: 'Kolejność',
      description: 'Niższa liczba = wyżej na liście w Centrum pomocy.',
      type: 'number',
      initialValue: 100,
    }),
    defineField({
      name: 'updatedAt',
      title: 'Data ostatniej aktualizacji',
      description: 'Pokazywana użytkownikowi pod tytułem. Przy dokumentach prawnych warto ją ustawiać ręcznie przy każdej zmianie merytorycznej.',
      type: 'date',
      options: { dateFormat: 'YYYY-MM-DD' },
    }),
    defineField({
      name: 'body',
      title: 'Treść',
      description: 'Można wkleić tekst prosto z Worda — nagłówki, pogrubienia, kursywa, listy i linki zostaną zachowane.',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'block',
          styles: [
            { title: 'Akapit', value: 'normal' },
            { title: 'Nagłówek 1', value: 'h1' },
            { title: 'Nagłówek 2', value: 'h2' },
            { title: 'Nagłówek 3', value: 'h3' },
            { title: 'Nagłówek 4', value: 'h4' },
            { title: 'Cytat', value: 'blockquote' },
          ],
          lists: [
            { title: 'Lista punktowana', value: 'bullet' },
            { title: 'Lista numerowana', value: 'number' },
          ],
          marks: {
            decorators: [
              { title: 'Pogrubienie', value: 'strong' },
              { title: 'Kursywa', value: 'em' },
              { title: 'Podkreślenie', value: 'underline' },
              { title: 'Przekreślenie', value: 'strike-through' },
              { title: 'Kod', value: 'code' },
            ],
            annotations: [
              {
                name: 'link',
                type: 'object',
                title: 'Odnośnik',
                fields: [
                  {
                    name: 'href',
                    type: 'url',
                    title: 'Adres URL',
                    // Domyślnie `url` dopuszcza tylko http/https i odrzuca ścieżki
                    // względne — a w dokumentach prawnych stale linkuje się do
                    // innych podstron sklepu ("/help/zwroty-i-reklamacje") oraz do
                    // maili. Bez tego edytor blokowałby zapis takiej wklejki.
                    validation: (Rule) =>
                      Rule.uri({
                        scheme: ['http', 'https', 'mailto', 'tel'],
                        allowRelative: true,
                      }),
                  },
                ],
              },
            ],
          },
        }),
        defineArrayMember({
          type: 'image',
          options: { hotspot: true },
          fields: [
            {
              name: 'alt',
              type: 'string',
              title: 'Tekst alternatywny',
            },
          ],
        }),
      ],
    }),
  ],
  orderings: [
    {
      title: 'Kolejność w Centrum pomocy',
      name: 'orderAsc',
      by: [{ field: 'order', direction: 'asc' }],
    },
  ],
  preview: {
    select: { title: 'title', subtitle: 'slug.current' },
  },
})
