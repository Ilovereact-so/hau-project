import { Skeleton, ProductCardRowSkeleton } from "@/components/ui/Skeleton";

// Fallback na czas serwerowego pobierania produktu (getProductBySlug) — dwie
// kolumny: galeria po lewej, blok tytułu/ceny/przycisków po prawej, a pod spodem
// szkielet karuzeli "Produkty objęte promocją".
export default function Loading() {
  return (
    <div id="product_container" className="relative md:z-10 z-1">
      <div className="gap-10 md:py-10 max-md:pb-10 md:mt-2 sm:mt-8 mt-6">
        <div className="flex flex-col md:justify-center md:flex-row md:px-10 2lg:space-x-16 md:space-x-8 relative">
          {/* Galeria */}
          <div className="md:sticky md:top-4 h-full flex flex-col z-2 max-md:px-6 max-sm:px-5">
            <Skeleton className="h-[13px] w-[200px] rounded-full md:mb-6 mb-2" />
            <Skeleton className="w-[min(450px,90vw)] h-[520px] rounded-[24px]" />
          </div>
          {/* Tytuł / cena / akcje */}
          <div className="w-auto flex-1 flex flex-col max-md:px-10 max-sm:px-7 max-md:mt-5 relative z-1">
            <Skeleton className="h-[13px] w-[120px] rounded-full mb-2" />
            <Skeleton className="h-[22px] w-[70%] rounded-full mb-2" />
            <Skeleton className="h-[15px] w-[45%] rounded-full mb-4" />
            <Skeleton className="h-[26px] w-[160px] rounded-full mb-6" />
            <div className="flex items-center gap-3 mb-8">
              <Skeleton className="h-[56px] w-[220px] rounded-full" />
              <Skeleton className="w-[52px] h-[52px] rounded-full" />
            </div>
            <div className="flex space-x-8">
              <Skeleton className="h-[40px] w-[120px] rounded-xl" />
              <Skeleton className="h-[40px] w-[120px] rounded-xl" />
              <Skeleton className="h-[40px] w-[120px] rounded-xl" />
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