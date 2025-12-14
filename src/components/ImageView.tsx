"use client";
import { urlFor } from "@/sanity/lib/image";
import Image from "next/image";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { internalGroqTypeReferenceTo, SanityImageCrop, SanityImageHotspot } from "../../sanity.types";
import { ChevronRight } from "lucide-react";
import { isAbsolute } from "path";

interface Props {
  images?: Array<{
    asset?: {
      _ref: string;
      _type: "reference";
      _weak?: boolean;
      [internalGroqTypeReferenceTo]?: "sanity.imageAsset";
    };
    hotspot?: SanityImageHotspot;
    crop?: SanityImageCrop;
    _type: "image";
    _key: string;
  }>;
}

const ImageView = ({ images = [] }: Props) => {
  const [active, setActive] = useState(images[0]);
  const [isNumActive, setNumActive] = useState<number>(0)

  useEffect(()=>{
    console.log(isNumActive, images.length)
  }, [isNumActive])
  return (
    <div className="md:w-auto w-full max-1xl:justify-end max-md:items-center relative flex 1xl:flex-row flex-col-reverse 1xl:space-x-4">
      <div className="md:flex hidden 1xl:flex-col flex-row max-1xl:space-x-3 1xl:space-y-3 w-auto h-fit sticky top-10 max-1xl:mt-4">
        {images.map((image, _) => (
          <button
            key={image._key}
            onClick={() => {setActive(image); setNumActive(_)}}
            className={`overflow-hidden hover:cursor-pointer ${
              active._key === image._key ? "border-[1px] border-black" : ""
            }`}
          >
            <Image
              src={urlFor(image).url()}
              alt={`Thumbnail ${image._key}`}
              width={100}
              height={100}
              className="min-w-[118px] min-h-[118px] object-cover brightness-90"
            />
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={images[isNumActive]?._key}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="w-auto h-fit group overflow-hidden sticky top-10" 
        >
          <Image
            src={urlFor(images[isNumActive]).url()}
            alt="productImage"
            width={700}
            height={700}
            priority
            className="md:w-auto w-full h-auto md:h-[clamp(450px,39vw,600px)] object-contain group-hover:scale-110 brightness-90"
          />
        </motion.div>
      </AnimatePresence>
      <div onClick={()=> setNumActive(images.length -1 == isNumActive ? 0 : isNumActive + 1)} className="bg-white w-[40px] h-[40px] rounded-[14px] border-1 absolute translate-y-[-50%] top-[50%] right-8 border-black flex justify-center items-center cursor-pointer">
        <ChevronRight className="text-black"/>
      </div>
    </div>
  );
};

export default ImageView;