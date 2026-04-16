import { cn } from "@/lib/utils";

interface Props {
  children: React.ReactNode;
  className?: string;
  id?:string;
}

const Container = ({ children, className, id }: Props) => {
  return (
    <div id={id} className={cn("mx-auto max-w-[1900px]", className)}>
      {children}
    </div>
  );
};

export default Container;