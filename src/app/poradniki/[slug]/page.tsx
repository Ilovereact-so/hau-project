import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Clock } from "lucide-react";
import Container from "@/components/Container";
import GuideBody from "@/components/guides/GuideBody";
import GuideCard, { formatGuideDate } from "@/components/guides/GuideCard";
import VideoPlayer from "@/components/guides/VideoPlayer";
import { urlFor } from "@/sanity/lib/image";
import { estimateReadingTime } from "@/lib/video";
import { getGuideBySlug, getRelatedGuides } from "@/sanity/helpers";
import { pageMetadata } from "@/lib/seo/metadata";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = await getGuideBySlug(slug);
  if (!guide) return {};

  const cover = guide.coverImage?.asset ? urlFor(guide.coverImage).width(1200).height(630).url() : null;

  const meta = pageMetadata({
    title: guide.title,
    description: guide.excerpt,
    path: `/poradniki/${slug}`,
    images: cover ? [{ url: cover, width: 1200, height: 630, alt: guide.title }] : undefined,
    type: "article",
  });
  return {
    ...meta,
    // Data publikacji wpisu — tylko dla typu `article`.
    openGraph: { ...meta.openGraph, type: "article", publishedTime: guide.publishedAt },
  };
}

const GuidePage = async ({ params }: PageProps) => {
  const { slug } = await params;
  const guide = await getGuideBySlug(slug);

  // W przeciwieństwie do /help nie ma tu listy kanonicznej ratującej link do
  // nieistniejącego dokumentu — poradniki nie są nigdzie podlinkowane na stałe,
  // więc slug spoza Sanity to zwyczajne 404.
  if (!guide) return notFound();

  const related = await getRelatedGuides(slug, guide.category?._id, 3);

  const date = formatGuideDate(guide.publishedAt);
  const readingTime = guide.readingTime ?? estimateReadingTime(guide.body);
  const hasHeroVideo = Boolean(guide.heroVideo?.url || guide.heroVideo?.fileUrl);
  const cover = guide.coverImage?.asset ? urlFor(guide.coverImage).width(1600).url() : null;

  return (
    <Container className="lg:mt-10 md:mt-7 sm:mt-10 mt-7 md:px-10 sm:px-8 px-6 min-h-[100vh] mb-20 mx-auto max-w-[1410px]">
      {/* Breadcrumb — ten sam wzorzec co na /help i na stronie subkategorii */}
      <div className="flex items-center space-x-2 flex-wrap font-poppins">
        <Link
          href="/poradniki"
          className="text-[#6c6c6c] text-[clamp(14px,1.4vw,15px)] hover:underline underline-offset-2"
        >
          Poradniki
        </Link>
        <p>/</p>
        <span className="text-black text-[clamp(14px,1.4vw,16px)] line-clamp-1">{guide.title}</span>
      </div>

      <article className="mt-3 font-poppins">
        <header className="">          
          <h1 className="text-black font-medium 2lg:text-[clamp(23px,2.5vw,26px)] text-[21px]">
            {guide.title}
          </h1>

          <div className="flex items-center flex-wrap gap-x-3 gap-y-2 text-[#3D3D3D] text-[13px] mt-2 bg-[#efefef] w-fit px-3 py-2 rounded-[16px] font-poppins">
            {guide.category && (
              <span className="bg-main text-black font-medium px-3 py-[5px] rounded-full">
                {guide.category.title}
              </span>
            )}
            {date && <span>{date}</span>}
            <span className="inline-flex items-center gap-1">
              <Clock className="w-[14px] h-[14px]" />
              {readingTime} min czytania
            </span>
            {guide.author && <span>· {guide.author}</span>}
          </div>

          <p className="sm:text-[16px] text-[15px] text-[#6C6C6C] mt-3">
            {guide.excerpt}
          </p>
        </header>

        {/* Film otwierający ma pierwszeństwo przed okładką — jeśli poradnik jest
            wideo, nie ma sensu kazać widzowi najpierw przewijać zdjęcia. */}
        <div className="mt-8 ">
          {hasHeroVideo ? (
            <VideoPlayer value={guide.heroVideo} posterFallback={guide.coverImage} priority />
          ) : cover ? (
            <div className="relative w-full aspect-[16/9] overflow-hidden rounded-[24px] bg-[#EDEDED]">
              <Image
                src={cover}
                alt={guide.coverImage?.alt || guide.title}
                fill
                sizes="(max-width: 1024px) 100vw, 1000px"
                priority
                className="object-cover"
              />
            </div>
          ) : null}
        </div>

        <div className="mt-10 ">
          <GuideBody value={guide.body} />
        </div>
      </article>

      {related.length > 0 && (
        <section className="mt-16 pt-10 border-t border-[#E6E6E6]">
          <h2 className="font-poppins font-medium text-black text-[clamp(17px,1.9vw,24px)] mb-6">
            Zobacz też
          </h2>
          <div className="flex font-poppins">
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
