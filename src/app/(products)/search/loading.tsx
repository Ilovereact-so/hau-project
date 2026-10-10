import Container from "@/components/Container";
import { Skeleton, ProductGridSkeleton } from "@/components/ui/Skeleton";

// Fallback na czas serwerowego wyszukiwania w Sanity (getProductsBySearch) —
// geometria 1:1 ze stroną: breadcrumb, dock (jak w subkategorii), siatka
// ProductItemWithoutBTN (kwadrat, bez buttona).
export default function Loading() {
  return (
    <Container id="sub-category-container" className="flex justify-center lg:mt-10 md:mt-7 sm:mt-10 mt-7 md:px-10 sm:px-8 px-6 min-h-[100vh] font-poppins">
      <div className="flex flex-col h-full w-auto relative">
        <div className="flex w-full relative z-[3]">
          <div className="flex flex-col space-y-1">
            <div className="flex items-center space-x-2">
              <Skeleton className="h-[16px] w-[110px] rounded-full" />
              <Skeleton className="w-[20px] h-[20px] rounded-full" />
              <Skeleton className="h-[16px] w-[120px] rounded-full" />
            </div>
            <Skeleton className="h-[26px] w-[300px] max-w-[70vw] rounded-full" />
          </div>
        </div>
        <div className="flex justify-center w-full mt-[clamp(30px,8vw,80px)]">
          <div className="flex subcategory-dock-shadow relative bg-fancy-black md:py-2 xs:py-3 py-2 md:pt-4 md:px-9 3xs:px-7 xs:px-4 px-3 rounded-full lg:w-[65vw] 2md:w-[70vw] w-[80vw] z-[1] min-h-[110px] max-w-[1350px] overflow-hidden">
            <div className="w-full flex justify-between">
              <div className="flex flex-col w-full z-[3] relative space-y-2 pr-4">
                <Skeleton className="h-[18px] w-[70px] rounded-full bg-white/10 ml-1 max-md:hidden" />
                <div className="flex gap-2">
                  <Skeleton className="h-[36px] w-[110px] rounded-[20px] bg-white/10" />
                  <Skeleton className="h-[36px] w-[90px] rounded-[20px] bg-white/10 max-sm:hidden" />
                  <Skeleton className="h-[36px] w-[100px] rounded-[20px] bg-white/10 max-md:hidden" />
                </div>
              </div>
              <div className="flex md:flex-col flex-row-reverse md:space-y-2 h-fit relative z-[3]">
                <Skeleton className="h-[18px] w-[60px] rounded-full bg-white/10 max-md:hidden" />
                <Skeleton className="h-[36px] w-[150px] rounded-[20px] bg-white/10" />
              </div>
            </div>
          </div>
        </div>
        <div className="grid justify-items-center 2.5xl:grid-cols-4 lg:grid-cols-4 sm:grid-cols-3 grid-cols-2 sm:gap-x-[18px] gap-x-3 md:gap-y-[75px] sm:gap-y-[65px] gap-y-[40px] sm:mt-12 mt-7 mb-15 w-full">
          {Array.from({ length: 8 }).map((_, i) => (
            <ProductGridSkeleton key={i} />
          ))}
        </div>
      </div>
    </Container>
  );
}