import { defineArrayMember, defineField, defineType } from 'sanity'
import { CALLOUT_TONES, CALLOUT_TONE_LABELS, DIVIDER_STYLES, DIVIDER_STYLE_LABELS } from '../../lib/guides/content'

/*
 * Dodatkowe bloki treści poradnika (poza tekstem, zdjęciem i filmem).
 *
 * Każdy z nich ma trzy „połówki”, które muszą się zgadzać:
 *   1. ten schemat (Studio i walidacja danych),
 *   2. edytor w panelu admina (components/admin/blog/editor),
 *   3. renderer sklepu (components/guides/GuideBody.tsx).
 * Lista dozwolonych wartości (tony ramek, style separatora) siedzi w
 * `lib/guides/content.ts` — jedno źródło dla wszystkich trzech.
 */

/** Ramka wyróżniająca: wskazówka, informacja, ostrzeżenie, ważne. */
export const calloutBlock = defineType({
  name: 'callout',
  title: 'Ramka (wskazówka / uwaga)',
  type: 'object',
  fields: [
    defineField({
      name: 'tone',
      title: 'Rodzaj',
      type: 'string',
      options: {
        list: CALLOUT_TONES.map((value) => ({ value, title: CALLOUT_TONE_LABELS[value] })),
        layout: 'radio',
        direction: 'horizontal',
      },
      initialValue: 'tip',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'title',
      title: 'Nagłówek ramki',
      description: 'Opcjonalny. Pusty = domyślny podpis rodzaju („Wskazówka”, „Uwaga”…).',
      type: 'string',
      validation: (Rule) => Rule.max(120),
    }),
    defineField({
      name: 'text',
      title: 'Treść',
      type: 'text',
      rows: 4,
      validation: (Rule) => Rule.required().max(1500),
    }),
  ],
  preview: {
    select: { tone: 'tone', title: 'title', text: 'text' },
    prepare({ tone, title, text }) {
      const label = CALLOUT_TONE_LABELS[tone as keyof typeof CALLOUT_TONE_LABELS] ?? 'Ramka'
      return { title: title || label, subtitle: text }
    },
  },
})

/** Polecane produkty wstawione w środek artykułu (kafelki z ceną i linkiem). */
export const productEmbedBlock = defineType({
  name: 'productEmbed',
  title: 'Polecane produkty',
  type: 'object',
  fields: [
    defineField({
      name: 'title',
      title: 'Nagłówek sekcji',
      description: 'Opcjonalny — np. „Produkty z tego poradnika”.',
      type: 'string',
      validation: (Rule) => Rule.max(120),
    }),
    defineField({
      name: 'products',
      title: 'Produkty',
      description: 'Od 1 do 4 produktów. Produkt wycofany ze sklepu po prostu zniknie z ramki.',
      type: 'array',
      // Słabe referencje (jak w kolekcjach): usunięcie produktu nie blokuje
      // się przez to, że jakiś poradnik go poleca.
      of: [defineArrayMember({ type: 'reference', to: [{ type: 'product' }], weak: true })],
      validation: (Rule) => Rule.required().min(1).max(4).unique(),
    }),
  ],
  preview: {
    select: { title: 'title', p0: 'products.0.title', p1: 'products.1.title' },
    prepare({ title, p0, p1 }) {
      return { title: title || 'Polecane produkty', subtitle: [p0, p1].filter(Boolean).join(', ') }
    },
  },
})

/** Separator sekcji. Obiekt w Sanity musi mieć co najmniej jedno pole — stąd styl. */
export const dividerBlock = defineType({
  name: 'divider',
  title: 'Separator',
  type: 'object',
  fields: [
    defineField({
      name: 'style',
      title: 'Wygląd',
      type: 'string',
      options: {
        list: DIVIDER_STYLES.map((value) => ({ value, title: DIVIDER_STYLE_LABELS[value] })),
        layout: 'radio',
        direction: 'horizontal',
      },
      initialValue: 'line',
    }),
  ],
  preview: {
    select: { style: 'style' },
    prepare({ style }) {
      return { title: 'Separator', subtitle: DIVIDER_STYLE_LABELS[style as keyof typeof DIVIDER_STYLE_LABELS] ?? '' }
    },
  },
})
