import { defineQuery } from "next-sanity";
import { sanityFetch } from "../lib/live";

export const getAllProducts = async () => {
  const PRODUCTS_QUERY = defineQuery(`*[_type=="product"] | order(name asc)`);
  try {
    const products = await sanityFetch({
      query: PRODUCTS_QUERY,
    });
    return products.data || [];
  } catch (error) {
    console.log("Error fetching all products:", error);
    return [];
  }
};

export const getAllCategories = async (quantity?: number) => {
  const CATEGORIES_QUERY = `*[_type=="category"] | order(name asc)${quantity ? `[0...${quantity}]` : ""}`;

  try {
    const categories = await sanityFetch({
      query: CATEGORIES_QUERY,
    });
    return categories?.data || [];
  } catch (error) {
    console.error("Error fetching all categories:", error);
    return [];
  }
};

export const searchProductsByName = async (searchParam: string) => {
  const PRODUCT_SEARCH_QUERY = defineQuery(
    `*[_type == "product" && name match $searchParam] | order(name asc)`
  );

  try {
    const products = await sanityFetch({
      query: PRODUCT_SEARCH_QUERY,
      params: {
        searchParam: `${searchParam}`,
      },
    });
    return products?.data || [];
  } catch (error) {
    console.error("Error fetching products by name:", error);
    return [];
  }
};
type CategoryType = {
  _id: string;
  title: string;
  slug: string;
};
export type SubcategoryWithCategory = {
  _id: string;
  title: string;
  slug: string;
  description: string;
  availableFilters?:Array<{
    _id:string,
    key:string,
    label:string,
    type:string,
    UX_type: string
  }>
  imageWithAlt: {
    asset: {
      _ref: string;
    };
    alt: string;
  };
  category: CategoryType
};

export const getSubCategoryBySlug = async(slug: string) => {
  const SUBCATEGORY_BY_ID_QUERY = defineQuery(
    `*[_type == "subcategory" && slug.current == $slug]{
      _id,
      title, 
      "slug": slug.current, 
      description,
      availableFilters[]->{
        _id,
        key,
        label,
        type,
        UX_type
      }, 
      imageWithAlt, 
      "category": *[_type == "category" && _id == ^.parent._ref]{
        _id,
        title,
        "slug": slug.current
      }[0]
    } | order(name asc) [0]`
  );

  try {
    const subcategory = await sanityFetch({
      query: SUBCATEGORY_BY_ID_QUERY,
      params: {
        slug,
      },
    });
    return subcategory?.data || null;
  } catch (error) {
    console.error("Error fetching subcategory by slug:", error);
    return null;
  }
};
export const getProductBySlug = async (slug: string) => {
  const PRODUCT_BY_ID_QUERY = defineQuery(
    `*[_type == "product" && slug.current == $slug]{
  ...,
  productOptions[]->{
    _id,
    key,
    label,
    type,
    UX_type
  },
  filterValues[]->{
    filter,
    _id,
    value,
    slug
  },
  variants[]{
    _key,
    price,
    sku,
    stock,
    optionValues[]{
      _key,
      label,
      "name":name->{
        _id,
        key,
        label,
        type,
        UX_type
      },
      "value":value->{
        _id,
        value,
        slug
      }
    }
  }
}[0]
`
  );

  try {
    const product = await sanityFetch({
      query: PRODUCT_BY_ID_QUERY,
      params: {
        slug,
      },
    });
    return product?.data || null;
  } catch (error) {
    console.error("Error fetching product by ID:", error);
    return null;
  }
};

export const getProductsBySubCategory = async (subcategorySlug: string) => {
  const PRODUCT_BY_SUBCATEGORY_QUERY = defineQuery(
    `*[_type == 'product' && references(*[_type == "subcategory" && slug.current == $subcategorySlug]._id)]{
  ...,
  productOptions[]->{
    _id,
    key,
    label,
    type,
    UX_type
  },
  filterValues[]->{
    filter,
    _id,
    value,
    slug
  },
  variants[]{
    _key,
    price,
    sku,
    stock,
    optionValues[]{
      _key,
      label,
      "name":name->{
        _id,
        key,
        label,
        type,
        UX_type
      },
      "value":value->{
        _id,
        value,
        slug
      }
    }
  }
} | order(name asc)`
  );
  try {
    const products = await sanityFetch({
      query: PRODUCT_BY_SUBCATEGORY_QUERY,
      params: {
        subcategorySlug,
      },
    });
    return products?.data || [];
  } catch (error) {
    console.error("Erroor fetching products by subcategory:", error);
    return [];
  }
};

export const getSale = async () => {
  const SALE_QUERY = defineQuery(`*[_type == 'sale'] | order(name asc)`);
  try {
    const products = await sanityFetch({
      query: SALE_QUERY,
    });
    return products?.data || [];
  } catch (error) {
    console.error("Error fetching products by category:", error);
    return [];
  }
};

export const getMyOrders = async (userId: string) => {
  if (!userId) {
    throw new Error("User ID is required");
  }
  const MY_ORDERS_QUERY =
    defineQuery(`*[_type == 'order' && clerkUserId == $userId] | order(orderData desc){
    ...,products[]{
      ...,product->
    }
  }`);

  try {
    const orders = await sanityFetch({
      query: MY_ORDERS_QUERY,
      params: { userId },
    });
    return orders?.data || [];
  } catch (error) {
    console.error("Error fetching orders:", error);
    return [];
  }
};