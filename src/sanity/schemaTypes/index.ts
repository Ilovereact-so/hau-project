import { type SchemaTypeDefinition } from 'sanity'

import {categoryType} from './categoryType'
import optionList from './optionList'
import subcategory from './subcategory'
import productType from './productType'
import banerVariants from './banerVariants'
import filter from './filter'
import filterValue from './filterValue'
import shipping_methods from './shipping_methods'
import helpDocument from './helpDocument'
import guide from './guide'
import guideCategory from './guideCategory'
import videoEmbed from './videoEmbed'
import { calloutBlock, dividerBlock, productEmbedBlock } from './guideBlocks'
import collection from './collection'


export const schema: { types: SchemaTypeDefinition[] } = {
  types: [
    categoryType,
    productType,
    optionList,
    subcategory,
    banerVariants,
    // Kolekcje produktów — przypisanie trzyma produkt (`collections`), baner linkuje do kolekcji.
    collection,
    filter,
    filterValue,
    shipping_methods,
    helpDocument,
    // Poradniki — osobna gałąź treści, niezależna od drzewa produktów.
    // `videoEmbed` to typ osadzany (obiekt), nie dokument — musi być
    // zarejestrowany globalnie, bo `guide` odwołuje się do niego po nazwie
    // (`type: 'videoEmbed'`) zarówno w polu heroVideo, jak i wewnątrz body.
    guide,
    guideCategory,
    videoEmbed,
    // Bloki treści poradnika (ramka, polecane produkty, separator) — obiekty
    // osadzane w `guide.body`, rejestrowane globalnie z tego samego powodu co videoEmbed.
    calloutBlock,
    productEmbedBlock,
    dividerBlock,
  ],
}
