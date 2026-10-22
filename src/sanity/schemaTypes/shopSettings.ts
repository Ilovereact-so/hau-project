import { defineField, defineType } from 'sanity'
import { CogIcon } from '@sanity/icons'

/*
 * Ustawienia sklepu — JEDEN dokument (`_id: "shopSettings"`), edytowany
 * w panelu: Dostawy (/admin/shipping) i Marketing → Strona główna (linki social). Sklep czyta go publicznie (koszyk,
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
    // Linki do profili sklepu — stopka i sekcja „O nas” na stronie głównej.
    // Edycja w panelu: Marketing → Strona główna → „Media społecznościowe”.
    defineField({ name: 'socialFacebook', title: 'Facebook (link do profilu)', type: 'url' }),
    defineField({ name: 'socialInstagram', title: 'Instagram (link do profilu)', type: 'url' }),
    defineField({ name: 'socialTiktok', title: 'TikTok (link do profilu)', type: 'url' }),
  ],
  preview: { prepare: () => ({ title: 'Ustawienia sklepu' }) },
})
