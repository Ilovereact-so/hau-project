import React from 'react'
import { GetSlugProduct, Slug } from '../../sanity.types'
import Image from 'next/image';
import { urlFor } from '@/sanity/lib/image';
import { swatchImageFor } from '@/lib/variantImages';

// Współdzielony z SubcategoryFilterContainer.tsx — tam dane z Sanity
// (`value: string | null`, `slug: Slug | null`) są celowo normalizowane raz
// do `T | undefined` (patrz komentarz przy `comboAvailableFilters` w tamtym
// pliku), więc te dwa typy zostają w wersji "idiomatycznej" dla TS.
export type Filter = {
  _id: string;
  key?: string;
  label?: string;
  type?: string;
  UX_type?: string;
};

export type FilterValue = {
  _id: string;
  value?: string;
  slug?: Slug;
};

// Współdzielony z SizeSelect.tsx i VariantManage.tsx — pojedynczy element
// `variants[].optionValues[]` z pełnej projekcji produktu (GetSlugProduct).
// W przeciwieństwie do Filter/FilterValue powyżej, to jest typ danych
// wprost od Sanity (label/name/value jako `T | null`), używany tam gdzie
// dane nie przechodzą przez normalizację — dawniej był to osobny, ręcznie
// pisany typ z polami `T | undefined`, niezgodny z realnym kształtem z
// Sanity, co po przywróceniu GetSlugProduct ujawniło błędy typów.
export type VariantOption = NonNullable<
  NonNullable<GetSlugProduct["variants"]>[number]["optionValues"]
>[number];

type Props ={
    option: VariantOption;
    filterValues?: GetSlugProduct["filterValues"];
    setValue: (value: string) => void;
    images?: GetSlugProduct["images"];
    variants?: GetSlugProduct["variants"];
    /** opcje aktualnie wybranego wariantu — próbka woli zdjęcie wariantu z tym samym rozmiarem */
    current?: Record<string, string>;
}
const OptionWidthImageFromVariant = ({option, filterValues, images, variants, current, setValue}:Props) => {
  const optionKey = option?.name?.key ?? ''
  return (
    <div>
        <p className='2lg:text-[16px] text-[15px] text-black '>{option?.name?.label}: <span className='font-poppins'>{option?.value?.value}</span></p>
        <div className=' grid grid-cols-4 gap-2 justify-start w-fit my-2 '>
            {filterValues?.map((item, i) => {
              // Miniatura = zdjęcie wariantu w tej wartości (np. kolorze); bez
              // przypisanych zdjęć — pierwsze wspólne.
              const swatch = swatchImageFor(images, variants, optionKey, item.slug?.current ?? '', current)
              return (
                <div key={i} title={item.value ?? undefined} className={`${option?.value?.slug?.current === item.slug?.current && "border-1 border-fancy-black"} w-fit h-fit flex`}>
                    <button onClick={()=> item.slug?.current && setValue(item.slug.current)} className='w-fit h-fit cursor-pointer'>
                            <Image
                            src={swatch?.asset ? urlFor(swatch).width(120).height(120).fit("crop").url() : "/default-avatar.png"}
                            alt={item.value ?? ""}
                            width={59}
                            height={59}
                            className="min-w-[59px] min-h-[59px] object-cover brightness-90"
                            />
                    </button>
                </div>
              )
            })}
        </div>
    </div>
  )
}

export default OptionWidthImageFromVariant