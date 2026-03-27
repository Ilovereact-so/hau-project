import React from "react";
import toast from "react-hot-toast";
import { GetSlugProduct, Product } from "../../sanity.types";
import { twMerge } from "tailwind-merge";
import { Button } from "./ui/button";
import { Minus, Plus, Trash2 } from "lucide-react";
import useCartStore from "../../store";

interface Props {
  product: GetSlugProduct;
  className?: string;
  borderStyle?: string;
  variant:string;
}

const QuantityButtons = ({ product, variant, className, borderStyle }: Props) => {
  const { addItem, removeItem, getItemCount } = useCartStore();
  const itemCount = getItemCount(product?._id, variant);
  const isOutOfStock = product?.stock === 0;

  const handleRemoveProduct = () => {
    removeItem(product?._id, variant);
    if (itemCount > 1) {
      toast.success("Quantity Decreased successfully!");
    } else {
      toast.success(`${product?.title?.substring(0, 12)} removed successfully!`);
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
          addItem(product, variant);
          toast.success("Quantity increased successfully!");
        }}
      >
        <Plus className="w-4 h-4 text-black"/>
      </div>
    </div>
  );
};

export default QuantityButtons;