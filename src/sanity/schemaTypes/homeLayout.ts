import { defineField, defineType } from 'sanity'
import { HomeIcon } from '@sanity/icons'

/*
 * Układ strony głównej — JEDEN dokument (`_id: "homeLayout"`), edytowany
 * w panelu: Marketing → Strona główna (/admin/home). W Studio schowany
 * (structure.ts), bo reguły karuzel (źródło, kolejność, filtry, przypięte
 * produkty) wygodnie ustawia się tylko w panelu z podglądem.
 * Typy i walidacja: src/lib/homeLayout.ts.
 */
export const homeLayoutType = defineType({
  name: 'homeLayout',
  title: 'Strona główna (układ)',
  type: 'document',
  icon: HomeIcon,
  fields: [
    defineField({
      name: 'sections',
      title: 'Sekcje',
      type: 'array',
      of: [
        {
          type: 'object',
          name: 'homeSection',
          fields: [
            { name: 'key', type: 'string' },
            { name: 'kind', type: 'string' },
            { name: 'enabled', type: 'boolean' },
            { name: 'title', type: 'string' },
            { name: 'subtitle', type: 'string' },
            { name: 'source', type: 'string' },
            {
              name: 'ref',
              type: 'object',
              fields: [
                { name: 'id', type: 'string' },
                { name: 'title', type: 'string' },
                { name: 'slug', type: 'string' },
              ],
            },
            { name: 'productIds', type: 'array', of: [{ type: 'string' }] },
            { name: 'pinnedIds', type: 'array', of: [{ type: 'string' }] },
            { name: 'excludedIds', type: 'array', of: [{ type: 'string' }] },
            { name: 'order', type: 'string' },
            { name: 'onlyFeatured', type: 'boolean' },
            { name: 'onlyBestseller', type: 'boolean' },
            { name: 'onlyInStock', type: 'boolean' },
            { name: 'onlyDiscounted', type: 'boolean' },
            { name: 'limit', type: 'number' },
            { name: 'showMoreLink', type: 'boolean' },
          ],
          preview: { select: { title: 'title', subtitle: 'kind' } },
        },
      ],
    }),
  ],
})
