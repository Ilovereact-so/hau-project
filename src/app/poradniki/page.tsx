import React from "react";
import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import Container from "@/components/Container";
import GuideCard from "@/components/guides/GuideCard";
import GuidesGrid from "@/components/guides/GuidesGrid";
import { getAllGuides, getGuideCategories } from "@/sanity/helpers";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Poradniki",
  description:
    "Poradniki, filmy i praktyczna wiedza o psach: żywienie, szkolenie, pielęgnacja i zabawa. Bez mitów, na podstawie sprawdzonych źródeł.",
  path: "/poradniki",
});

const GuidesIndexPage = async () => {
  const [guides, categories] = await Promise.all([getAllGuides(), getGuideCategories()]);

  // Wyróżniony = ten oznaczony w Studio, a jak nie ma żadnego, to po prostu
  // najnowszy. Dzięki temu górna część strony nigdy nie jest pusta.
  const featured = guides.find((guide) => guide.featured) ?? guides[0] ?? null;
  const rest = featured ? guides.filter((guide) => guide._id !== featured._id) : guides;

  return (
    <Container className="lg:mt-10 md:mt-7 sm:mt-10 mt-7 md:px-10 sm:px-8 px-6 min-h-[100vh] mb-20">
      <header className="flex flex-col space-y-2 max-w-[760px]">
        <span className="text-black text-[clamp(14px,1.4vw,16px)] font-poppins">Poradniki</span>
        <h1 className="font-poppins font-medium text-black sm:text-[clamp(22px,2.6vw,34px)] text-[19px] leading-tight">
          Wiedza o psach, która realnie się przydaje
        </h1>
        <p className="text-[#4E4E4E] font-poppins text-[clamp(14px,1.4vw,17px)] leading-relaxed pt-1">
          Krótkie teksty i filmy o żywieniu, szkoleniu, pielęgnacji i zabawie — pisane przez
          ludzi, którzy sami mają psy i sami testują to, co sprzedajemy. Bez powielania mitów
          i bez ściemy marketingowej.
        </p>
      </header>

      {guides.length === 0 ? (
        // Stan przejściowy: sekcja istnieje i jest podlinkowana w menu, ale w Studio
        // nie ma jeszcze żadnego wpisu. Lepsze niż pusta strona bez wyjaśnienia.
        <div className="flex flex-col items-center text-center py-20 px-4">
          <div className="bg-[#F5F5F5] rounded-full p-5">
            <BookOpen className="w-[28px] h-[28px] text-[#8A8A8A]" />
          </div>
          <p className="text-black font-poppins font-medium text-[clamp(15px,1.6vw,18px)] mt-5">
            Pierwsze poradniki są w przygotowaniu
          </p>
          <p className="text-[#6C6C6C] font-poppins text-[clamp(13px,1.4vw,15px)] mt-2 max-w-[440px] leading-relaxed">
            Pracujemy nad materiałami o żywieniu, szkoleniu i pielęgnacji. Zajrzyj tu za
            chwilę — albo zapisz się do newslettera, damy znać, gdy ruszą.
          </p>
        </div>
      ) : (
        <>
          {featured && (
            <section className="mt-10 sm:mt-12">
              <GuideCard guide={featured} variant="featured" priority />
            </section>
          )}

          <section className="mt-14 sm:mt-16">
            <h2 className="font-poppins font-medium text-black text-[clamp(17px,1.9vw,24px)] mb-6">
              {featured ? "Pozostałe poradniki" : "Wszystkie poradniki"}
            </h2>
            <GuidesGrid guides={rest} categories={categories} />
          </section>
        </>
      )}
    </Container>
  );
};

export default GuidesIndexPage;
