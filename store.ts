import { GetSlugProduct } from "./sanity.types";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  product: GetSlugProduct;
  quantity : number
  variant: string;
}

interface CartState {
  items: CartItem[];
  addItem: (product: GetSlugProduct, variant: string) => void;
  removeItem: (productId: string, variant: string) => void;
  deleteCartProduct: (productId: string, variant: string) => void;
  resetCart: () => void;
  getTotalPrice: () => number;
  getSubTotalPrice: () => number;
  getItemCount: (productId: string, variant: string) => number;
  getGroupedItems: () => CartItem[];
  getLatestItem: () => CartItem | null;
  onItemAdded: ((item: CartItem) => void) | null;
  setOnItemAdded: (cb: ((item: CartItem) => void) | null) => void;
}

const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      onItemAdded: null,
      setOnItemAdded: (cb) => set({ onItemAdded: cb }),

      addItem: (product, variant) =>
        set((state) => {
          const existingItem = state.items.find(
            (item) => item.product._id === product._id && item.variant === variant
          );
          if (existingItem) {
            get().onItemAdded?.({ ...existingItem, quantity: existingItem.quantity + 1 });
            return {
              items: [
                ...state.items.filter(
                  (item) => !(item.product._id === product._id && item.variant === variant)
                ),
                { ...existingItem, quantity: existingItem.quantity + 1 },
              ],
            };
          } else {
            get().onItemAdded?.({ product, quantity: 1, variant });
            return { items: [...state.items, { product, quantity: 1, variant }] };
          }
        }),
      removeItem: (productId, variant) =>
        set((state) => ({
          items: state.items.reduce((acc, item) => {
            if (item.product._id === productId && item.variant === variant) {
              if (item.quantity > 1) {
                acc.push({ ...item, quantity: item.quantity - 1 });
              }
            } else {
              acc.push(item);
            }
            return acc;
          }, [] as CartItem[]),
        })),

      deleteCartProduct: (productId, variant) =>
        set((state) => ({
          items: state.items.filter(
            (item) => !(item.product._id === productId && item.variant === variant)
          ),
        })),

      resetCart: () => set({ items: [] }),

      getTotalPrice: () => {
        return get().items.reduce(
          (total, item) => total + (item.product.price ?? 0) * item.quantity,
          0
        );
      },

      getSubTotalPrice: () => {
        return get().items.reduce((total, item) => {
          const price = item.product.price ?? 0;
          return total + price * item.quantity;
        }, 0);
      },

      getItemCount: (productId, variant) => {
        const item = get().items.find(
          (item) => item.product._id === productId && item.variant === variant
        );
        return item ? item.quantity : 0;
      },

      getGroupedItems: () => get().items,

      getLatestItem: () => get().items.at(-1) ?? null,
    }),
    { name: "cart-store" }
  )
);

export interface WishListItem {
  product: GetSlugProduct;
  variant: string;
}
interface WishListState {
  items: WishListItem[];
  addItem: (product: GetSlugProduct, variant: string) => void;
  // removeItem: (productId: string, variant: string) => void;
  // //deleteCartProduct: (productId: string, variant: string) => void;
  resetWishList: () => void;
  // getItemCount: (productId: string, variant: string) => number;
  getGroupedItems: () => WishListItem[];
  // //getLatestItem: () => CartItem | null;
  // onItemAdded: ((item: WishListItem) => void) | null;
  // setOnItemAdded: (cb: ((item: WishListItem) => void) | null) => void;
  existingItem: (product: GetSlugProduct, variant:string) => boolean
}

export const useWishListStore = create<WishListState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (product, variant) =>
        set((state) => {
          if (get().existingItem(product, variant)) {
            return{
            items: state.items.filter(
              (item) => !(item.product._id === product._id && item.variant === variant)
            ),
          }
          } else {
            return { items: [...state.items, { product, variant }] };
          }
        }),
        existingItem : (product, variant) =>{
          const item = get().items.some(
            (item) => item.product._id === product._id && item.variant === variant
          );
          return item;
        }
          
        ,
    //   removeItem: (productId, variant) =>
    //     set((state) => ({
    //       items: state.items.reduce((acc, item) => {
    //         if (item.product._id === productId && item.variant === variant) {
    //           if (item.quantity > 1) {
    //             acc.push({ ...item, quantity: item.quantity - 1 });
    //           }
    //         } else {
    //           acc.push(item);
    //         }
    //         return acc;
    //       }, [] as CartItem[]),
    //     })),

    //   deleteCartProduct: (productId, variant) =>
    //     set((state) => ({
    //       items: state.items.filter(
    //         (item) => !(item.product._id === productId && item.variant === variant)
    //       ),
    //     })),

      resetWishList: () => set({ items: [] }),

    //   getTotalPrice: () => {
    //     return get().items.reduce(
    //       (total, item) => total + (item.product.price ?? 0) * item.quantity,
    //       0
    //     );
    //   },

    //   getSubTotalPrice: () => {
    //     return get().items.reduce((total, item) => {
    //       const price = item.product.price ?? 0;
    //       return total + price * item.quantity;
    //     }, 0);
    //   },

    //   getItemCount: (productId, variant) => {
    //     const item = get().items.find(
    //       (item) => item.product._id === productId && item.variant === variant
    //     );
    //     return item ? item.quantity : 0;
    //   },

      getGroupedItems: () => get().items,

    //   getLatestItem: () => get().items.at(-1) ?? null,
    }),
    { name: "wishlist-store" }
  )
);

export default useCartStore;