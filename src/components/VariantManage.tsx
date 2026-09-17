'use client'
import React, { useState } from 'react'
import { GetSlugProduct } from '../../sanity.types';
import { useRouter, useSearchParams } from "next/navigation"
import SizeSelect from './SizeSelect';
import { twMerge } from 'tailwind-merge';
import OptionWidthImageFromVariant from './OptionWidthImageFromVariant';


type Props ={
    product: GetSlugProduct,
    selectedVariantKey: string | string[] | undefined,
    className : string
}


const VariantManage = ({ product, selectedVariantKey, className }: Props) => {

  const productAtVariant = product?.variants?.find(v => v._key === selectedVariantKey);

  const [isVariant, setVariant] = useState(productAtVariant)
  const router = useRouter()
  const searchParams = useSearchParams()

  const setValue = (value: string, key: string) => {
    const params = new URLSearchParams(searchParams.toString())

    const oldVariant = product?.variants?.find(v => v._key === selectedVariantKey);
    const selectedOptions = Object.fromEntries(
      oldVariant?.optionValues?.map(opt => [
        opt.name?.key,                 // np. "color"
        opt.value?.slug?.current       // np. "mint"
      ]) ?? []
    );

    
    const nextSelectedOptions = {
      ...selectedOptions,
      [key]: value
    };
    const nextVariant = product?.variants?.find(variant =>
      variant.optionValues?.every(opt =>
        nextSelectedOptions[opt.name?.key ?? ''] === opt.value?.slug?.current
      )
    )?._key;
    if(nextVariant){
        params.set("variant", nextVariant)
        setVariant(product?.variants?.find(v => v._key === nextVariant))
    }

    router.replace(`?${params.toString()}`, { scroll: false })

  }

  return (
    <div className={twMerge('w-full h-auto flex flex-col', className)}>
        {
          isVariant?.optionValues?.map((option, i) => (
            <OptionByVariant option={option} key={i} product={product} setValue={setValue} />
          ))
        }
    </div>
  )
}

type VariantOption =
  NonNullable<
    NonNullable<GetSlugProduct["variants"]>[number]["optionValues"]
  >[number];

type optionProps={
  option: VariantOption;
  product: GetSlugProduct;
  setValue: (value: string, key: string) => void;
}
const OptionByVariant = ({option, product, setValue}:optionProps) => {
  const filterValues = product?.filterValues
  const productValues = filterValues?.filter(fv => option?.name?._id === fv?.filter?._ref)
  const images = product.images; //tesotwy image bo w variantach nie dodałem :()

  const handleChange = (value: string) => {
    if(value === option?.value?.slug?.current) return;
    setValue(value, option?.name?.key || "");
  }

  return(
      option?.name?.UX_type === "with-image-from-variant" ? (
        <OptionWidthImageFromVariant option={option} images={images} setValue={handleChange} filterValues={productValues} />
      ) : (
        option?.name?.UX_type === "only-value-list" && (
        <SizeSelect filterValues={productValues} option={option} setValue={handleChange} />
      )
      )
  )
}

export default VariantManage