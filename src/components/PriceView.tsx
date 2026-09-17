'use client'

import { twMerge } from "tailwind-merge";
import type { ProductOmnibus } from "@/lib/omnibus";
import { OmnibusNote, PriceRow, useProductPrice, type PricedProduct } from "./price/ProductPrice";

interface Props {
  product: PricedProduct;
  /** Wariant, którego cenę pokazujemy (domyślnie pierwszy). */
  variantKey?: string | null;
  initial?: ProductOmnibus | null;
  className?: string;
}

/**
 * Cena „w tym VAT” + najniższa cena z 30 dni. Dawniej przyjmowała ręczne
 * `compareAtPrice` i pokazywała cenę bieżącą jako „najniższą” — teraz
 * wszystko pochodzi z rejestru cen (patrz components/price/ProductPrice).
 */
const PriceView = ({ product, variantKey, initial, className }: Props) => {
  const state = useProductPrice(product, variantKey, initial);
  return (
    <div className="flex flex-col w-fit">
      <PriceRow
        state={state}
        className="text-[clamp(14px,1.1vw,16px)]"
        priceClassName={twMerge("text-[clamp(24px,1.8vw,32px)]", className)}
        suffix={<p className="text-black text-[clamp(16px,1.2vw,20px)] mt-2">w tym VAT</p>}
      />
      <OmnibusNote state={state} className="text-black text-[clamp(14px,1.1vw,16px)]" />
    </div>
  );
};

export default PriceView;