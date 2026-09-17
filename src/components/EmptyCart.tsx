"use client";
import { ShoppingBag } from "lucide-react";
const EmptyCart = () => {
  return (
    <div className="flex flex-col items-center justify-center h-[40vh] space-y-3 ">
        <ShoppingBag size={24} className="text-[#afafaf]" />
        <h1 className="text-[#afafaf] font-normal text-[clamp(14px, 2vw, 16px)] font-poppins">Brak produktów w koszyku</h1>
    </div>
  );
};

export default EmptyCart;