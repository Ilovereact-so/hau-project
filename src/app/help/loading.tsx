import Container from "@/components/Container";
import { Skeleton } from "@/components/ui/Skeleton";

// Fallback Next na czas renderu /help — geometria 1:1 z page.tsx: nagłówek
// (etykieta, tytuł, opis), dwie grupy kafelków i ciemny panel pomocy.
export default function Loading() {
  return (
    <Container className="lg:mt-10 md:mt-7 sm:mt-10 mt-7 md:px-10 sm:px-8 px-6 mb-20 max-w-[1300px] font-poppins">
      <div className="max-w-[760px]">
        <Skeleton className="h-[16px] w-[140px] rounded-full" />
        <Skeleton className="mt-3 h-[30px] w-[min(560px,90%)] rounded-full" />
        <Skeleton className="mt-4 h-[16px] w-full rounded-full" />
        <Skeleton className="mt-2 h-[16px] w-[70%] rounded-full" />
      </div>
      {[0, 1].map((group) => (
        <div key={group} className="mt-12 sm:mt-14">
          <Skeleton className="mb-5 h-[22px] w-[200px] rounded-full" />
          <div className="grid lg:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-4 sm:gap-5">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex min-h-[214px] flex-col rounded-[30px] border border-[#E8E8E8] bg-white p-6">
                <Skeleton className="size-12 rounded-full" />
                <Skeleton className="mt-5 h-[19px] w-[55%] rounded-full" />
                <Skeleton className="mt-3 h-[14px] w-full rounded-full" />
                <Skeleton className="mt-2 h-[14px] w-[75%] rounded-full" />
                <Skeleton className="mt-auto h-[15px] w-[70px] rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
      <Skeleton className="mt-16 sm:mt-20 h-[190px] w-full rounded-[40px] bg-[#2C2C2C]" />
    </Container>
  );
}
