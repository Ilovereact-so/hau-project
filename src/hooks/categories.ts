import { sanityClient } from "@/sanity/sanityClient.server";
import { buildMenuTree, MENU_FIELDS_GROQ, type MenuFields } from "@/lib/menuOrder";

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

type RawSubcategory = SubcategoryNode & MenuFields
type RawCategory = Omit<CategoryNode, 'subcategory'> & MenuFields & { subcategory?: RawSubcategory[] | null }

/**
 * Kategorie i podkategorie do menu sklepu — w kolejności i z ukryciem
 * ustawionymi w panelu (Produkty → Menu sklepu, `lib/menuOrder.ts`).
 */
export async function getCategories(): Promise<CategoryNode[]> {
    const query = `*[_type=="category"]{
  _id,
  title,
  "slug": slug.current,
  ${MENU_FIELDS_GROQ},
  "subcategory": *[_type=="subcategory" && parent._ref == ^._id]{
    _id, title, "slug": slug.current, ${MENU_FIELDS_GROQ}
  }
}`
    // Cache na 10 minut — menu kategorii zmienia się bardzo rzadko, a bez tego
    // fetch przy każdej nawigacji leciał na świeżo do Sanity (useCdn: false w
    // sanityClient.server). `export const revalidate` w NavbarContainer.tsx
    // nic nie dawał — route segment config działa tylko w page/layout.
    // Zapis menu w panelu unieważnia ten cache od razu (revalidatePath).
    const data: RawCategory[] = await sanityClient.fetch(query, {}, {
        next: { revalidate: 60 * 10, tags: ['sanity'] },
    });

    return buildMenuTree(data ?? []).map((c) => ({
        _id: c._id,
        title: c.title,
        slug: c.slug,
        subcategory: c.subcategory.map((s) => ({ _id: s._id, title: s.title, slug: s.slug })),
    }))
}
