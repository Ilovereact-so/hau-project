
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

const ProductPage = async ({
  params,
}: {
  params: Promise<{ slug: string }>;
}) => {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    return notFound();
  }
  return (
    <div>
      <Container className="gap-10 py-10">
        <div className="flex flex-col md:flex-row md:px-10 px-5 space-x-10">
          {product?.images && <ImageView images={product?.images} />}
          <div className="w-full md:w-[40%] flex flex-col gap-5 font-poppins">
            <div>
              <p className="text-[clamp(26px,2.5vw,40px)] text-black">{product?.title}</p>
              <p className="text-[clamp(18px,1.6vw,28px)] text-black mb-2">{product?.subtitle}</p>
            </div>
            <PriceView
                price={product?.comparePrice ? product?.price: product?.comparePrice}
                discount={product?.comparePrice ? product?.price : undefined}
                className=""
              />s
            {/**product?.stock && (
              <p className="bg-green-100 w-24 text-center text-green-600 text-sm py-2.5 font-semibold rounded-lg">
                In Stock
              </p>
            )*/}

            <p className="text-sm text-gray-600 tracking-wide">
              {product?.intro}
            </p>
            <div className="flex items-center gap-2.5 lg:gap-5">
              <AddToCartButton
                product={product}
                className=""
              />
              <button className="border-2 border-black text-black rounded-[20px] p-3 hover:text-darkColor hover:border-darkColor hoverEffect">
                <Heart className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
        <div className="w-full flex flex-col lg:px-25 pd:mx-18 px-10 mt-10">
            <div className="font-poppins text-black text-[clamp(16px,1.4vw,20px)]">
              {product?.description && <PortableText value={product.description} />}
            </div>
        </div>
         <ProductCarusel
          title={"Produkty objęte promocją"}
          subtitle={"Idealne na wyjścia z pupilem"}
        />
      </Container>
    </div>
  );
};

export default ProductPage;