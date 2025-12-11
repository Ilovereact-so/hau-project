import { twMerge } from "tailwind-merge";
import PriceFormatter from "./PriceFormatter";

interface Props {
  price: number | undefined;
  discount?: number | undefined;
  className?: string;
}
const PriceView = ({ price, discount, className }: Props) => {
  return (
    <div className="flex flex-col w-fit">
      <div className="flex items-center w-fit gap-2">
        <PriceFormatter amount={discount ? discount : price} className={twMerge("text-[clamp(24px,1.8vw,32px)] text-[#DD1919]")} />
        <p className="text-black text-[clamp(16px,1.2vw,20px)] mt-2">w tym VAT</p>
      </div>
      <p className="text-black text-[clamp(14px,1.1vw,16px)]">Najniższa cena sprzed ostatnich 30dni:
        <PriceFormatter amount={price} className={twMerge("text-[clamp(14px,1.1vw,16px)] text-black font-normal ml-2")} />
      </p>
      {price && discount && (
      <div className="flex">
        <p className="text-black text-[clamp(14px,1.1vw,16px)]">Cena regularna:</p>
        <PriceFormatter amount={price} className={twMerge("text-[clamp(14px,1.1vw,16px)] text-black font-normal ml-2 line-through")} />
        <p className="text-[#DD1919] text-[clamp(14px,1.1vw,16px)] ml-2">-{Math.round((1-(discount / price)) * 100)}%</p>
      </div>
      )}
    </div>
  );
};

export default PriceView;