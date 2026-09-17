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
    // Cache na 10 minut — menu kategorii zmienia się bardzo rzadko, a bez tego
    // fetch przy każdej nawigacji leciał na świeżo do Sanity (useCdn: false w
    // sanityClient.server). `export const revalidate` w NavbarContainer.tsx
    // nic nie dawał — route segment config działa tylko w page/layout.
    const data: CategoryNode[] = await sanityClient.fetch(query, {}, {
        next: { revalidate: 60 * 10, tags: ['sanity'] },
    });

    const sumData = data.map((c:any)=>({
        _id: c._id,
        title: c.title,
        slug: c.slug,
        subcategory: c.subcategory
    }))
    //console.log(sumData)
    return sumData
}