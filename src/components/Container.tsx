import { cn } from "@/lib/utils";

interface Props {
  children: React.ReactNode;
  className?: string;
  id?:string;
  style?: React.CSSProperties;
}

const Container = ({ children, className, id, style }: Props) => {
  return (
    <div id={id} className={cn("mx-auto max-w-[1900px]", className)} style={style}>
      {children}
    </div>
  );
};

export default Container;