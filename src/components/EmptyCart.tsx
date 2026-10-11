"use client";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import PendingPaymentNotice from "@/components/orders/PendingPaymentNotice";

// Ten sam układ co pusta lista polubionych (WishlistPageClient): ikona,
// informacja, podpowiedź i przycisk powrotu do produktów. Nad nim — jeśli
// klient ma zamówienie czekające na płatność — skrót „Zapłać” (koszyk jest
// pusty, bo produkty są już w tym zamówieniu).
const EmptyCart = () => {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-3 text-center font-poppins">
      <PendingPaymentNotice className="mb-8" />
      <ShoppingBag className="text-[#afafaf] w-6 h-6" aria-hidden />
      <p className="text-[#6C6C6C] text-[16px]">Twój koszyk jest pusty.</p>
      <p className="text-[#afafaf] text-[14px]">Dodaj produkty do koszyka, a pojawią się tutaj.</p>
      <Link href="/" className="mt-2 rounded-full border border-fancy-black text-black px-6 py-2.5 text-[14px] font-medium hover:bg-fancy-black hover:text-white transition-colors">
        Przeglądaj produkty
      </Link>
    </div>
  );
};

export default EmptyCart;
