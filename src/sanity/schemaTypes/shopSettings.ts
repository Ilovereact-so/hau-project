import { defineField, defineType } from 'sanity'
import { CogIcon } from '@sanity/icons'

/*
 * Ustawienia sklepu — JEDEN dokument (`_id: "shopSettings"`), edytowany
 * w panelu: Dostawy (/admin/shipping). Sklep czyta go publicznie (koszyk,
 * kasa), serwer liczy z niego koszt dostawy w zamówieniu.
 * Logika progu: src/lib/shopSettings.ts.
 */
export const shopSettingsType = defineType({
  name: 'shopSettings',
  title: 'Ustawienia sklepu',
  type: 'document',
  icon: CogIcon,
  fields: [
    defineField({
      name: 'freeShippingEnabled',
      title: 'Darmowa dostawa od kwoty',
      type: 'boolean',
      initialValue: false,
    }),
    defineField({
      name: 'freeShippingThreshold',
      title: 'Próg darmowej dostawy (zł)',
      type: 'number',
      description: 'Liczony od wartości produktów w koszyku (przed kodem rabatowym).',
      validation: (Rule) => Rule.min(0),
    }),
  ],
  preview: { prepare: () => ({ title: 'Ustawienia sklepu' }) },
})
