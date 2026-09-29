import { defineArrayMember, defineField, defineType } from 'sanity'
import { GUIDE_SEO_DESCRIPTION_MAX, GUIDE_SEO_TITLE_MAX } from '../../lib/guides/content'

/**
 * Poradnik — wpis blogowy sklepu (tekst + opcjonalne wideo).
 *
 * Osobny typ dokumentu, a nie kolejny `helpDocument`, bo różni się tym, czego
 * potrzebuje strona: okładką, kategorią, datą publikacji, wideo i wyróżnieniem
 * na stronie głównej. helpDocument to dokumenty formalne (regulaminy) — mają
 * trwać i być podlinkowane ze stopki, a nie rotować na liście "najnowsze".
 *
 * Lista `styles`/`decorators`/`lists` w `body` jest identyczna jak w
 * `helpDocument` — to nie przypadek: renderer (PortableTextContent) mapuje
 * dokładnie te klucze, a edytor Sanity przy WKLEJANIU z Worda/Google Docs
 * potrafi użyć wyłącznie tego, co jest tu zadeklarowane. Dopisując nowy styl
 * trzeba go dodać RÓWNIEŻ w rendererze, inaczej spłaszczy się do akapitu.
 */
export default defineType({
  name: 'guide',
  title: 'Poradnik',
  type: 'document',
  groups: [
    { name: 'content', title: 'Treść', default: true },
    { name: 'media', title: 'Okładka i wideo' },
    { name: 'meta', title: 'Publikacja' },
    { name: 'seo', title: 'SEO' },
  ],
  fields: [
    defineField({
      name: 'title',
      title: 'Tytuł',
      type: 'string',
      group: 'content',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Adres URL (slug)',
      description: 'Fragment adresu po /poradniki/ — np. "jak-nauczyc-psa-aportu".',
      type: 'slug',
      group: 'content',
      options: { source: 'title', maxLength: 96 },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'excerpt',
      title: 'Krótki opis (zajawka)',
      description:
        '1–2 zdania. Pokazywane na kafelku poradnika, w module na stronie głównej i jako opis strony w Google. Do 200 znaków.',
      type: 'text',
      rows: 3,
      group: 'content',
      validation: (Rule) => Rule.required().max(200),
    }),
    defineField({
      name: 'category',
      title: 'Kategoria',
      type: 'reference',
      group: 'content',
      to: [{ type: 'guideCategory' }],
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'coverImage',
      title: 'Okładka',
      description:
        'Zdjęcie na kafelku i na górze wpisu. Najlepiej poziome, w proporcji zbliżonej do 16:9 (np. 1600×900 px).',
      type: 'image',
      group: 'media',
      options: { hotspot: true },
      fields: [
        defineField({
          name: 'alt',
          title: 'Tekst alternatywny',
          type: 'string',
          description: 'Opis obrazu dla SEO i czytników ekranu.',
          validation: (Rule) => Rule.required().error('Tekst alternatywny jest wymagany'),
        }),
      ],
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'heroVideo',
      title: 'Film otwierający',
      description:
        'Opcjonalny. Jeśli ustawisz, na górze wpisu zamiast okładki pojawi się odtwarzacz, a kafelek poradnika dostanie znaczek "wideo".',
      type: 'videoEmbed',
      group: 'media',
    }),
    defineField({
      name: 'body',
      title: 'Treść',
      description:
        'Można wkleić tekst prosto z Worda — nagłówki, pogrubienia, kursywa, listy i linki zostaną zachowane. Zdjęcia i filmy wstawiaj przyciskiem "+" w edytorze.',
      type: 'array',
      group: 'content',
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
                    // Tak samo jak w helpDocument: domyślny walidator `url` odrzuca
                    // ścieżki względne, a w poradnikach non stop linkuje się do
                    // produktów i kategorii sklepu ("/subcategory/...").
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
            {
              name: 'caption',
              type: 'string',
              title: 'Podpis pod zdjęciem',
              description: 'Opcjonalny. Bez podpisu pod zdjęciem nic się nie wyświetla (tekst alternatywny jest tylko dla czytników ekranu i Google).',
            },
          ],
        }),
        defineArrayMember({ type: 'videoEmbed' }),
        // Bloki z guideBlocks.ts — ramka, polecane produkty, separator.
        defineArrayMember({ type: 'callout' }),
        defineArrayMember({ type: 'productEmbed' }),
        defineArrayMember({ type: 'divider' }),
      ],
    }),
    defineField({
      name: 'author',
      title: 'Autor',
      type: 'string',
      group: 'meta',
      initialValue: 'Zespół HAU',
    }),
    defineField({
      name: 'publishedAt',
      title: 'Data publikacji',
      description:
        'Decyduje o kolejności na liście i w module "najnowsze" na stronie głównej. Data z przyszłości ukrywa poradnik do tego momentu.',
      type: 'datetime',
      group: 'meta',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'readingTime',
      title: 'Czas czytania (minuty)',
      description:
        'Zostaw puste — wtedy liczymy automatycznie z długości treści. Wypełnij tylko, gdy chcesz wymusić własną wartość.',
      type: 'number',
      group: 'meta',
      validation: (Rule) => Rule.min(1).max(120),
    }),
    defineField({
      name: 'featured',
      title: 'Wyróżniony',
      description: 'Wyróżnione poradniki trafiają na górę listy /poradniki jako duży kafelek.',
      type: 'boolean',
      group: 'meta',
      initialValue: false,
    }),
    defineField({
      name: 'seoTitle',
      title: 'Tytuł SEO',
      description:
        'Opcjonalny. Tytuł w wynikach Google i przy udostępnianiu linku, gdy ma być inny (zwykle krótszy) niż tytuł wpisu. Do sklepu dokleja się „ — HAU”.',
      type: 'string',
      group: 'seo',
      validation: (Rule) => Rule.max(GUIDE_SEO_TITLE_MAX),
    }),
    defineField({
      name: 'seoDescription',
      title: 'Opis SEO',
      description: `Opcjonalny. Pusty = zajawka. Google pokazuje ok. ${GUIDE_SEO_DESCRIPTION_MAX} znaków.`,
      type: 'text',
      rows: 3,
      group: 'seo',
      validation: (Rule) => Rule.max(GUIDE_SEO_DESCRIPTION_MAX),
    }),
  ],
  orderings: [
    {
      title: 'Najnowsze',
      name: 'publishedAtDesc',
      by: [{ field: 'publishedAt', direction: 'desc' }],
    },
    {
      title: 'Najstarsze',
      name: 'publishedAtAsc',
      by: [{ field: 'publishedAt', direction: 'asc' }],
    },
  ],
  preview: {
    select: {
      title: 'title',
      category: 'category.title',
      publishedAt: 'publishedAt',
      media: 'coverImage',
    },
    prepare({ title, category, publishedAt, media }) {
      const date = publishedAt
        ? new Date(publishedAt).toLocaleDateString('pl-PL', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })
        : 'bez daty'
      return {
        title: title || 'Bez tytułu',
        subtitle: [category, date].filter(Boolean).join(' · '),
        media,
      }
    },
  },
})
