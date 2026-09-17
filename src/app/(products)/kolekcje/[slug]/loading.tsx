import Container from "@/components/Container";
import { ProductCardSkeleton, Skeleton } from "@/components/ui/Skeleton";

// Szkielet strony kolekcji: ścieżka, nagłówek ze zdjęciem, pasek sortowania, siatka.
export default function Loading() {
  return (
    <Container className="lg:mt-10 md:mt-7 sm:mt-10 mt-7 md:px-10 sm:px-8 px-6 min-h-[100vh] font-poppins">
      <Skeleton className="h-[14px] w-[200px] rounded-full" />
      <Skeleton className="mt-5 rounded-[35px] min-h-[220px] sm:min-h-[300px] w-full" />
      <div className="flex justify-between items-center mt-8">
        <Skeleton className="h-[14px] w-[90px] rounded-full" />
        <Skeleton className="h-[36px] w-[320px] max-w-[60%] rounded-full" />
      </div>
      <div className="grid justify-items-center 2.5xl:grid-cols-4 lg:grid-cols-4 sm:grid-cols-3 grid-cols-2 sm:gap-x-[18px] gap-x-3 md:gap-y-[75px] sm:gap-y-[65px] gap-y-[40px] sm:mt-10 mt-7 mb-15 w-full">
        {Array.from({ length: 8 }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    </Container>
  );
}
