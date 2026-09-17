import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Container from "@/components/Container";
import { getHelpNavigation } from "@/lib/helpNavigation";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Centrum pomocy",
  description:
    "Regulamin, polityka prywatności, polityka cookies, dostawa, formy płatności oraz zwroty i reklamacje w sklepie HAU.",
  path: "/help",
});

// Indeks Centrum pomocy. Lista bierze się z getHelpNavigation, więc dokument
// dodany przez admina w Studio pojawia się tu automatycznie — bez zmian w kodzie.
const HelpIndexPage = async () => {
  const items = await getHelpNavigation();

  return (
    <Container className="lg:mt-10 md:mt-7 sm:mt-10 mt-7 md:px-10 sm:px-8 px-6 min-h-[100vh] mb-16">
      <div className="flex flex-col space-y-2">
        <h1 className="text-black text-[clamp(14px,1.4vw,16px)]">Centrum pomocy</h1>
        <h2 className="font-medium text-black sm:text-[clamp(18px,2vw,26px)] text-[16px]">
          Wszystko, co warto wiedzieć o zakupach w HAU
        </h2>
      </div>

      <div className="grid lg:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-4 sm:gap-5 mt-8">
        {items.map((item) => (
          <Link
            key={item.slug}
            href={`/help/${item.slug}`}
            className="group bg-fancy-black rounded-[28px] p-6 flex flex-col justify-between min-h-[150px] hover:bg-black transition-colors"
          >
            <div>
              <h3 className="text-white font-poppins font-medium text-[clamp(16px,1.6vw,19px)]">
                {item.title}
              </h3>
              {!item.hasContent && (
                <span className="inline-block text-[#B9BBB7] text-[12px] mt-2">
                  w przygotowaniu
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2 mt-6">
              <span className="text-main text-[clamp(13px,1.3vw,15px)]">Czytaj</span>
              <ArrowRight className="w-[16px] h-[16px] text-main transition-transform group-hover:translate-x-[3px]" />
            </div>
          </Link>
        ))}
      </div>
    </Container>
  );
};

export default HelpIndexPage;
