"use client";
import { GetSlugProduct } from "../../sanity.types";
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import useCartStore from "../../store";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { isVariantAvailable, maxOrderQty } from "@/lib/stock";

interface Props {
  product: GetSlugProduct;
  className?: string;
  variant: string
  type?: "top" | "bottom" | undefined;
}

const AddToCartButton = ({ product, className, variant, type = "top" }: Props) => {
  const { addItem, getItemCount } = useCartStore();
  const [isClient, setIsClient] = useState(false);

  // Stan WYBRANEGO wariantu (wariant → produkt; brak liczby = nieprowadzony).
  const isOutOfStock = !isVariantAvailable(product, variant);
  const limit = maxOrderQty(product, variant);
  const [isClicked, setIsClicked] = useState(false);

  // Use useEffect to set isClient to true after component mounts
  // This ensures that the component only renders on the client-side
  // Preventing hydration errors due to server/client mismatch
  const handleClick = async () => {
    if (isOutOfStock) return;
    if (getItemCount(product._id, variant) >= limit) {
      toast.error(limit === 1 ? "Mamy tylko 1 sztukę — jest już w Twoim koszyku." : `W koszyku masz już wszystkie dostępne sztuki (${limit}).`);
      return;
    }
    setIsClicked(true)

    await Promise.all([
        addItem(product, variant, true, type), // type → CartIcon decyduje: popup "top" | "bottom"
        new Promise(resolve => setTimeout(resolve, 700)) // minimum 1s
    ]);
    
    toast.success(`Dodano do koszyka: ${product?.title ?? 'produkt'}`);
    setIsClicked(false)
  }

  useEffect(() => {
    setIsClient(true);
  }, []);
  if (!isClient) {
    return null;
  }
  return (
    <div className="w-auto flex items-center text-white">
        <motion.button
          onClick={() => 
            handleClick()
          }
          whileTap={{filter:"contrast(0.6)"}}
          disabled={isOutOfStock}
          className={cn(
            "w-auto bg-black hover:bg-fancy-black ease-in-out duration-100 rounded-full py-3 px-10 flex justify-center items-center font-poppins text-whie text-[clamp(16px,1.3vw,18px)] font-medium tracking-wide cursor-pointer",
            className,
            isOutOfStock && "bg-[#8E8E8E] hover:bg-[#8E8E8E] cursor-not-allowed"
          )}
        >
          {isOutOfStock ? (
            <span>Chwilowo niedostępny</span>
          ) : isClicked ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="flex items-center text-white">
              <Loader2 className=" animate-spin" /> 
            </motion.div>
          ) : <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>Dodaj do koszyka</motion.h1>
          
          }
          
        </motion.button>
    </div>
  );
};

export default AddToCartButton;