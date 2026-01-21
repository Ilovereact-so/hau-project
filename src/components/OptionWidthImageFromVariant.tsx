import React from 'react'
import { GetSlugProduct, Slug } from '../../sanity.types'
import Image from 'next/image';
import { urlFor } from '@/sanity/lib/image';

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

export type VariantOption = {
  _key: string;
  label?: string;
  name?: Filter;        // 👈 POJEDYNCZY
  value?: FilterValue; // 👈 POJEDYNCZY
};

type Props ={
    option: VariantOption;
    filterValues?: GetSlugProduct["filterValues"];
    setValue: (value: string) => void;
    images?: GetSlugProduct["images"];
}
const OptionWidthImageFromVariant = ({option, filterValues,images, setValue}:Props) => {
  return (
    <div>
        <p className='text-[clamp(16px,1.6vw,16px)] text-black'>{option?.name?.label}: <span className='font-medium font-poppins'>{option?.value?.value}</span></p>
        <div className=' grid grid-cols-4 gap-2 justify-start w-fit my-2 space-y-6'>
            {filterValues?.map((item, i) => (
                <div key={i} title={item.value} className={`${option?.value?.slug?.current === item.slug?.current && "border-1 border-[#838383]"} w-fit h-fit flex`}>
                    <button onClick={()=> item.slug?.current && setValue(item.slug.current)} className='w-fit h-fit cursor-pointer'>
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
    </div>
  )
}

export default OptionWidthImageFromVariant