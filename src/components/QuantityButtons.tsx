import React from "react";
import toast from "react-hot-toast";
import { GetSlugProduct } from "../../sanity.types";
import { twMerge } from "tailwind-merge";
import { Minus, Plus, Trash2 } from "lucide-react";
import useCartStore from "../../store";
import { maxOrderQty } from "@/lib/stock";

interface Props {
  product: GetSlugProduct;
  className?: string;
  borderStyle?: string;
  variant:string;
}

const QuantityButtons = ({ product, variant, className, borderStyle }: Props) => {
  const { addItem, removeItem, getItemCount } = useCartStore();
  const itemCount = getItemCount(product?._id, variant);

  const handleRemoveProduct = () => {
    removeItem(product?._id, variant);
    if (itemCount > 1) {
      toast.success("Zmniejszono ilość");
    } else {
      toast.success(`Usunięto z koszyka: ${product?.title ?? "produkt"}`);
    }
  };
  return (
    <div
      className={twMerge(
        "flex items-center border-[#D7D7D7] rounded-full border-1",
        borderStyle,
        className
      )}
    >
      <div
        className="w-9 h-9 flex justify-center items-center cursor-pointer text-black hover:bg-[#D7D7D7] rounded-full"
        onClick={handleRemoveProduct}
        >
          {itemCount > 1 ?
        <Minus  className="w-4 text-black h-4"/>
        :
        <Trash2 className="w-4 text-black h-4"/>
          }
      </div>
      <span className="text-black w-4 text-center">
        {itemCount}
      </span>
      <div
        className="w-9 h-9 flex justify-center items-center cursor-pointer text-black hover:bg-[#D7D7D7] rounded-full"
        onClick={() => {
          const limit = maxOrderQty(product, variant);
          if (itemCount >= limit) {
            toast.error(limit <= 0 ? "Produkt jest chwilowo niedostępny." : `Dostępnych sztuk: ${limit}.`);
            return;
          }
          addItem(product, variant, false);
          toast.success("Zwiększono ilość");
        }}
      >
        <Plus className="w-4 h-4 text-black"/>
      </div>
    </div>
  );
};

export default QuantityButtons;