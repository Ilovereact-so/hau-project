import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ChevronRight, PackageSearch } from "lucide-react";
import Container from "@/components/Container";
import ProductItemWithoutBTN from "@/components/ProductItemWithoutBTN";
import { getCollectionBySlug, type CollectionDetail } from "@/sanity/helpers";
import { urlFor } from "@/sanity/lib/image";
import { isCollectionSort } from "@/sanity/lib/collectionRefs";
import SortSelect from "@/components/SortSelect";
import { parseProductSort } from "@/lib/productSort";
import { sortProductsForListing } from "@/lib/productListing";
import { pageMetadata } from "@/lib/seo/metadata";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function productsLabel(count: number) {
  if (count === 1) return "produkt";
  const last = count % 10;
  const lastTwo = count % 100;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return "produkty";
  return "produktów";
}

function heroImageUrl(collection: CollectionDetail, width: number, height: number): string | null {
  const source = collection.image?.asset ? collection.image : collection.coverProductImage?.asset ? collection.coverProductImage : null;
  if (!source) return null;
  try {
    return urlFor(source as Parameters<typeof urlFor>[0]).width(width).height(height).fit("crop").auto("format").url();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug).catch(() => null);
  if (!collection) return { title: "Kolekcja" };
  const image = heroImageUrl(collection, 1200, 630);
  // Inna kolejność produktów to ta sama kolekcja — kanoniczny jest czysty adres.
  const sorted = Boolean((await searchParams).sort);
  return pageMetadata({
    title: collection.metaTitle || `${collection.title} — kolekcja`,
    description: collection.metaDescription || collection.description || `Produkty z kolekcji ${collection.title}.`,
    path: `/kolekcje/${slug}`,
    images: image ? [{ url: image, width: 1200, height: 630, alt: collection.title }] : undefined,
    index: !sorted,
  });
}

const CollectionPage = async ({ params, searchParams }: Props) => {
  const { slug } = await params;
  const sp = await searchParams;
  // Kolejność z adresu; bez niej obowiązuje domyślne sortowanie kolekcji
  // ustawione w Studio. Pobranie zostaje przy sortowaniu z GROQ (ono decyduje,
  // które produkty łapią się w limit), a wybór klienta nakładamy na wynik —
  // dzięki temu kolekcja ma te same opcje co subkategoria (popularne, oceny,
  // obniżki), których GROQ nie policzy.
  const collection = await getCollectionBySlug(slug);
  if (!collection) notFound();

  const collectionDefault = isCollectionSort(collection.sort) ? collection.sort : "newest";
  const sort = parseProductSort(sp.sort, collectionDefault);
  const products = await sortProductsForListing(collection.products, sort);

  const hero = heroImageUrl(collection, 1600, 700);
  const heroAlt = collection.image?.alt || collection.title;
  const count = products.length;

  return (
    <Container id="sub-category-container" className="flex justify-center lg:mt-10 md:mt-7 sm:mt-10 mt-7 md:px-10 sm:px-8 px-6 min-h-[100vh] font-poppins">
      <div className="flex flex-col h-full w-auto relative">
        <div className="flex w-full relative z-[3]">
            <div className="flex flex-col space-y-1">
                <div className="flex items-center space-x-2">
                    <nav aria-label="Ścieżka" className="flex items-center space-x-2 text-black text-[clamp(14px,1.4vw,16px)]">
                      <Link href="/kolekcje" className="hover:underline underline-offset-2">Kolekcje</Link>
                      <ChevronRight className="w-[18px] h-[18px]" aria-hidden="true" />
                      <span className="text-[#6C6C6C]">{collection.title}</span>
                    </nav>
                </div>
                
            </div>
        </div>
        {/* <div className="flex justify-center w-full mt-[clamp(30px,8vw,80px)]">
            <div className="flex subcategory-dock-shadow relative bg-fancy-black md:py-2 xs:py-3 py-2 md:pt-4 md:px-9 3xs:px-7 xs:px-4 px-3 rounded-full lg:w-[65vw] 2md:w-[70vw] w-[80vw] z-[1] min-h-[50px] max-w-[1350px]">
                <Image className="3xs:w-[clamp(300px,33vw,400px)] w-[250px] absolute bottom-[0] xl:left-[-200px] lg:left-[-15vw] 2md:left-[-12vw] left-[-8vw] z-[2] opacity-80" src='/white-holo.png' alt="white-holo" width={460} height={330}/>
                <div className="w-full flex justify-between">
                    <div className="flex flex-col w-full z-[3] relative space-y-2 pr-4">
                        <h1 className="text-white text-[clamp(16px,1.4vw,18px)] ml-1 max-md:hidden">Filtruj:</h1>                            
                        <SubcategoryFilterContainer subcategoryDetails={subCategoryDetails} products={products} paramsFilter={filters} initialMobile={initialMobile}/> 
                    </div>
                    <div className="flex md:flex-col flex-row-reverse md:space-y-2 h-fit relative z-[3]">
                        <div className="flex items-center justify-between 3xs:px-4 px-2">
                            <h1 className="text-white text-[clamp(16px,1.4vw,18px)] max-md:hidden">Sortuj:</h1>
                            <ArrowDown className="text-white w-[20px] h-[20px]"/>
                        </div>
                        <div className="xs:text-[clamp(15px,1.4vw,17px)] text-[14px] text-black bg-white 3xs:px-8 px-6 py-2 h-fit rounded-[20px] font-medium">Popularne</div>
                    </div>
                </div>
            </div>
        </div> */}
        {hero && (
          <div className="flex relative w-full h-[400px] mt-3">            
            <Image
              src={hero}
              alt={heroAlt}
              fill
              priority
              sizes="(max-width: 1900px) 100vw, 1900px"
              className="object-cover rounded-[20px]"
            />
            <div className="absolute z-2 sm:top-[30%] sm:bottom-10 bottom-3 sm:left-10 max-sm:p-4 max-sm:m-3 rounded-[30px] max-sm:bg-[#ffffff5d] max-sm:backdrop-blur-[6px]">
              <h1 className='text-white sm:text-[clamp(40px,5vw,96px)] text-[25px] font-poppins sm:font-bold font-medium 1xl:leading-[110px] sm:leading-[90px] leading-[40px]'>{collection.title}</h1>
              <div className='text-white sm:text-[clamp(16px,1.5vw,22px)] font-poppins text-[13.7px] mb-5 lg:max-w-[600px] max-w-[400px] '>
                {collection.description}
            </div>    
            </div>        
          </div>
        )}

      

      {/* <header className="relative mt-5 overflow-hidden rounded-[35px] bg-fancy-black min-h-[220px] sm:min-h-[300px] flex items-end">
        {hero && (
          <Image
            src={hero}
            alt={heroAlt}
            fill
            priority
            sizes="(max-width: 1900px) 100vw, 1900px"
            className="object-cover opacity-80"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" aria-hidden="true" />
        <div className="relative z-[1] p-6 sm:p-10 max-w-[760px]">
          <p className="text-white/80 text-[13px] sm:text-[15px]">Kolekcja</p>
          <h1 className="text-white font-medium text-[clamp(26px,4vw,52px)] leading-tight">{collection.title}</h1>
          {collection.description && (
            <p className="text-white/90 text-[clamp(14px,1.5vw,18px)] mt-2 whitespace-pre-line">{collection.description}</p>
          )}
        </div>
      </header> */}

      <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
        <p className="text-[#6C6C6C] text-[14px]" aria-live="polite">
          {count} {productsLabel(count)}
        </p>
        {count > 1 && (
          <SortSelect value={sort} buttonClassName="bg-[#EDEDED] hover:bg-[#e2f3f0] px-6 py-2 text-[14px]" />
        )}
      </div>

      {count === 0 ? (
        <div className="flex flex-col items-center text-center py-20 px-4">
          <div className="bg-[#EDEDED] rounded-full p-5">
            <PackageSearch className="w-[28px] h-[28px] text-[#6EB0A6]" aria-hidden="true" />
          </div>
          <p className="text-black font-medium text-[clamp(15px,1.6vw,18px)] mt-5">Kolekcja jest jeszcze pusta</p>
          <p className="text-[#6C6C6C] text-[clamp(13px,1.4vw,15px)] mt-2 max-w-[440px]">
            Pracujemy nad nią — zajrzyj niedługo albo sprawdź pozostałe kolekcje.
          </p>
          <Link href="/kolekcje" className="mt-6 rounded-full bg-fancy-black text-white font-bold px-8 py-3 hover:bg-fancy-black/90">
            Wszystkie kolekcje
          </Link>
        </div>
      ) : (
        <div className="grid justify-items-center 2.5xl:grid-cols-4 lg:grid-cols-4 sm:grid-cols-3 grid-cols-2 sm:gap-x-[18px] gap-x-3 md:gap-y-[75px] sm:gap-y-[65px] gap-y-[40px] sm:mt-10 mt-7 mb-15">
          {products.map((product) => (
            <ProductItemWithoutBTN key={product._id} product={product} />
          ))}
        </div>
      )}
      </div>
    </Container>
  );
};

export default CollectionPage;
