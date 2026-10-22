'use client'
import React, { useState } from 'react'
import { GetSlugProduct } from '../../sanity.types'
import { ChevronDown } from 'lucide-react'
import { motion } from 'framer-motion'
import { twMerge } from 'tailwind-merge'
import { productInfoSections } from '@/lib/productInfo'

type Props = {
    product : GetSlugProduct,
    className : string
}

/** Jedna zakładka akordeonu (nagłówek + rozwijana treść). */
function Accordion({
  id,
  title,
  open,
  onToggle,
  children,
}: {
  id: string
  title: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className='flex flex-col font-poppins'>
      <h2 className='m-0 font-normal'>
        <button
          type='button'
          id={`${id}-button`}
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          onClick={onToggle}
          className='flex justify-between items-center py-4 w-full text-left text-black 2lg:text-[clamp(16px,1.6vw,18px)] text-[15px] cursor-pointer'
        >
          <span>{title}</span>
          <span className={`transform transition-transform duration-300 ${open ? 'rotate-180' : ''}`} aria-hidden='true'>
            <ChevronDown width={20} height={20}/>
          </span>
        </button>
      </h2>
      <motion.div
        id={`${id}-panel`}
        role='region'
        aria-labelledby={`${id}-button`}
        initial={false}
        animate={open ? { height: 'auto' } : { height: 0 }}
        transition={{ duration: 0.25 }}
        className='overflow-hidden'
      >
        <div className='flex flex-col font-poppins text-black pt-1 pb-5'>{children}</div>
      </motion.div>
    </div>
  )
}

const hasNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

const ProductDetailsList = ({product, className}:Props) => {
  // Krótki opis jest otwarty od razu — to pierwsza rzecz, którą klient czyta
  // obok ceny. Pełny opis jest niżej, pod zdjęciami (sekcja #opis).
  const [open, setOpen] = useState<string | null>(product?.shortDescription ? 'opis' : null)
  const toggle = (id: string) => setOpen((current) => (current === id ? null : id))
  const hasLongDescription = Array.isArray(product?.description) && product.description.length > 0

  // Zakładki ustawiane osobno dla każdego produktu (panel: okno produktu →
  // „Informacje o produkcie”), np. „Skład”, „Dodatkowe informacje”.
  const sections = productInfoSections(product ?? {})

  // „Szczegóły produktu” — tylko wypełnione pola (wcześniej przy braku
  // wymiarów wychodziło „undefined x undefined”).
  const dims = product?.dimensions
  const dimValues = [dims?.width_cm, dims?.height_cm, dims?.depth_cm]
  const hasDims = dimValues.some(hasNumber)
  const unit = dims?.unit || 'cm'
  const hasWeight = hasNumber(product?.weight_g)
  const hasDetails = Boolean(product?.sku) || hasDims || hasWeight

  const separator = <hr className='bg-black h-[1px] mx-1'></hr>

  return (
    <div className={twMerge(' mt-10', className)}>
        <Accordion id='product-tab-opis' title='Opis' open={open === 'opis'} onToggle={() => toggle('opis')}>
            {product?.shortDescription && (
              <p className="text-[#3A3A3A] 2lg:text-[16px] text-[15px] leading-relaxed whitespace-pre-line">{product.shortDescription}</p>
            )}
            {!product?.shortDescription && hasLongDescription && (
              <a href="#opis" className="text-black 2lg:text-[15px] text-[14px] underline underline-offset-2 w-fit hover:opacity-70">
                Zobacz pełny opis produktu ↓
              </a>
            )}
            {!product?.shortDescription && !hasLongDescription && (
              <p className="text-[#6C6C6C] 2lg:text-[15px] text-[14px]">Opis pojawi się wkrótce.</p>
            )}
        </Accordion>

        {sections.map((section) => (
          <React.Fragment key={section.key}>
            {separator}
            <Accordion
              id={`product-tab-${section.key}`}
              title={section.title}
              open={open === section.key}
              onToggle={() => toggle(section.key)}
            >
              <p className='text-[#3A3A3A] 2lg:text-[16px] text-[15px] leading-relaxed whitespace-pre-line'>{section.body}</p>
            </Accordion>
          </React.Fragment>
        ))}

        {hasDetails && (
          <>
            {separator}
            <Accordion id='product-tab-szczegoly' title='Szczegóły produktu' open={open === 'szczegoly'} onToggle={() => toggle('szczegoly')}>
                {product?.sku && (
                  <p className='2lg:text-[16px] text-[15px]'>Numer produktu: <span className='text-[#6C6C6C]'>{product.sku}</span></p>
                )}
                {hasDims && (
                  <p className='2lg:text-[16px] text-[15px] mt-1'>
                    Wymiary (szer. × wys. × gł.):{' '}
                    <span className='text-[#6C6C6C]'>
                      {dimValues.map((value) => (hasNumber(value) ? String(value).replace('.', ',') : '–')).join(' × ')} {unit}
                    </span>
                  </p>
                )}
                {hasWeight && (
                  <p className='2lg:text-[16px] text-[15px] mt-1'>Waga: <span className='text-[#6C6C6C]'>{String(product.weight_g).replace('.', ',')} g</span></p>
                )}
            </Accordion>
          </>
        )}

        {product?.brand && (
          <>
            {separator}
            <div className='flex justify-between items-center py-4 w-full text-black 2lg:text-[clamp(16px,1.6vw,18px)] text-[15px]'>
                <p>Producent</p>
                <span className='text-[#6C6C6C] 2lg:text-[16px] text-[15px]'>{product.brand}</span>
            </div>
          </>
        )}
    </div>
  )
}

export default ProductDetailsList
