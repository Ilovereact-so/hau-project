import { BanerVariants } from "../../../sanity.types"
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


// export const getAllBaners = async () =>{
//   const ALL_BANERS_QUERY = defineQuery(`*[_type=="banerVariants"]`)
//    try {
//     const baners = await sanityFetch({
//       query: ALL_BANERS_QUERY,
//     });
//     return baners?.data || [];
//   } catch (error) {
//     console.error("Error fetching baners:", error);
//     return [];
//   }
// }

// try{
//     // DEBUG: pokaż config klienta
//     // @ts-ignore
//     console.log('Sanity config:', client.config && client.config())
    
//     const response = await client.fetch<Product[]>(PRODUCTS_QUERY, QUERY_PARAMS)
//     setProducts(response)
//     console.log("Fetched products:", response)
// } catch (error){
//     console.log("Product fetching Error", error)
// } finally{
//     console.log("Products fetched:", products.length)
//     setLoading(false)
// }