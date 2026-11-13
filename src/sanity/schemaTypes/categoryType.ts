import {TagIcon} from '@sanity/icons'
import {defineField, defineType} from 'sanity'
import { metaFields, seoContentField } from './seoContent'

export const categoryType = defineType({
  name: 'category',
  title: 'Category',
  type: 'document',
  icon: TagIcon,
  fields: [
    defineField({
      name: 'title',
      type: 'string',
    }),
    defineField({
      name: 'slug',
      type: 'slug',
      options: {
        source: 'title',
      },
    }),
    defineField({
      name: 'description',
      title: 'Opis (nagłówek strony kategorii)',
      description: 'Krótkie zdanie pod nazwą kategorii na górze strony /category/<slug>.',
      type: 'text',
      rows: 2,
    }),
    seoContentField(),
    ...metaFields(),
    defineField({
      name: 'menuHidden',
      title: 'Ukryj w menu sklepu',
      type: 'boolean',
      description: 'Kategoria (i wszystkie jej podkategorie) znika z menu i z kafelków podkategorii na stronie głównej. Jej strona nadal działa pod swoim adresem.',
    }),
    defineField({
      name: 'menuOrder',
      title: 'Kolejność w menu',
      type: 'number',
      description: 'Ustawiana w panelu (Produkty → Menu sklepu). Mniejsza liczba = wcześniej; puste = na końcu.',
    }),
  ],
  orderings: [
    { title: 'Kolejność w menu', name: 'menuOrder', by: [{ field: 'menuOrder', direction: 'asc' }, { field: 'title', direction: 'asc' }] },
    { title: 'Nazwa', name: 'title', by: [{ field: 'title', direction: 'asc' }] },
  ],
  preview:{
    select:{
      title: "title",
      subtitle: "slug.current"
    }
  }
})
