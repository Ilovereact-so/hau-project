import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Container from "@/components/Container";
import HelpSupportPanel from "@/components/help/HelpSupportPanel";
import { helpIcon } from "@/components/help/helpIcons";
import { Paw_Filled } from "@/components/ui/paw";
import { getHelpNavigation, groupHelpNavigation, type HelpNavItem } from "@/lib/helpNavigation";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Centrum pomocy",
  description:
    "Regulamin, polityka prywatności, polityka cookies, dostawa, formy płatności oraz zwroty i reklamacje w sklepie HAU.",
  path: "/help",
});

/** Kafelek tematu — biała karta z miętową ikoną, jak kafelki kolekcji i poradników. */
const HelpTopicCard = ({ item }: { item: HelpNavItem }) => {
  const Icon = helpIcon(item.slug);
  return (
    <Link
      href={`/help/${item.slug}`}
      className="group flex h-full flex-col rounded-[30px] border border-[#E8E8E8] bg-white p-6 shadow-[0_4px_18px_-10px_rgba(32,32,31,0.18)] transition duration-300 ease-in-out hover:scale-[0.98] hover:shadow-[0_12px_30px_-14px_rgba(32,32,31,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6EB0A6]"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#e2f3f0] text-[#6EB0A6] transition-colors group-hover:bg-main group-hover:text-fancy-black">
          <Icon className="size-[22px]" aria-hidden />
        </span>
        {!item.hasContent && (
          <span className="rounded-full bg-[#EDEDED] px-3 py-1 text-[12px] text-[#6C6C6C]">
            W przygotowaniu
          </span>
        )}
      </div>
      <h3 className="mt-5 text-fancy-black font-medium text-[clamp(16px,1.6vw,19px)]">{item.title}</h3>
      {item.description && (
        <p className="mt-2 text-[#6C6C6C] text-[clamp(13px,1.3vw,15px)] leading-relaxed line-clamp-2">
          {item.description}
        </p>
      )}
      <span className="mt-auto flex items-center gap-2 pt-5 text-fancy-black font-medium text-[clamp(14px,1.3vw,15px)]">
        Czytaj
        <ArrowRight className="size-4 text-[#6EB0A6] transition-transform group-hover:translate-x-[3px]" aria-hidden />
      </span>
    </Link>
  );
};

// Indeks Centrum pomocy. Lista bierze się z getHelpNavigation, więc dokument
// dodany przez admina w Studio pojawia się tu automatycznie — bez zmian w kodzie
// (w grupie „Pozostałe dokumenty”).
const HelpIndexPage = async () => {
  const groups = groupHelpNavigation(await getHelpNavigation());

  return (
    <Container className="lg:mt-10 md:mt-7 sm:mt-10 mt-7 md:px-10 sm:px-8 px-6 mb-20 max-w-[1300px] font-poppins">
      <header className="max-w-[760px]">
        <div className="flex items-center gap-2">
          <Paw_Filled className="size-[18px] text-[#6eb0a6]" />
          <span className="text-black text-[clamp(14px,1.4vw,16px)]">Centrum pomocy</span>
        </div>
        <h1 className="mt-2 font-medium text-black sm:text-[clamp(22px,2.6vw,34px)] text-[20px] leading-tight text-balance">
          Wszystko, co warto wiedzieć o zakupach w HAU
        </h1>
        <p className="mt-3 text-[#4E4E4E] text-[clamp(14px,1.4vw,17px)] leading-relaxed">
          Dostawa, płatności, zwroty i dokumenty sklepu w jednym miejscu. Wybierz temat —
          dłuższe dokumenty mają spis treści, więc szybko trafisz do potrzebnego fragmentu.
        </p>
      </header>

      {groups.map((group) => (
        <section key={group.id} aria-labelledby={`help-group-${group.id}`} className="mt-12 sm:mt-14">
          <h2
            id={`help-group-${group.id}`}
            className="mb-5 text-fancy-black font-medium text-[clamp(17px,1.9vw,22px)]"
          >
            {group.title}
          </h2>
          <ul className="grid lg:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-4 sm:gap-5">
            {group.items.map((item) => (
              <li key={item.slug}>
                <HelpTopicCard item={item} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      <HelpSupportPanel className="mt-16 sm:mt-20" />
    </Container>
  );
};

export default HelpIndexPage;
