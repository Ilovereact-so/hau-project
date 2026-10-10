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
  ],
  preview:{
    select:{
      title: "title",
      subtitle: "slug.current"
    }
  }
})
