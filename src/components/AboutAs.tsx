import Image from 'next/image'
import React from 'react'
import Container from './Container'
import SocialLinksRow from './SocialLinks'
import { DEFAULT_ABOUT, aboutParagraphs, type HomeAbout } from '@/lib/homeLayout'
import type { SocialLinks } from '@/lib/shopSettings'
import { urlFor } from '@/sanity/lib/image'

/*
 * Sekcja „O nas” na stronie głównej. Treść (tekst, piesek, zdjęcie) ustawia
 * panel: Marketing → Strona główna → „O nas” (dokument `homeLayout.about`),
 * linki social — ta sama zakładka, karta „Media społecznościowe”.
 * Bez danych z panelu pokazuje dotychczasowy tekst (DEFAULT_ABOUT).
 */

function dogImageUrl(about: HomeAbout): string | null {
  if (!about.dogImage) return null
  try {
    return urlFor({ asset: { _ref: about.dogImage.assetId } }).width(720).height(720).fit('crop').auto('format').url()
  } catch {
    return about.dogImage.url
  }
}

const AboutAs = ({ about = DEFAULT_ABOUT, social }: { about?: HomeAbout; social?: SocialLinks | null }) => {
  const paragraphs = aboutParagraphs(about.text)
  const dogUrl = dogImageUrl(about)
  const showDog = Boolean(dogUrl)
  const showSocial = about.showSocial && social

  return (
    <section aria-labelledby='about-heading' className='w-full h-auto min-h-[500px] pt-10 bg-[#edece5] '>
        <h2 id='about-heading' className='sr-only'>O nas</h2>
        <div className='relative w-full flex justify-center pt-12'>
            <Image src="/about-as.png" alt="" className='w-[clamp(300px,20vw,450px)] relative z-[2]' width={450} height={315}/>
            {about.heading && (
              <p aria-hidden='true' className='absolute bottom-1/2 left-1/2 transform -translate-x-1/2 translate-y-1/2 text-fancy-black font-bold font-poppins text-[clamp(50px,8vw,180px)] w-full text-center z-[3]'>{about.heading}</p>
            )}
            <div className='absolute bg-main rounded-t-[100%] h-full w-full bottom-0 left-0 z-[1] footer_shadow'></div>
        </div>
        <div className='bg-main pb-10 w-full h-auto'>
            <Container>
                {paragraphs.length > 0 && (
                  <div className='border-1 border-black border-dashed font-poppins sm:mx-12 mx-7 p-10 max-sm:p-7 rounded-[80px] max-sm:rounded-[48px]'>
                      <div className='space-y-6'>
                          {paragraphs.map((parts, index) => (
                            <p key={index} className='text-black text-[clamp(14px,1.5vw,20px)]'>
                              {parts.map((part, partIndex) =>
                                part.highlight ? (
                                  <span key={partIndex} className='text-[#6eb0a6]'>{part.text}</span>
                                ) : (
                                  <React.Fragment key={partIndex}>{part.text}</React.Fragment>
                                ),
                              )}
                            </p>
                          ))}
                      </div>
                  </div>
                )}

                {showDog && (
                  <div className='font-poppins sm:mx-12 mx-7 mt-10 flex md:flex-row flex-col justify-center md:items-center gap-8 md:gap-12'>
                      <div className='relative shrink-0 self-center md:self-auto w-[clamp(220px,28vw,340px)] aspect-square overflow-hidden rounded-[48px] bg-[#e2f3f0] '>
                          <Image
                            src={dogUrl!}
                            alt={about.dogImage?.alt || (about.dogName ? `${about.dogName} — nasza psia kontrolerka jakości` : 'Nasz pies')}
                            fill
                            sizes='(max-width: 768px) 70vw, 340px'
                            className='object-cover'
                          />
                      </div>
                      <div className='flex flex-col gap-3 max-w-[640px]'>
                          {about.dogTitle && <h3 className='text-fancy-black text-[clamp(16px,1.9vw,24px)] font-medium leading-tight'>{about.dogTitle}</h3>}
                          {about.dogName && <p className='text-fancy-black font-bold text-[clamp(28px,3.4vw,48px)] leading-none'>{about.dogName}</p>}
                          {about.dogText && <p className='text-black text-[clamp(14px,1.5vw,20px)] whitespace-pre-line'>{about.dogText}</p>}
                      </div>
                  </div>
                )}

                {showSocial && (
                  <SocialLinksRow links={social} variant='light' className='sm:mx-12 mx-7 mt-10 justify-center flex-wrap' />
                )}
            </Container>
        </div>
    </section>
  )
}

export default AboutAs
