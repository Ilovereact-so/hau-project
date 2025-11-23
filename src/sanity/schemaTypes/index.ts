import { type SchemaTypeDefinition } from 'sanity'

import {categoryType} from './categoryType'
import { productType } from './productType'
import optionList from './optionList'
import subcategory from './subcategory'


export const schema: { types: SchemaTypeDefinition[] } = {
  types: [categoryType, productType, optionList, subcategory],
}
