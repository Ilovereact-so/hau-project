import { sanityClient } from "@/sanity/sanityClient.server";

type SubcategoryNode = {
    _id: string;
    title: string;
    slug: string;
}
export type CategoryNode = {
    _id: string;
    title: string;
    slug: string;
    subcategory?: SubcategoryNode[]
}
export async function getCategories(): Promise<CategoryNode[]> {
    const query = `*[_type=="category"]{
  _id,
  title,
  "slug": slug.current,
  "subcategory": *[_type=="subcategory" && parent._ref == ^._id]{
    _id, title, "slug": slug.current
  }
}`
    const data = await sanityClient.fetch(query);

    const sumData = data.map((c:any)=>({
        _id: c._id,
        title: c.title,
        slug: c.slug,
        subcategory: c.subcategory
    }))
    //console.log(sumData)
    return sumData
}