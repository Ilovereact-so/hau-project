"use client";
import { urlFor } from "@/sanity/lib/image";
import Image from "next/image";
import { useEffect, useState } from "react";
import { motion, AnimatePresence, animate } from "motion/react";
import { internalGroqTypeReferenceTo, SanityImageCrop, SanityImageHotspot } from "../../sanity.types";
import { ChevronRight, X } from "lucide-react";

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
    alt?: string | null;
  }>;
  /** Nazwa produktu — tekst alternatywny, gdy zdjęcie nie ma własnego `alt`. */
  productTitle?: string | null;
}

const ImageView = ({ images = [], productTitle }: Props) => {
  // Opisy zdjęć dla wyszukiwarki grafik i czytników ekranu (wcześniej
  // „productImage” / „Thumbnail <klucz>”).
  const altFor = (index: number) => {
    const own = images[index]?.alt?.trim()
    if (own) return own
    const name = productTitle?.trim() || 'Zdjęcie produktu'
    return images.length > 1 ? `${name} — zdjęcie ${index + 1}` : name
  }
  const [active, setActive] = useState(images[0]);
  const [isNumActive, setNumActive] = useState<number>(0)
  const [isOpen, setOpen] = useState(false)

  useEffect(() => {
    animate("body", { overflow: isOpen ? "hidden" : "auto" }, { duration: 0.5 });
    const elemet = document.getElementById("product_container") ;
    if(isOpen){
      elemet?.style.setProperty("z-index","10")
    }else{
      elemet?.style.setProperty("z-index","0")

    }
  }, [isOpen]);

  return (
    <div className="md:w-auto w-full relative max-sm:px-4">
      <motion.div onClick={()=> setOpen(false) } initial={isOpen ? { opacity: 1, display: "flex" }:{ opacity: 0, display: "none" }} animate={isOpen ? { opacity: 1, display: "flex" } : { opacity: 0, display: "none" }} className="fixed top-0 left-0 w-full h-full bg-background/90 justify-center items-center z-[20]">
        <div className="w-full md:h-[90vh] h-[95svh] grid lg:grid-cols-[118px_1fr_118px] max-lg:grid-rows-[1fr_100px] px-6 justify-items-center gap-2">
          <div className="flex lg:flex-col flex-row max-lg:row-start-2 lg:space-y-2 max-lg:space-x-2 overflow-auto carousel max-w-[100%]">
           <div className="w-auto h-auto flex lg:flex-col flex-row"> 
              {images.map((image, _) => (
              <button
                key={image._key}
                onClick={(e) => {setActive(image); setNumActive(_); e.stopPropagation()}}
                className={`overflow-hidden hover:cursor-pointer ${
                  active._key === image._key ? "border-[1px] border-[#838383]" : ""
                }`}
              >
                <Image
                  src={urlFor(image).url()}
                  alt={altFor(_)}
                  width={100}
                  height={100}
                  loading="lazy"
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="lg:min-w-[118px] min-w-[100px] lg:min-h-[118px] min-h-[110px] object-cover brightness-90 "
                />
                
              </button>
            ))}
          </div>
          </div>
          <div id="product-image-scroll" className="flex w-full justify-center items-center max-lg:row-start-1 overflow-auto">
            <Image 
              src={urlFor(images[isNumActive]).url()}  
              width={1200}
              height={1200}
              alt={altFor(isNumActive)}
              onClick={(e)=>e.stopPropagation()}
              className="lg:w-[70%] md:w-auto w-full lg:h-[90vh] h-[50vh] object-cover"/>
            </div>
        </div>
        <div className="absolute md:top-4 top-8 right-10 z-22 mix-blend-difference">
          <X className="cursor-pointer text-white  xl:w-[30px] w-[24px] xl:h-[30px] h-[24px]" onClick={() => setOpen(false)}></X>
        </div>
      </motion.div>
      <div className="md:w-auto w-full h-auto sticky top-4 flex max-1xl:justify-end max-md:items-center 1xl:flex-row flex-col-reverse 1xl:space-x-4 ">
        <div className="md:flex hidden 1xl:flex-col flex-row max-1xl:space-x-3 1xl:space-y-3 w-auto h-fit max-1xl:mt-4 ">
          {images.map((image, _) => (
            <button
              key={image._key}
              onClick={() => {setActive(image); setNumActive(_)}}
              className={`overflow-hidden hover:cursor-pointer  ${
                active._key === image._key ? "border-[1.4px] border-fancy-black" : ""
              }`}
            >
              <Image
                src={urlFor(image).url()}
                alt={altFor(_)}
                width={100}
                height={100}
                sizes="(max-width: 768px) 100vw, 50vw"
                className="min-w-[118px] min-h-[118px] object-cover brightness-90 "
              />
            </button>
          ))}
        </div>
        <div className="relative w-full">
          <AnimatePresence mode="wait">
            <div className="absolute z-10 bottom-2 translate-x-[-50%] left-[50%]">
            {
              Array.from({length: images.length}).map((_, i) => (
                <div key={i} className={`w-3 h-3 rounded-full ${isNumActive == i ? "bg-black" : "bg-[#c4c4c4]" } inline-block ease-in-out duration-300 mx-1`}></div>
              ))
            }
            </div>
            <motion.div
              onClick={()=>setOpen(true)}
              key={images[isNumActive]?._key}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:w-auto w-full h-fit group overflow-hidden absolute top-0 left-0 z-1 " 
            >
              <Image
                src={urlFor(images[isNumActive]).url()}
                alt={altFor(isNumActive)}
                width={700}
                height={700}
                priority
                className="md:w-auto w-full h-auto lg:h-[clamp(450px,39vw,600px)] object-contain cursor-pointer brightness-90 "
              />
            </motion.div>
          </AnimatePresence>
          <Image
              src={urlFor(images[0]).url()}
              alt=""
              aria-hidden="true"
              width={700}
              height={700}
              priority
              className="md:w-auto w-full h-auto lg:h-[clamp(450px,39vw,600px)] object-cover group-hover:scale-110 opacity-0"
          />
        </div>
        <div onClick={()=> setNumActive(images.length -1 == isNumActive ? 0 : isNumActive + 1)} className="bg-main md:w-[40px] w-[30px] md:h-[40px] h-[30px] rounded-full  absolute z-10 translate-y-[-50%] top-[50%] sm:ight-8 right-4  flex md:hidden md:pointer-events-none justify-center items-center cursor-pointer">
          <ChevronRight className="text-black md:w-[24px] w-[18px] md:h-[24px] h-[18px] ml-[2px]"/>
        </div>
        
      </div>
    </div>
  );
};

export default ImageView;