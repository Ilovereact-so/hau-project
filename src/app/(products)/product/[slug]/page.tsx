import AddToCartButton from "@/components/AddToCardButton";
import ImageView from "@/components/ImageView";
import { getProductBySlug, getPromotedProducts, getRelatedProducts } from "@/sanity/helpers";
import PortableTextContent from "@/components/PortableTextContent";
import { isPromotionActive } from "@/lib/promotion";
import { isVariantAvailable } from "@/lib/stock";
import { Lock, RotateCcw, Truck } from "lucide-react";
import { notFound } from "next/navigation";
import React from "react";
import Link from "next/link";
import VariantManage from "@/components/VariantManage";
import ProductDetailsList from "@/components/ProductDetailsList";
import { GetSlugProduct } from "sanity.types";
import ProductPagePrice from "@/components/price/ProductPagePrice";
import ProductCarusel2 from "@/components/ProductCarusel2";
import { auth } from "@clerk/nextjs/server";
import ProductReviews from "@/components/reviews/ProductReviews";
import ProductRatingBadge from "@/components/reviews/ProductRatingBadge";
import { getReviewSummary, getUserReview, hasPurchasedProduct, listProductReviews } from "@/lib/reviews";
import { EMPTY_SUMMARY, type MyReview, type ReviewPage, type ReviewSummaryFull } from "@/lib/reviewsShared";
import { WishlistButton } from "@/components/WishlistButton";
import { getOmnibusForProducts } from "@/lib/priceHistory";
import type { ProductOmnibus } from "@/lib/omnibus";
import type { Metadata } from "next";
import { effectivePrice } from "@/lib/omnibus";
import { breadcrumbJsonLd, jsonLdScript, pageMetadata } from "@/lib/seo/metadata";
import ProductSafetyInfo, { type ProductSafety } from "@/components/product/ProductSafetyInfo";
import { getShopSettings } from "@/lib/shopSettings.server";
import { qualifiesForFreeShipping } from "@/lib/shopSettings";
import { RETURN_SHIPPING_PAID_BY_CUSTOMER, RETURN_WINDOW_DAYS, absoluteUrl } from "@/lib/site";
import { urlFor } from "@/sanity/lib/image";
import { imagesForVariant } from "@/lib/variantImages";
import { getProductPreviewForAdmin } from "@/lib/productPreview";

/**
 * Najniższa cena z 30 dni dla wszystkich wariantów. Przy okazji uzgadnia
 * rejestr cen z Sanity (z limitem). Awaria bazy nie wywraca strony —
 * komponent ceny dopyta wtedy API.
 */
async function loadOmnibus(productId: string): Promise<ProductOmnibus | null> {
  try {
    const result = await getOmnibusForProducts([productId], { reconcile: true });
    return result[productId] ?? null;
  } catch (err) {
    console.error("[product] omnibus failed", err);
    return null;
  }
}

/**
 * Dane sekcji opinii. Awaria bazy nie może wywrócić strony produktu —
 * wtedy pokazujemy pustą sekcję (klient i tak doładuje listę z API).
 */
async function loadReviewData(productId: string, userId: string | null) {
  const emptyPage: ReviewPage = { reviews: [], total: 0, hasMore: false };
  const [summary, page, myReview, purchased] = await Promise.all([
    getReviewSummary(productId).catch((err): ReviewSummaryFull => {
      console.error("[product] review summary failed", err);
      return EMPTY_SUMMARY;
    }),
    listProductReviews(productId).catch((err): ReviewPage => {
      console.error("[product] review list failed", err);
      return emptyPage;
    }),
    userId
      ? getUserReview(userId, productId).catch((): MyReview | null => null)
      : Promise.resolve(null),
    userId
      ? hasPurchasedProduct(userId, productId).catch(() => false)
      : Promise.resolve(false),
  ]);
  return { summary, page, myReview, purchased };
}

/** Zdjęcie do podglądu w Google i social media (1200×630). */
function productOgImage(product: GetSlugProduct) {
  const image = product.images?.[0]
  if (!image?.asset) return undefined
  try {
    return [{ url: urlFor(image).width(1200).height(630).fit("crop").auto("format").url(), width: 1200, height: 630, alt: product.title ?? "" }]
  } catch {
    return undefined
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = (await getProductBySlug(slug)) as GetSlugProduct | null;
  if (!product) {
    const preview = await getProductPreviewForAdmin(slug);
    return preview
      ? { title: `Podgląd: ${preview.title ?? "szkic"}`, robots: { index: false, follow: false } }
      : { title: "Nie znaleziono produktu" };
  }

  const name = [product.brand, product.title].filter(Boolean).join(" ");
  return pageMetadata({
    title: product.metaTitle || name || String(product.title ?? ""),
    description: product.metaDescription || product.shortDescription || product.intro,
    // Kanoniczny adres BEZ ?variant= — warianty to ta sama strona produktu.
    path: `/product/${slug}`,
    images: productOgImage(product),
    // Produkt to nie artykuł — og:type „article” sugerował wpis blogowy.
    type: "website",
  });
}

const ProductPage = async ({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ variant?: string }>;
}) => {
  const { slug } = await params;
  const { variant } = await searchParams

  // Klient widzi tylko opublikowane produkty; admin — także szkic (podgląd z banerem).
  let product = (await getProductBySlug(slug)) as GetSlugProduct | null;
  let isDraftPreview = false;
  if (!product) {
    product = await getProductPreviewForAdmin(slug);
    isDraftPreview = Boolean(product);
  }

  if (!product) {
    return notFound();
  }

  // Link z searcha / „ostatnio oglądanych” potrafi przyjść bez ?variant= albo
  // ze śmieciową wartością. Zamiast przekierowania renderujemy pierwszy wariant:
  // adres /product/<slug> jest wtedy poprawną, kanoniczną stroną (200, bez
  // przeskoku), a wyszukiwarka nie indeksuje osobnych adresów per wariant.
  const variantKeys = product.variants?.map(v => v._key).filter((key): key is string => Boolean(key)) ?? [];
  const selectedVariant = variant && variantKeys.includes(variant) ? variant : variantKeys[0];
  if (!selectedVariant) return notFound();
  const maxW = 'md:max-w-[450px]'
  const galleryImages = imagesForVariant(product.images, selectedVariant)

  const { userId } = await auth();
  // Omnibus (cena odniesienia) jest potrzebny tylko w czasie promocji.
  const promotionActive = isPromotionActive(product.promotion);
  const [reviewData, omnibus, promoted, shopSettings] = await Promise.all([
    loadReviewData(product._id, userId),
    promotionActive ? loadOmnibus(product._id) : Promise.resolve(null),
    getPromotedProducts(12, product._id),
    getShopSettings(),
  ]);
  // Karuzela pod opiniami: produkty w promocji, a gdy żadnej nie ma — inne
  // produkty z tej samej podkategorii.
  const promotedNow = promoted.filter((item) => isPromotionActive(item.promotion)).slice(0, 12);
  const carousel = promotedNow.length
    ? { title: "Produkty w promocji", products: promotedNow }
    : product.type?._id
      ? { title: "Zobacz też", products: await getRelatedProducts(product.type._id, product._id, 12) }
      : null;
  // Do klienta tylko pola potrzebne do ceny — nie cały dokument.
  const pricedProduct = {
    _id: product._id,
    price: product.price ?? null,
    variants: product.variants?.map((v) => ({ _key: v._key, price: v.price ?? null })) ?? null,
    promotion: product.promotion ?? null,
  };

  // Dane strukturalne produktu: cena i dostępność (wynik z ceną w Google),
  // ocena gdy są opinie. Cena to ta sama wartość, którą płaci klient.
  const price = effectivePrice(product, selectedVariant);
  const inStock = isVariantAvailable(product, selectedVariant);
  const productUrl = absoluteUrl(`/product/${slug}`);
  // Dostawa w danych strukturalnych: 0 zł, gdy cena łapie się na darmową
  // dostawę, inaczej najtańsza aktywna metoda (ta sama co „Dostawa od” w koszyku).
  const shippingCents = price !== null
    ? (qualifiesForFreeShipping(shopSettings, Math.round(price * 100)) ? 0 : shopSettings.minShippingCents)
    : null;
  const promotionEndsAt = promotionActive && product.promotion?.endsAt
    ? new Date(product.promotion.endsAt).toISOString().slice(0, 10)
    : null;
  // GPSR: dane producenta i ostrzeżenia (pole `safety`; typy Sanity
  // wygenerują się po `npm run typegen`).
  const safety = (product as { safety?: ProductSafety | null }).safety ?? null;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    url: productUrl,
    ...(product.shortDescription || product.intro || product.metaDescription
      ? { description: (product.shortDescription || product.intro || product.metaDescription) as string }
      : {}),
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
    ...(safety?.manufacturerName ? { manufacturer: { "@type": "Organization", name: safety.manufacturerName } } : {}),
    ...(product.sku ? { sku: product.sku } : {}),
    ...(product.barcode ? { gtin: product.barcode } : {}),
    ...(productOgImage(product) ? { image: productOgImage(product)!.map((img) => img.url) } : {}),
    ...(price !== null
      ? {
          offers: {
            "@type": "Offer",
            url: productUrl,
            price: price.toFixed(2),
            priceCurrency: product.currency || "PLN",
            availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            itemCondition: "https://schema.org/NewCondition",
            ...(promotionEndsAt ? { priceValidUntil: promotionEndsAt } : {}),
            // Koszt i obszar dostawy oraz polityka zwrotów — bez nich Google
            // zgłasza ostrzeżenia w „Informacjach o produktach” i nie pokazuje
            // tych danych w wynikach.
            ...(shippingCents !== null
              ? {
                  shippingDetails: {
                    "@type": "OfferShippingDetails",
                    shippingRate: { "@type": "MonetaryAmount", value: (shippingCents / 100).toFixed(2), currency: "PLN" },
                    shippingDestination: { "@type": "DefinedRegion", addressCountry: "PL" },
                  },
                }
              : {}),
            hasMerchantReturnPolicy: {
              "@type": "MerchantReturnPolicy",
              applicableCountry: "PL",
              returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
              merchantReturnDays: RETURN_WINDOW_DAYS,
              returnMethod: "https://schema.org/ReturnByMail",
              returnFees: RETURN_SHIPPING_PAID_BY_CUSTOMER
                ? "https://schema.org/ReturnFeesCustomerResponsibility"
                : "https://schema.org/FreeReturn",
              merchantReturnLink: absoluteUrl("/help/zwroty-i-reklamacje"),
            },
          },
        }
      : {}),
    ...(reviewData.summary.count
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: reviewData.summary.average,
            reviewCount: reviewData.summary.count,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  };

  // Okruszki: Strona główna → subkategoria → produkt.
  const breadcrumb = breadcrumbJsonLd([
    { name: "Strona główna", path: "/" },
    ...(product.category?.slug?.current
      ? [{ name: product.category.title ?? "Kategoria", path: `/category/${product.category.slug.current}` }]
      : []),
    ...(product.type?.slug?.current
      ? [{ name: product.type.title ?? "Kategoria", path: `/subcategory/${product.type.slug.current}` }]
      : []),
    { name: String(product.title ?? ""), path: `/product/${slug}` },
  ]);

  return (
    <div id="product_container" className="relative md:z-10 z-1">
      {/* JSON.stringify nie escapuje "<" — robi to jsonLdScript, żeby treść z CMS-a
          nie mogła zamknąć tagu <script>. */}
      <script {...jsonLdScript(jsonLd)} />
      <script {...jsonLdScript(breadcrumb)} />
      {isDraftPreview && (
        <div className="mx-auto mt-4 flex max-w-[1100px] flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-[20px] border border-[#f0c36d] bg-[#fff8e6] px-5 py-3 font-poppins text-[14px] text-black max-md:mx-5">
          <strong>Podgląd szkicu</strong>
          <span className="text-[#6C6C6C]">Ten produkt nie jest opublikowany — klienci go nie widzą. Widzisz go, bo jesteś zalogowany jako admin.</span>
          <a href="/admin/products?status=draft" className="font-medium underline underline-offset-2">Opublikuj w panelu</a>
        </div>
      )}
      <div className="gap-10 md:py-10 max-md:pb-10 md:mt-2 sm:mt-8 mt-6">
        <div className="flex flex-col md:justify-center md:flex-row md:px-10 2lg:space-x-16 md:space-x-8 relative">
          <div className="md:sticky md:top-4 h-full flex flex-col z-2">
            <div className="max-md:px-6 max-sm:px-5">
              <nav aria-label="Ścieżka" className="sm:text-[14px] text-[13px] text-[#6C6C6C] md:mb-6 mb-2 font-poppins">
                {product?.category?.slug?.current && (
                  <>
                    <Link href={`/category/${product.category.slug.current}`} className="hover:text-black">{product.category.title}</Link>
                    {"  /  "}
                  </>
                )}
                {product?.type?.slug?.current ? (
                  <Link href={`/subcategory/${product.type.slug.current}`} className="hover:text-black">{product.type.title}</Link>
                ) : (
                  product?.type?.title
                )}
                {"  /  "}<span className="text-black">{product?.title}</span>
              </nav>
            </div>
            {/* Galeria wybranego wariantu (jego zdjęcia + wspólne). `key` resetuje
                aktywne zdjęcie przy zmianie wariantu — pierwsze = zdjęcie wariantu. */}
            {galleryImages.length > 0 && <ImageView key={selectedVariant} images={galleryImages} productTitle={product.title} />}
          </div>
          <div className="w-auto flex flex-col font-poppins max-md:px-10 max-sm:px-7 max-md:mt-5 relative z-1">
            <div className="2lg:mb-2">
              {/* Jeden H1 na stronie = nazwa produktu (marka i podtytuł to zwykły tekst). */}
              {product?.brand && <p className="2lg:text-[clamp(16px,1.6vw,20px)] text-[15px]  text-black font-medium">{product.brand}</p>}
              <h1 className="2lg:text-[clamp(23px,2.5vw,26px)] text-[21px] text-black font-medium">{product?.title}</h1>
              {product?.subtitle && <p className="text-[clamp(16px,1.6vw,20px)] text-black mb-2">{product.subtitle}</p>}
              <ProductRatingBadge
                productId={product._id}
                initial={reviewData.summary}
                href={reviewData.summary.count ? "#opinie" : "#napisz-opinie"}
                variant="full"
                className="mb-3"
                pawClassName="w-5 h-5"
                textClassName="text-[#6C6C6C] sm:text-[14px] text-[13px] underline-offset-2 hover:underline"
              />
            </div>
            
            <ProductPagePrice product={pricedProduct} variantKey={selectedVariant} initial={omnibus} />
            <VariantManage product={product} className={`2lg:mt-6 mt-4 mb-3 ${maxW}`} selectedVariantKey={selectedVariant}/>


            <div className={`flex items-center gap-2.5 lg:gap-5 ${maxW}`}>
              <AddToCartButton
                product={product}
                variant={selectedVariant}
                className="bg-fancy-black"
              />
              
              <label className="bg-[#EDEDED] text-black rounded-full w-[50px] h-[50px] flex justify-center items-center hover:bg-white cursor-pointer ease-in-out duration-100">
                <WishlistButton productId={product._id} product={product} className=''/>
              </label>
            </div>
            <div className="flex mt-8 space-x-8">
              <div className="flex text-[#6C6C6C] 2lg:text-[14px] text-[13px] space-x-3 items-center">
                <Truck width={20} height={20}/>
                <p>Ekspresowa <br/> wysyłka 24h</p>
              </div>
              <div className="flex text-[#6C6C6C] 2lg:text-[14px] text-[13px] space-x-3 items-center">
                <RotateCcw width={20} height={20}/>
                <p>{RETURN_WINDOW_DAYS} dni <br/> na zwrot</p>
              </div>
              <div className="flex text-[#6C6C6C] 2lg:text-[14px] text-[13px] space-x-3 items-center">
                <Lock width={20} height={20}/>
                <p>Bezpieczne <br/> płatności</p>
              </div>
            </div>
            <ProductDetailsList product={product} className={maxW}/>

            {/* <p className={`text-[clamp(16px,1.6vw,18px)] mt-12 text-black  ${maxW}`}>
              {product?.intro}
            </p> */}
          </div>
        </div>
        {/* Pełny opis produktu — pod galerią, przed opiniami. Długi tekst
            jest ważny dla SEO, a krótki opis zostaje obok ceny. */}
        {Array.isArray(product.description) && product.description.length > 0 && (
          <section id="opis" aria-labelledby="opis-heading" className="w-full max-w-[1430px] mx-auto xl:px-26 2lg:px-20 md:px-16 sm:px-8 px-6 scroll-mt-24 w-full flex justify-center mt-12">
            <div className="w-full border-t border-[#D9D9D9] pt-8 font-poppins">
              <h2 id="opis-heading" className="text-black font-medium text-[clamp(18px,1.8vw,24px)] mb-2">Opis produktu</h2>
              <div className="max-w-[820px]">
                <PortableTextContent value={product.description as unknown[]} />
              </div>
            </div>
          </section>
        )}
        <ProductSafetyInfo safety={safety} />
        <ProductReviews
          // Zmiana sesji (logowanie z modala odświeża stronę) montuje sekcję od nowa
          // z opinią nowego konta zamiast trzymać stan poprzedniego.
          key={userId ?? "guest"}
          productId={product._id}
          productTitle={product.title ?? ""}
          initialSummary={reviewData.summary}
          initialPage={reviewData.page}
          initialMyReview={reviewData.myReview}
          purchased={reviewData.purchased}
          signedIn={Boolean(userId)}
        />
        {carousel && carousel.products.length > 0 && (
          <ProductCarusel2 title={carousel.title} products={carousel.products} />
        )}
      </div>
    </div>
  );
};

export default ProductPage;