import Container from "@/components/Container";
import { Skeleton } from "@/components/ui/Skeleton";

// Fallback Next na czas renderu dokumentu — geometria 1:1 z [slug]/page.tsx:
// okruszki, sidebar (desktop) / rząd pigułek (telefon) i biała karta dokumentu.
export default function Loading() {
  return (
    <Container className="lg:mt-10 md:mt-7 sm:mt-10 mt-7 md:px-10 sm:px-8 px-6 mb-20 max-w-[1300px] font-poppins">
      <div className="flex items-center gap-2">
        <Skeleton className="h-[15px] w-[110px] rounded-full" />
        <Skeleton className="size-4 rounded-full" />
        <Skeleton className="h-[15px] w-[140px] rounded-full" />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:mt-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-10">
        <div className="flex gap-2 overflow-hidden lg:hidden">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-[38px] w-[140px] shrink-0 rounded-full bg-white" />
          ))}
        </div>
        <div className="hidden lg:flex h-fit flex-col gap-2 rounded-[30px] border border-[#E8E8E8] bg-white p-3">
          <Skeleton className="h-[40px] w-full rounded-[18px]" />
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-[40px] w-full rounded-[18px]" />
          ))}
        </div>

        <div className="min-w-0 rounded-[30px] border border-[#E8E8E8] bg-white px-5 py-8 sm:px-8 md:px-12 md:py-12">
          <div className="max-w-[760px]">
            <Skeleton className="size-14 rounded-full" />
            <Skeleton className="mt-5 h-[36px] w-[60%] rounded-full" />
            <Skeleton className="mt-4 h-[17px] w-full rounded-full" />
            <Skeleton className="mt-2 h-[17px] w-[80%] rounded-full" />
            <Skeleton className="mt-6 h-[1px] w-full rounded-none" />
            <Skeleton className="mt-5 h-[14px] w-[260px] rounded-full" />
            <div className="mt-10 space-y-3">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className={`h-[15px] rounded-full ${index % 3 === 2 ? "w-[65%]" : "w-full"}`} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </Container>
  );
}
