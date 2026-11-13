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

  // Opcja, która we wszystkich wariantach ma tę samą wartość (np. jeden
  // rozmiar), nie jest wyborem — nie pokazujemy jej na karcie. Wartość zostaje
  // w wariancie (koszyk, zamówienie), a do filtrowania służą parametry
  // produktu (`filterValues`, patrz lib/listingFilters.ts). Bez żadnej opcji
  // do wyboru znika cały blok (razem z odstępami).
  const choices = isVariant?.optionValues?.filter((option) => distinctOptionValues(product, option?.name?.key) > 1) ?? []
  if (!choices.length) return null

  return (
    <div className={twMerge('w-full h-auto flex flex-col', className)}>
        {
          choices.map((option, i) => (
            <OptionByVariant option={option} key={option?._key ?? i} product={product} setValue={setValue} />
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
  const images = product.images;
  // Opcje wybranego wariantu (np. rozmiar) — próbki koloru pokazują zdjęcie
  // wariantu w tym samym rozmiarze, jeśli ma własne.
  const current = Object.fromEntries(
    product?.variants
      ?.find(v => v.optionValues?.some(ov => ov?._key === option?._key))
      ?.optionValues?.map(ov => [ov?.name?.key ?? '', ov?.value?.slug?.current ?? '']) ?? []
  )

  const handleChange = (value: string) => {
    if(value === option?.value?.slug?.current) return;
    setValue(value, option?.name?.key || "");
  }

  return(
      option?.name?.UX_type === "with-image-from-variant" ? (
        <OptionWidthImageFromVariant option={option} images={images} variants={product.variants} current={current} setValue={handleChange} filterValues={productValues} />
      ) : (
        option?.name?.UX_type === "only-value-list" && (
        <SizeSelect filterValues={productValues} option={option} setValue={handleChange} />
      )
      )
  )
}

/** Ile różnych wartości danej opcji (np. `color`) mają warianty produktu. */
function distinctOptionValues(product: GetSlugProduct, key: string | null | undefined): number {
  if (!key) return 0
  const values = new Set<string>()
  for (const variant of product?.variants ?? []) {
    for (const ov of variant?.optionValues ?? []) {
      const slug = ov?.value?.slug?.current
      if (ov?.name?.key === key && slug) values.add(slug)
    }
  }
  return values.size
}

export default VariantManage