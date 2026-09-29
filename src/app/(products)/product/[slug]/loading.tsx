import { Skeleton, ProductCardRowSkeleton } from "@/components/ui/Skeleton";

// Fallback na czas serwerowego pobierania produktu (getProductBySlug) — geometria
// 1:1 ze stroną: galeria (miniaturki 118px + główne clamp(450px,39vw,600px)),
// prawa kolumna (marka/tytuł/podtytuł, ocena, cena 22px + VAT, warianty,
// przyciski, trust row, akordeon detali), a pod spodem karuzela promocyjna.
export default function Loading() {
  return (
    <div id="product_container" className="relative md:z-10 z-1">
      <div className="gap-10 md:py-10 max-md:pb-10 md:mt-2 sm:mt-8 mt-6">
        <div className="flex flex-col md:justify-center md:flex-row md:px-10 2lg:space-x-16 md:space-x-8 relative">
          {/* Galeria */}
          <div className="md:sticky md:top-4 h-full flex flex-col z-2">
            <div className="max-md:px-6 max-sm:px-5">
              <Skeleton className="h-[14px] w-[220px] rounded-full md:mb-6 mb-2" />
            </div>
            <div className="md:w-auto w-full h-auto sticky top-4 flex max-1xl:justify-end max-md:items-center 1xl:flex-row flex-col-reverse 1xl:space-x-4 max-sm:px-4">
              <div className="md:flex hidden 1xl:flex-col flex-row max-1xl:space-x-3 1xl:space-y-3 w-auto h-fit max-1xl:mt-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="min-w-[118px] min-h-[118px] rounded-none" />
                ))}
              </div>
              <Skeleton className="md:w-auto w-full lg:h-[clamp(450px,39vw,600px)] h-[50vh] md:aspect-square rounded-[24px]" />
            </div>
          </div>
          {/* Tytuł / cena / akcje */}
          <div className="w-auto flex-1 flex flex-col font-poppins max-md:px-10 max-sm:px-7 max-md:mt-5 relative z-1">
            <Skeleton className="h-[20px] w-[140px] rounded-full" />
            <Skeleton className="h-[26px] w-[75%] rounded-full mt-1" />
            <Skeleton className="h-[20px] w-[45%] rounded-full mt-1 mb-2" />
            <div className="flex items-center gap-1 mb-3 min-h-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="w-5 h-5 rounded-full mr-1" />
              ))}
              <Skeleton className="h-[14px] w-[110px] rounded-full ml-1" />
            </div>
            <Skeleton className="h-[22px] w-[180px] rounded-full" />
            <Skeleton className="h-[14px] w-[220px] rounded-full mt-1" />
            <div className="2lg:mt-6 mt-4 mb-3 md:max-w-[450px]">
              <Skeleton className="h-[16px] w-[90px] rounded-full" />
              <Skeleton className="h-[50px] w-[9rem] rounded-[20px] mt-2" />
            </div>
            <div className="flex items-center gap-2.5 lg:gap-5 md:max-w-[450px]">
              <Skeleton className="h-[52px] w-[220px] rounded-full" />
              <Skeleton className="w-[50px] h-[50px] rounded-full shrink-0" />
            </div>
            <div className="flex mt-8 space-x-8">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex space-x-3 items-center">
                  <Skeleton className="w-[20px] h-[20px] rounded-full shrink-0" />
                  <div>
                    <Skeleton className="h-[13px] w-[70px] rounded-full" />
                    <Skeleton className="h-[13px] w-[50px] rounded-full mt-1" />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-10 md:max-w-[450px]">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i}>
                  <div className="flex justify-between items-center py-4">
                    <Skeleton className="h-[16px] w-[140px] rounded-full" />
                    <Skeleton className="w-[20px] h-[20px] rounded-full" />
                  </div>
                  <Skeleton className="h-[1px] w-full rounded-none" />
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Karuzela "Produkty objęte promocją" */}
        <div className="w-full h-auto font-poppins lg:mt-12 mt-8">
          <div className="flex justify-between sm:items-end items-center lg:mx-15 sm:mx-10 mx-6 mb-6">
            <Skeleton className="h-[20px] w-[260px] rounded-full" />
          </div>
          <div className="w-full sm:px-15 px-6">
            <ProductCardRowSkeleton count={4} />
          </div>
        </div>
      </div>
    </div>
  );
}