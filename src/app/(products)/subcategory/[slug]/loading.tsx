import Container from "@/components/Container";
import { Skeleton, ProductCardSkeleton } from "@/components/ui/Skeleton";

// Automatyczny fallback Next podczas serwerowego renderu strony subkategorii —
// zapytania do Sanity (produkty + metadane subkategorii) są blokujące, więc bez
// tego pliku user widział biały ekran, aż dane dojdą. Szkielet odwzorowuje
// layout docelowy: breadcrumb, dock filtrów, siatka 8 kafelków produktowych.
export default function Loading() {
  return (
    <Container id="sub-category-container" className="flex justify-center lg:mt-10 md:mt-7 sm:mt-10 mt-7 md:px-10 sm:px-8 px-6 min-h-[100vh] font-poppins">
      <div className="flex flex-col h-full w-full relative">
        <div className="flex flex-col space-y-2 mt-1">
          <Skeleton className="h-[14px] w-[240px] rounded-full" />
          <Skeleton className="h-[20px] w-[320px] rounded-full" />
        </div>
        <div className="flex justify-center w-full mt-[clamp(30px,8vw,80px)]">
          <div className="flex subcategory-dock-shadow relative bg-fancy-black md:py-2 py-2 md:pt-4 md:px-9 px-3 rounded-full lg:w-[65vw] w-[80vw] min-h-[50px] max-w-[1350px]">
            <div className="w-full flex justify-between items-center px-4">
              <Skeleton className="h-[16px] w-[130px] rounded-full bg-white/20" />
              <Skeleton className="h-[34px] w-[110px] rounded-[20px] bg-white/10" />
            </div>
          </div>
        </div>
        <div className="grid justify-items-center 2.5xl:grid-cols-4 lg:grid-cols-4 sm:grid-cols-3 grid-cols-2 sm:gap-x-[18px] gap-x-3 md:gap-y-[75px] sm:gap-y-[65px] gap-y-[40px] sm:mt-12 mt-7 mb-15 w-full">
          {Array.from({ length: 8 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </Container>
  );
}