import { BanerVariants, Product, Subcategory } from "../../../sanity.types"
import { client } from "../lib/client"

export const getAllBaners = async () =>{
    const BANERS_QUERY = `*[_type=="banerVariants"]`
    try{
        const res = await client.fetch<BanerVariants[]>(BANERS_QUERY)
        return res
    }catch (error) {
        console.error("Error fetching baners:", error);
        return;
    }
}

type SubcategoryNode = {
    _id: string;
    title: string;
    slug: string;
    imageWithAlt: Subcategory['imageWithAlt'];
}
export type CategoryNode = {
    _id: string;
    title: string;
    slug: string;
    subcategory?: SubcategoryNode[]
}
export async function getSubcategories(): Promise<CategoryNode[]> {
    const query = `*[_type=="category"]{
  _id,
  title,
  "slug": slug.current,
  "subcategory": *[_type=="subcategory" && parent._ref == ^._id]{
    _id, title, "slug": slug.current, imageWithAlt
  }
}`
    const data = await client.fetch<CategoryNode[]>(query);

    const sumData = data.map((c:any)=>({
        _id: c._id,
        title: c.title,
        slug: c.slug,
        subcategory: c.subcategory
    }))
    console.log("subcat",sumData)
    return sumData
}
export type ProductSearchResult = {
    _id: string;
    title: string;
    slug: string;
    price: number;
    compareAtPrice?: number;
    variants?: Array<{
        _key: string;
        price: number;
    }>;
    images: Product['images'];
    category: {
        title: string;
        slug: string;
    };
    type: {
        title: string;
        slug: string;
    };
}
function parseQuery(query: string) {
  const tokens = query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    console.log("tokens", tokens)
  return tokens
}
function buildParams(tokens: string[]) {
  const params: Record<string, string> = {}

  tokens.forEach((t, i) => {
    params[`p${i}`] = `${t}*`
    params[`c${i}`] = `*${t}*`
  })
  console.log("params", params)
  return params
}
function rankProducts(products: any[], tokens: string[]) {
  return products
    .map(p => {
      const name = p.title.toLowerCase()

      let score = 0

      tokens.forEach(t => {
        if (name.startsWith(t)) score += 3
        else if (name.includes(t)) score += 1
      })

      return { ...p, score }
    })
    .sort((a, b) => b.score - a.score)
}
export const searchProductsByName = async (name: string, controller: AbortController) => {
    if (name.length < 2) return []

    const tokens = parseQuery(name)
    const params = {
    p0: "",
    c0: "",
    p1: "",
    c1: "",
    p2: "",
    c2: "",
    ...buildParams(tokens)
    }

    const SEARCH_QUERY = `*[
      _type == "product" &&
      (
        lower(title) match lower($p0) ||
        lower(title) match lower($c0) ||
        lower(title) match lower($p1) ||
        lower(title) match lower($c1) ||
        lower(title) match lower($p2) ||
        lower(title) match lower($c2)
      )
    ]{
      _id,
      title,
      price,
      compareAtPrice,
      images,
      "variants": variants[]{
        _key,
        price
      },
      "category":category->{
         "slug": slug.current,
         title
      },
      "type":type->{
        "slug": slug.current,
        title
        },
      "slug": slug.current
    }`
    try {
        const data = await client.fetch<ProductSearchResult[]>(SEARCH_QUERY, params , { signal: controller.signal });
        return rankProducts(data, tokens) || [];
    } catch (error) {
        console.error("Error fetching products by name:", error);
        return [];
    }
}