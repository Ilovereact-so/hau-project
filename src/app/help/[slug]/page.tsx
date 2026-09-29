import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarDays, ChevronRight, Clock, FileClock } from "lucide-react";
import Container from "@/components/Container";
import HelpSidebar from "@/components/HelpSidebar";
import PortableTextContent from "@/components/PortableTextContent";
import GuideToc from "@/components/guides/GuideToc";
import HelpSupportPanel from "@/components/help/HelpSupportPanel";
import { helpIcon } from "@/components/help/helpIcons";
import { getHelpDocumentBySlug } from "@/sanity/helpers";
import { HELP_DOCUMENTS } from "@/constants";
import { flattenHelpNavigation, getHelpNavigation, type HelpNavItem } from "@/lib/helpNavigation";
import { guideHeadings } from "@/lib/guides/content";
import { estimateReadingTime } from "@/lib/video";
import { breadcrumbJsonLd, jsonLdScript, pageMetadata } from "@/lib/seo/metadata";

type PageProps = {
  params: Promise<{ slug: string }>;
};

const formatUpdatedAt = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
};

/** Spis treści pokazujemy od 3 sekcji — przy krótszych tylko by zawadzał. */
const TOC_MIN_HEADINGS = 3;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const doc = await getHelpDocumentBySlug(slug);
  const fallback = HELP_DOCUMENTS.find((d) => d.slug === slug);
  const title = doc?.title ?? fallback?.title;
  if (!title) return {};
  return pageMetadata({
    title,
    description: doc?.lead ?? fallback?.description ?? `${title} w Centrum pomocy sklepu HAU.`,
    path: `/help/${slug}`,
  });
}

/** Karta „Poprzedni / Następny dokument” pod treścią. */
const PagerLink = ({ item, direction }: { item: HelpNavItem; direction: "prev" | "next" }) => {
  const isNext = direction === "next";
  return (
    <Link
      href={`/help/${item.slug}`}
      rel={isNext ? "next" : "prev"}
      className={`group flex items-center gap-4 rounded-[24px] border border-[#E8E8E8] bg-white px-5 py-4 transition duration-300 ease-in-out hover:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6EB0A6] ${
        isNext ? "sm:col-start-2 justify-end text-right" : ""
      }`}
    >
      {!isNext && (
        <ArrowLeft className="size-5 shrink-0 text-[#6EB0A6] transition-transform group-hover:-translate-x-[3px]" aria-hidden />
      )}
      <span className="flex flex-col">
        <span className="text-[13px] text-[#8A8A8A]">{isNext ? "Następny dokument" : "Poprzedni dokument"}</span>
        <span className="text-fancy-black font-medium text-[clamp(15px,1.4vw,17px)]">{item.title}</span>
      </span>
      {isNext && (
        <ArrowRight className="size-5 shrink-0 text-[#6EB0A6] transition-transform group-hover:translate-x-[3px]" aria-hidden />
      )}
    </Link>
  );
};

const HelpDocumentPage = async ({ params }: PageProps) => {
  const { slug } = await params;

  const [doc, navigation] = await Promise.all([getHelpDocumentBySlug(slug), getHelpNavigation()]);

  // Dokument może jeszcze nie istnieć w Sanity — wtedy ratujemy się kanoniczną
  // listą, żeby link ze stopki nie prowadził w 404 tylko dlatego, że admin nie
  // zdążył wypełnić treści. Dopiero slug, którego nie ma ANI w Sanity, ANI na
  // liście kanonicznej, jest realnym 404.
  const fallback = HELP_DOCUMENTS.find((d) => d.slug === slug);
  if (!doc && !fallback) return notFound();

  const title = doc?.title ?? fallback!.title;
  const lead = doc?.lead?.trim() || null;
  const updatedAt = formatUpdatedAt(doc?.updatedAt);
  const hasBody = Boolean(doc?.body && doc.body.length > 0);
  const readingTime = hasBody ? estimateReadingTime(doc!.body) : null;
  const Icon = helpIcon(slug);

  // Kotwice nagłówków — ta sama funkcja co w poradnikach, więc spis treści
  // (GuideToc) i atrybuty `id` w treści zawsze do siebie pasują.
  const headings = hasBody ? guideHeadings(doc!.body) : [];
  const tocHeadings = headings.filter((heading) => heading.level <= 3);
  const anchors = new Map(headings.map((heading) => [heading.key, heading.id]));

  // Poprzedni / następny w kolejności z /help (grupy → dokumenty).
  const ordered = flattenHelpNavigation(navigation);
  const index = ordered.findIndex((item) => item.slug === slug);
  const prev = index > 0 ? ordered[index - 1] : null;
  const next = index >= 0 && index < ordered.length - 1 ? ordered[index + 1] : null;

  return (
    <Container className="lg:mt-10 md:mt-7 sm:mt-10 mt-7 md:px-10 sm:px-8 px-6 mb-20 max-w-[1300px] font-poppins">
      <script
        {...jsonLdScript(
          breadcrumbJsonLd([
            { name: "Centrum pomocy", path: "/help" },
            { name: title, path: `/help/${slug}` },
          ]),
        )}
      />

      {/* Okruszki — ten sam wzorzec co na stronie subkategorii; bez <h1>, żeby
          na stronie był dokładnie jeden nagłówek pierwszego stopnia (tytuł). */}
      <nav aria-label="Okruszki" className="flex flex-wrap items-center gap-2 text-[clamp(14px,1.4vw,15px)]">
        <Link href="/help" className="text-[#6C6C6C] hover:text-black hover:underline underline-offset-2">
          Centrum pomocy
        </Link>
        <ChevronRight className="size-4 text-[#9A9A9A]" aria-hidden />
        <span aria-current="page" className="text-black">
          {title}
        </span>
      </nav>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:mt-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-10">
        <HelpSidebar items={navigation} activeSlug={slug} />

        <div className="min-w-0">
          <article className="rounded-[30px] border border-[#E8E8E8] bg-white shadow-[0_4px_18px_-10px_rgba(32,32,31,0.18)] px-5 py-8 sm:px-8 md:px-12 md:py-12">
            <header className="max-w-[760px]">
              <span className="grid size-14 place-items-center rounded-full bg-[#e2f3f0] text-[#6EB0A6]" aria-hidden>
                <Icon className="size-[26px]" />
              </span>
              <h1 className="mt-5 text-fancy-black font-semibold text-[clamp(26px,3.4vw,40px)] leading-[1.15] tracking-[-0.02em]">
                {title}
              </h1>
              {lead && (
                <p className="mt-4 text-[#555555] text-[clamp(15px,1.6vw,18px)] leading-[1.6]">{lead}</p>
              )}
              {(updatedAt || readingTime) && (
                <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#EAEAEA] pt-5 text-[14px] text-[#5A5A5A]">
                  {updatedAt && (
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="size-4 text-[#8A8A8A]" aria-hidden />
                      Ostatnia aktualizacja: <time dateTime={doc?.updatedAt}>{updatedAt}</time>
                    </span>
                  )}
                  {readingTime && (
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="size-4 text-[#8A8A8A]" aria-hidden />
                      {readingTime} min czytania
                    </span>
                  )}
                </div>
              )}
            </header>

            {hasBody ? (
              <>
                {tocHeadings.length >= TOC_MIN_HEADINGS && (
                  <div className="mt-8 max-w-[760px]">
                    <GuideToc headings={headings} variant="inline" />
                  </div>
                )}
                <div className="mt-8 max-w-[760px] font-poppins">
                  <PortableTextContent value={doc!.body} anchors={anchors} />
                </div>
              </>
            ) : (
              // Stan przejściowy: strona istnieje i jest podlinkowana, ale admin nie
              // dodał jeszcze treści w Studio. Wygląd jak na stronie 404 — miętowe
              // koło z ikoną i konkretne drogi dalej zamiast pustki.
              <div className="mt-8 flex flex-col items-center rounded-[24px] bg-[#F7F7F7] px-5 py-12 text-center">
                <span className="grid size-16 place-items-center rounded-full bg-[#e2f3f0]" aria-hidden>
                  <FileClock className="size-7 text-[#6EB0A6]" />
                </span>
                <p className="mt-5 text-black font-medium text-[clamp(16px,1.6vw,19px)]">Treść w przygotowaniu</p>
                <p className="mt-2 max-w-[440px] text-[#6C6C6C] text-[clamp(13px,1.4vw,15px)] leading-relaxed">
                  Ten dokument nie ma jeszcze uzupełnionej treści. Wróć tu wkrótce albo zajrzyj do
                  pozostałych tematów w Centrum pomocy.
                </p>
                <Link
                  href="/help"
                  className="mt-6 rounded-full bg-fancy-black px-8 py-3 text-[15px] font-medium text-white transition-colors hover:bg-black"
                >
                  Wszystkie tematy
                </Link>
              </div>
            )}
          </article>

          {(prev || next) && (
            <nav aria-label="Pozostałe dokumenty" className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {prev && <PagerLink item={prev} direction="prev" />}
              {next && <PagerLink item={next} direction="next" />}
            </nav>
          )}

          <HelpSupportPanel className="mt-10" />
        </div>
      </div>
    </Container>
  );
};

export default HelpDocumentPage;
