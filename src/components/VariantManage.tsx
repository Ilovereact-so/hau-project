'use client'
import React, { useEffect, useState } from 'react'
import { Product } from '../../sanity.types';
import { urlFor } from '@/sanity/lib/image';
import Image from 'next/image';
import { internalGroqTypeReferenceTo, SanityImageCrop, SanityImageHotspot } from "../../sanity.types";
import { useRouter, useSearchParams } from "next/navigation"
import { Select } from '@base-ui/react/select';
import SizeSelect from './SizeSelect';
import { twMerge } from 'tailwind-merge';


type Props ={
    product: Product,
    selectedVariantKey: string | string[] | undefined,
    className : string
}

type PropsImage = {
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
const VariantManage = ({ product, selectedVariantKey, className }: Props) => {

  const productAtVariant = product?.variants?.find(v => v._key === selectedVariantKey);
  const optionColor = productAtVariant?.optionValues?.find(o => o.optionName=== "Color");
  const optionSize = productAtVariant?.optionValues?.find(o => o.optionName=== "Size");

  const productOptionsColor = product?.options?.find(o => o.name === "Color")?.values;
  const productOptionsSize = product?.options?.find(o => o.name === "Size")?.values;

  const images = product.images; //tesotwy image bo w variantach nie dodałem :()
  const [isColor, setColor] = useState(optionColor?.value)
  const [isSize, setSize] = useState(optionSize?.value)

  const router = useRouter()
  const searchParams = useSearchParams()
  useEffect(()=>{
    console.log("newColor", isSize, optionSize?.value)
    if (isColor === optionColor?.value && isSize === optionSize?.value) return
    const params = new URLSearchParams(searchParams.toString())

    const newVariant = product?.variants?.find(o => (o.optionValues?.find(v=> v.optionName == "Color" && v.value == isColor) && o.optionValues?.find(v=> v.optionName == "Size" && v.value == isSize)))?._key
    console.log("newVariant",newVariant)
    if(newVariant){
        params.set("variant", newVariant)
    }

    router.replace(`?${params.toString()}`, { scroll: false })
  }, [isColor, isSize])

  const items = [
  { value: null, label: 'Select theme' },
  { value: 'system', label: 'System default' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];
  return (
    <div className={twMerge('w-full h-auto flex flex-col', className)}>
        <p className='text-[clamp(16px,1.6vw,16px)] text-black'>Kolor: <span className='font-medium font-poppins'>{isColor}</span></p>
        <div className=' grid grid-cols-4 gap-2 justify-start w-fit my-2 space-y-6'>
            {productOptionsColor?.map((color, i) => (
                <div key={i} title={color.label} className={`${isColor === color.value && "border-1 border-black"} w-fit h-fit flex`}>
                    <button onClick={()=> setColor(color.value)} className='w-fit h-fit cursor-pointer'>
                            <Image
                            src={urlFor(images?.[0] || "").url()}
                            alt={`Thumbnail ${images?.[0]?._key}`}
                            width={59}
                            height={59}
                            className="min-w-[59px] min-h-[59px] object-cover brightness-90"
                            />
                    </button>
                </div>
            ))}
        </div>
        
       <SizeSelect productOptionsSize={productOptionsSize} value={isSize?.toUpperCase()} onChange={(e)=>setSize(e?.toLowerCase() || undefined)}></SizeSelect>
       {/**  <select name="rozmiary" className='border-1 border-black px-4 py-2 rounded-[20px] text-black'></select>
            <Select.Root>
                <Select.Value >
                {productOptionsSize?.map((size, i)=>(
                //</Select.Valu> value={size.value} className=''>{}<Select.Value/>
                
                    <span key={i} className='text-black'>{size.value?.toUpperCase()}</span>
                ))}
                </Select.Value>

            </Select.Root>

            <Select.Root items={items}>
                <Select.Value />
            </Select.Root>
            */}
        
    </div>
  )
}

export default VariantManage