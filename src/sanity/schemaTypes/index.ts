import { type SchemaTypeDefinition } from 'sanity'

import {categoryType} from './categoryType'
import optionList from './optionList'
import subcategory from './subcategory'
import productType from './productType'


export const schema: { types: SchemaTypeDefinition[] } = {
  types: [categoryType, productType, optionList, subcategory],
}
