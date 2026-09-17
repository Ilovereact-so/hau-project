import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Layers } from "lucide-react";
import Container from "@/components/Container";
import { getAllCollections, type CollectionSummary } from "@/sanity/helpers";
import { urlFor } from "@/sanity/lib/image";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Kolekcje",
  description:
    "Zestawy produktów dobrane tematycznie: sezonowe kolekcje, akcesoria na spacery, wyprawki dla szczeniąt i więcej.",
  path: "/kolekcje",
});

function cover(collection: CollectionSummary): string | null {
  const source = collection.image?.asset ? collection.image : collection.coverProductImage?.asset ? collection.coverProductImage : null;
  if (!source) return null;
  try {
    return urlFor(source as Parameters<typeof urlFor>[0]).width(800).height(560).fit("crop").auto("format").url();
  } catch {
    return null;
  }
}

function productsLabel(count: number) {
  if (count === 1) return "produkt";
  const last = count % 10;
  const lastTwo = count % 100;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return "produkty";
  return "produktów";
}

const CollectionsIndexPage = async () => {
  // Pustych kolekcji nie pokazujemy na liście (ich strona nadal działa z banera).
  const collections = (await getAllCollections()).filter((c) => c.productCount > 0);

  return (
    <Container className="lg:mt-10 md:mt-7 sm:mt-10 mt-7 md:px-10 sm:px-8 px-6 mb-20 font-poppins">
      <header className="flex flex-col space-y-2 max-w-[760px]">
        <span className="text-black text-[clamp(14px,1.4vw,16px)]">Kolekcje</span>
        <h1 className="font-medium text-black sm:text-[clamp(22px,2.6vw,24px)] text-[19px] leading-tight">
          Nasze najbardziej polecane produkty
        </h1>
      </header>
      

      <div className="flex flex-wrap mt-10 p-6 rounded-[40px] backdrop-blur-[10px] bg-[#EDEDED]">
        {collections.length === 0 ? (
          <div className="flex flex-col items-center text-center p-6">
            <div className="bg-[#EDEDED] rounded-full p-5">
              <Layers className="w-[28px] h-[28px] text-[#6EB0A6]" aria-hidden="true" />
            </div>
            <p className="text-black font-medium text-[clamp(15px,1.6vw,18px)] mt-5">Kolekcje są w przygotowaniu</p>
          </div>
        ) : (
          <ul className="grid lg:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-6 ">
            {collections.map((collection) => {
              const image = cover(collection);
              return (
                <li key={collection._id}>
                  <Link
                    href={`/kolekcje/${encodeURIComponent(collection.slug)}`}
                    className="group block overflow-hidden rounded-[30px] bg-[#EDEDED] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6EB0A6]"
                  >
                    <div className="relative aspect-[10/7] overflow-hidden bg-[#e2f3f0]">
                      {image ? (
                        <Image
                          src={image}
                          alt={collection.image?.alt || collection.title}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="object-cover brightness-95 transition-transform duration-500 group-hover:scale-[1.04]"
                        />
                      ) : (
                        <Layers className="absolute inset-0 m-auto w-10 h-10 text-[#6EB0A6]" aria-hidden="true" />
                      )}
                    </div>
                    <div className="px-6 py-5">
                      <h2 className="text-black text-[clamp(17px,1.6vw,20px)] font-medium">{collection.title}</h2>
                      {collection.description && (
                        <p className="text-[#6C6C6C] text-[14px] mt-1 line-clamp-2">{collection.description}</p>
                      )}
                      <p className="text-black text-[13px] mt-3">
                        {collection.productCount} {productsLabel(collection.productCount)} →
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Container>
  );
};

export default CollectionsIndexPage;
