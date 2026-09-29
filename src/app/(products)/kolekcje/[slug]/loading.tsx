import Container from "@/components/Container";
import { ProductGridSkeleton, Skeleton } from "@/components/ui/Skeleton";

// Szkielet strony kolekcji — geometria 1:1 ze stroną: breadcrumb, hero h-400
// z overlayem tytułu/opisu, pasek (count + SortSelect ~150px), siatka
// ProductItemWithoutBTN (kwadrat, bez buttona).
export default function Loading() {
  return (
    <Container className="lg:mt-10 md:mt-7 sm:mt-10 mt-7 md:px-10 sm:px-8 px-6 min-h-[100vh] font-poppins">
      <Skeleton className="h-[16px] w-[220px] rounded-full" />
      <div className="flex relative w-full h-[400px] mt-3">
        <Skeleton className="w-full h-full rounded-[20px]" />
        <div className="absolute z-[2] sm:top-[30%] sm:bottom-10 bottom-3 sm:left-10 max-sm:m-3 max-sm:p-4 w-[min(560px,70%)]">
          <Skeleton className="h-[clamp(40px,5vw,96px)] w-full rounded-2xl bg-white/15" />
          <Skeleton className="h-[clamp(16px,1.5vw,22px)] w-[70%] rounded-full bg-white/10 mt-2 mb-5" />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
        <Skeleton className="h-[14px] w-[90px] rounded-full" />
        <Skeleton className="h-[36px] w-[150px] rounded-[20px]" />
      </div>
      <div className="grid justify-items-center 2.5xl:grid-cols-4 lg:grid-cols-4 sm:grid-cols-3 grid-cols-2 sm:gap-x-[18px] gap-x-3 md:gap-y-[75px] sm:gap-y-[65px] gap-y-[40px] sm:mt-10 mt-7 mb-15 w-full">
        {Array.from({ length: 8 }).map((_, i) => (
          <ProductGridSkeleton key={i} />
        ))}
      </div>
    </Container>
  );
}
