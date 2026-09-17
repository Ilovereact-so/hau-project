import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, FileText } from "lucide-react";
import Container from "@/components/Container";
import PortableTextContent from "@/components/PortableTextContent";
import { getHelpDocumentBySlug } from "@/sanity/helpers";
import { HELP_DOCUMENTS } from "@/constants";
import { pageMetadata } from "@/lib/seo/metadata";

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

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const doc = await getHelpDocumentBySlug(slug);
  const fallbackTitle = HELP_DOCUMENTS.find((d) => d.slug === slug)?.title;
  const title = doc?.title ?? fallbackTitle;
  if (!title) return {};
  return pageMetadata({
    title,
    description: doc?.lead ?? `${title} w Centrum pomocy sklepu HAU.`,
    path: `/help/${slug}`,
  });
}

const HelpDocumentPage = async ({ params }: PageProps) => {
  const { slug } = await params;

  const doc = await getHelpDocumentBySlug(slug);

  // Dokument może jeszcze nie istnieć w Sanity — wtedy ratujemy się kanoniczną
  // listą, żeby link ze stopki nie prowadził w 404 tylko dlatego, że admin nie
  // zdążył wypełnić treści. Dopiero slug, którego nie ma ANI w Sanity, ANI na
  // liście kanonicznej, jest realnym 404.
  const fallback = HELP_DOCUMENTS.find((d) => d.slug === slug);
  if (!doc && !fallback) return notFound();

  const title = doc?.title ?? fallback!.title;
  const updatedAt = formatUpdatedAt(doc?.updatedAt);
  const hasBody = Boolean(doc?.body && doc.body.length > 0);

  return (
    <Container className="lg:mt-10 md:mt-7 sm:mt-10 mt-7 md:px-10 sm:px-8 px-6 min-h-[100vh] mb-16">
      {/* Breadcrumb — ten sam wzorzec co na stronie subkategorii */}
      <div className="flex items-center space-x-2 flex-wrap">
        <Link
          href="/help"
          className="text-black text-[clamp(14px,1.4vw,16px)] hover:underline underline-offset-2"
        >
          Centrum pomocy
        </Link>
        <ChevronRight className="text-black w-[20px] h-[20px]" />
        <h1 className="text-black text-[clamp(14px,1.4vw,16px)]">{title}</h1>
      </div>

      <div className="flex mt-6 w-full">
        <article className="bg-white rounded-[30px] md:px-10 sm:px-8 px-5 md:py-10 py-7 min-w-0">
          <header className="border-b border-[#E6E6E6] pb-6 mb-6">
            <h1 className="text-black font-poppins font-semibold text-[clamp(24px,3vw,38px)] leading-tight">
              {title}
            </h1>
            {doc?.lead && (
              <p className="text-[#4E4E4E] text-[clamp(14px,1.5vw,17px)] leading-relaxed mt-3">
                {doc.lead}
              </p>
            )}
            {updatedAt && (
              <p className="text-[#6C6C6C] text-[13px] mt-4">
                Ostatnia aktualizacja: {updatedAt}
              </p>
            )}
          </header>

          {hasBody ? (
            <div className="font-poppins">
              <PortableTextContent value={doc!.body} />
            </div>
          ) : (
            // Stan przejściowy: strona istnieje i jest podlinkowana, ale admin nie
            // dodał jeszcze treści w Studio.
            <div className="flex flex-col items-center text-center py-12 px-4">
              <div className="bg-[#F5F5F5] rounded-full p-5">
                <FileText className="w-[28px] h-[28px] text-[#8A8A8A]" />
              </div>
              <p className="text-black font-medium text-[clamp(15px,1.6vw,18px)] mt-5">
                Treść w przygotowaniu
              </p>
              <p className="text-[#6C6C6C] text-[clamp(13px,1.4vw,15px)] mt-2 max-w-[420px] leading-relaxed">
                Ten dokument nie ma jeszcze uzupełnionej treści. Wróć tu wkrótce albo
                skontaktuj się z nami — chętnie odpowiemy na pytania.
              </p>
            </div>
          )}
        </article>
      </div>
    </Container>
  );
};

export default HelpDocumentPage;
