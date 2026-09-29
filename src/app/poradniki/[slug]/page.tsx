import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Container from "@/components/Container";
import GuideArticle from "@/components/guides/GuideArticle";
import GuideCard from "@/components/guides/GuideCard";
import GuideShare from "@/components/guides/GuideShare";
import type { EmbedProduct } from "@/components/guides/GuideBlocks";
import { urlFor } from "@/sanity/lib/image";
import { estimateReadingTime } from "@/lib/video";
import { guideStats } from "@/lib/guides/content";
import { effectivePrice } from "@/lib/omnibus";
import { getGuideBySlug, getRelatedGuides, type Guide } from "@/sanity/helpers";
import { breadcrumbJsonLd, jsonLdScript, pageMetadata } from "@/lib/seo/metadata";
import { SITE_NAME, SITE_URL, absoluteUrl } from "@/lib/site";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = await getGuideBySlug(slug);
  if (!guide) return {};

  const cover = guide.coverImage?.asset ? urlFor(guide.coverImage).width(1200).height(630).url() : null;
  // Tytuł/opis SEO z panelu mają pierwszeństwo — zwykle są krótsze niż tytuł wpisu.
  const title = guide.seoTitle?.trim() || guide.title;

  const meta = pageMetadata({
    title,
    description: guide.seoDescription?.trim() || guide.excerpt,
    path: `/poradniki/${slug}`,
    images: cover ? [{ url: cover, width: 1200, height: 630, alt: guide.coverImage?.alt || guide.title }] : undefined,
    type: "article",
  });
  return {
    ...meta,
    // Daty i autor wpisu — tylko dla typu `article`.
    openGraph: {
      ...meta.openGraph,
      type: "article",
      publishedTime: guide.publishedAt,
      modifiedTime: guide.updatedAt,
      authors: [guide.author?.trim() || `Zespół ${SITE_NAME}`],
      section: guide.category?.title,
    },
  };
}

/**
 * Bloki „Polecane produkty” przychodzą z GROQ z surowymi danymi produktu —
 * tu liczymy cenę tak samo jak kafelki sklepu (pierwszy wariant → produkt).
 */
function withProductPrices(body: Guide["body"]) {
  if (!Array.isArray(body)) return body;
  return body.map((block) => {
    if (block?._type !== "productEmbed" || !Array.isArray(block.items)) return block;
    const items: EmbedProduct[] = block.items.filter(Boolean).map((item: any) => ({
      _id: item._id,
      title: item.title,
      subtitle: item.subtitle ?? null,
      slug: item.slug ?? null,
      price: effectivePrice(item, item.variants?.[0]?._key ?? null),
      imageUrl: item.imageUrl ?? null,
    }));
    return { ...block, items };
  });
}

const GuidePage = async ({ params }: PageProps) => {
  const { slug } = await params;
  const guide = await getGuideBySlug(slug);

  // W przeciwieństwie do /help nie ma tu listy kanonicznej ratującej link do
  // nieistniejącego dokumentu — poradniki nie są nigdzie podlinkowane na stałe,
  // więc slug spoza Sanity to zwyczajne 404.
  if (!guide) return notFound();

  const related = await getRelatedGuides(slug, guide.category?._id, 3);
  const body = withProductPrices(guide.body);
  const readingTime = guide.readingTime ?? estimateReadingTime(guide.body);
  const path = `/poradniki/${slug}`;
  const author = guide.author?.trim() || `Zespół ${SITE_NAME}`;
  const cover = guide.coverImage?.asset ? urlFor(guide.coverImage).width(1200).height(630).url() : null;

  // Dane strukturalne artykułu — Google pokazuje z nich datę, autora
  // i miniaturę w wynikach (oraz w Discover).
  const articleLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: guide.title.slice(0, 110),
    description: guide.seoDescription?.trim() || guide.excerpt,
    ...(cover ? { image: [cover] } : {}),
    datePublished: guide.publishedAt,
    dateModified: guide.updatedAt ?? guide.publishedAt,
    inLanguage: "pl-PL",
    ...(guide.category?.title ? { articleSection: guide.category.title } : {}),
    wordCount: guideStats(guide.body).words,
    author:
      author === `Zespół ${SITE_NAME}`
        ? { "@type": "Organization", name: author, url: SITE_URL }
        : { "@type": "Person", name: author },
    publisher: {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      logo: { "@type": "ImageObject", url: absoluteUrl("/logo_hau.svg") },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": absoluteUrl(path) },
  };
  const EDGE_FADE_SIZE = 30; // px
  const maskImage = `linear-gradient(to bottom, transparent 0, black ${EDGE_FADE_SIZE}px, black calc(100% - ${EDGE_FADE_SIZE}px), transparent 100%)`

  return (
    <Container className="lg:mt-10 md:mt-7 sm:mt-10 mt-7 md:px-10 sm:px-8 px-6 min-h-[100vh] mb-20 mx-auto max-w-[1410px] "> {/** patern py-6 px-4 rounded-[30px] style={{ WebkitMaskImage: maskImage, maskImage }}*/}
      <script {...jsonLdScript(articleLd)} />
      <script
        {...jsonLdScript(
          breadcrumbJsonLd([
            { name: "Poradniki", path: "/poradniki" },
            { name: guide.title, path },
          ]),
        )}
      />

      {/* Breadcrumb — ten sam wzorzec co na /help i na stronie subkategorii */}
      <nav aria-label="Okruszki" className="mx-auto mb-8 flex max-w-[1024px] items-center space-x-2 flex-wrap font-poppins">
        <Link
          href="/poradniki"
          className="text-[#6c6c6c] text-[clamp(14px,1.4vw,15px)] hover:underline underline-offset-2"
        >
          Poradniki
        </Link>
        {guide.category && (
          <>
            <span className="text-[#B0B0B0]">/</span>
            <span className="text-[#6c6c6c] text-[clamp(14px,1.4vw,15px)]">{guide.category.title}</span>
          </>
        )}
      </nav>

      <GuideArticle
        guide={{
          title: guide.title,
          excerpt: guide.excerpt,
          category: guide.category,
          author: guide.author,
          publishedAt: guide.publishedAt,
          updatedAt: guide.updatedAt,
          readingTime,
          coverImage: guide.coverImage,
          heroVideo: guide.heroVideo,
          body,
        }}
        footer={
          <div className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-[#EAEAEA] pt-6">
            <Link
              href="/poradniki"
              className="inline-flex items-center gap-2 font-poppins text-[15px] font-medium text-[#20201F] hover:underline underline-offset-4"
            >
              <ArrowLeft className="size-4" />
              Wszystkie poradniki
            </Link>
            <GuideShare title={guide.title} url={absoluteUrl(path)} />
          </div>
        }
      />

      {related.length > 0 && (
        <section className="mx-auto mt-20 max-w-[1100px] border-t border-[#E6E6E6] pt-10">
          <h2 className="font-poppins font-medium text-black text-[clamp(17px,1.9vw,24px)] mb-6">
            Zobacz też
          </h2>
          <div className="flex flex-col gap-4 font-poppins">
            {related.map((item) => (
              <GuideCard key={item._id} guide={item} />
            ))}
          </div>
        </section>
      )}
    </Container>
  );
};

export default GuidePage;
