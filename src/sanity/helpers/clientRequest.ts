import { BanerVariants, Subcategory } from "../../../sanity.types"
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