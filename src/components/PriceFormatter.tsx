import { twMerge } from "tailwind-merge";

interface Props {
  amount: number | undefined;
  className?: string;
  numRef?: React.RefObject<HTMLInputElement | null>
}

const PriceFormatter = ({ amount, className, numRef }: Props) => {
  const formattedPrice = new Number(amount).toLocaleString("pl-PL", {
    currency: "PLN",
    style: "currency",
    minimumFractionDigits: 2,
  });
  return (
    <span
      className={twMerge("font-semibold text-darkColor", className)}
    >
      {formattedPrice}
    </span>
  );
};

export default PriceFormatter;