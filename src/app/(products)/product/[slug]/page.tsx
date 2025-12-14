import AddToCartButton from "@/components/AddToCardButton";
import Container from "@/components/Container";
import ImageView from "@/components/ImageView";
import PriceView from "@/components/PriceView";
import ProductCarusel from "@/components/ProductCarusel";
import { getProductBySlug } from "@/sanity/helpers";
import { Heart, MessageCircleQuestionMark, Share2, SquareDashedKanban, Truck } from "lucide-react";
import { notFound } from "next/navigation";
import React from "react";
import { PortableText } from "next-sanity";
import { ConnectorOutSerializer } from "svix/dist/models/connectorOut";
import VariantManage from "@/components/VariantManage";
import ProductDetailsList from "@/components/ProductDetailsList";

const ProductPage = async ({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ variant?: string }>;
}) => {
  const { slug} = await params;
  const { variant } = await searchParams
  const product = await getProductBySlug(slug);

  if (!product) {
    return notFound();
  }
  const productAtVariant = product?.variants?.find(v => v._key === variant);
  let maxW = 'md:max-w-[450px]'
  return (
    <div>
      <div className="gap-10 md:py-10 max-md:pb-10 md:mt-4">
        <div className="flex flex-col md:justify-center md:flex-row md:px-10 space-x-16">
          {product?.images && <ImageView images={product?.images} />}
          <div className="w-auto flex flex-col font-poppins max-md:px-10 max-md:mt-5">
            <div className="mb-2">
              <h1 className="text-[clamp(16px,1.6vw,20px)] text-black underline cursor-pointer">{product?.brand}</h1>
              <h1 className="text-[clamp(26px,2.5vw,40px)] text-black leading-[clamp(26px,2.5vw,40px)] font-medium">{product?.title}</h1>
              <h1 className="text-[clamp(18px,1.6vw,28px)] text-black mb-2">{product?.subtitle}</h1>
            </div>
            <PriceView
                price={productAtVariant?.price}
                compareAtPrice={product?.compareAtPrice}
                className={`${product?.compareAtPrice ? "text-[#DD1919]" : "text-black"}`}
              />
            <VariantManage product={product} className={`mt-6 mb-3 ${maxW}`} selectedVariantKey={variant}/>


            <div className={`flex items-center gap-2.5 lg:gap-5 ${maxW}`}>
              <AddToCartButton
                product={product}
                className=""
              />
              <button className="border-1 border-black text-black rounded-[20px] p-3 hover:text-darkColor hover:border-darkColor hoverEffect">
                <Heart className="w-5 h-5" />
              </button>
            </div>
            <p className={`text-[clamp(16px,1.6vw,18px)] mt-12 text-black  ${maxW}`}>
              {product?.intro}
            </p>
            <ProductDetailsList product={product} className={maxW}/>
          </div>
        </div>
        <div className="w-full flex flex-col lg:px-25 md:mx-18 px-10 mt-15 mb-25">
          <div className="font-poppins font-medium text-black text-[clamp(16px,1.4vw,24px)]">
              {product?.shortDescription}
            </div>
            <div className="font-poppins text-black text-[clamp(16px,1.4vw,20px)]">
              {product?.description && <PortableText value={product.description} />}
            </div>
        </div>
         <ProductCarusel
          title={"Produkty objęte promocją"}
          subtitle={"Idealne na wyjścia z pupilem"}
        />
      </div>
    </div>
  );
};

export default ProductPage;