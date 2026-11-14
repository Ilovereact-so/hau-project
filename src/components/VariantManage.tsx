'use client'
import React, { useEffect, useState } from 'react'
import { GetSlugProduct } from '../../sanity.types';
import { useRouter, useSearchParams } from "next/navigation"
import SizeSelect from './SizeSelect';
import { twMerge } from 'tailwind-merge';
import OptionWidthImageFromVariant from './OptionWidthImageFromVariant';
import { optionChoices, optionsOf, pickVariant } from '@/lib/variantSelection';


type Props ={
    product: GetSlugProduct,
    selectedVariantKey: string | string[] | undefined,
    className : string
}


const VariantManage = ({ product, selectedVariantKey, className }: Props) => {

  const productAtVariant = product?.variants?.find(v => v._key === selectedVariantKey);

  const [isVariant, setVariant] = useState(productAtVariant)
  // Wstecz/dalej w przeglądarce zmienia ?variant= — wybór idzie za adresem.
  useEffect(() => {
    setVariant(productAtVariant)
  }, [productAtVariant])
  const router = useRouter()
  const searchParams = useSearchParams()

  const setValue = (value: string, key: string) => {
    const params = new URLSearchParams(searchParams.toString())
    // Kombinacja, której nie ma (np. kolor tylko w innym rozmiarze), wybiera
    // najbliższy wariant z klikniętą wartością — `pickVariant`.
    const nextVariant = pickVariant(product?.variants, optionsOf(isVariant ?? productAtVariant), key, value)
    if (!nextVariant) return
    params.set("variant", nextVariant)
    setVariant(product?.variants?.find(v => v._key === nextVariant))
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
  // Wartości do wyboru = te, dla których istnieje wariant (nie wszystkie
  // parametry produktu — parametr może mieć wartość bez wariantu do kupienia).
  const productValues = optionChoices(product?.variants, product?.filterValues, option?.name?.key).map((choice) => ({
    _id: choice._id,
    value: choice.value,
    slug: { _type: 'slug' as const, current: choice.slug.current },
    filter: option?.name?._id ? { _ref: option.name._id, _type: 'reference' as const } : null,
  }))
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

  // Próbki ze zdjęciami tylko dla filtrów oznaczonych tak w Sanity (kolor).
  // Każdy inny filtr — także nowy, bez ustawionego UX_type — dostaje listę
  // wartości; wcześniej opcja bez UX_type po prostu się nie pokazywała
  // i klient nie mógł wybrać wariantu.
  return option?.name?.UX_type === "with-image-from-variant" ? (
    <OptionWidthImageFromVariant option={option} images={images} variants={product.variants} current={current} setValue={handleChange} filterValues={productValues} />
  ) : (
    <SizeSelect filterValues={productValues} option={option} setValue={handleChange} />
  )
}

/** Ile różnych wartości danej opcji (np. `color`) mają warianty produktu. */
function distinctOptionValues(product: GetSlugProduct, key: string | null | undefined): number {
  return optionChoices(product?.variants, null, key).length
}

export default VariantManage