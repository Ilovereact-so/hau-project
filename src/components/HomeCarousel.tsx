'use client'
import Image from "next/image";
import Link from "next/link";
import { motion, PanInfo } from 'framer-motion'
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Container from "@/components/Container";
import { urlFor } from "@/sanity/lib/image";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { type CollectionSummary } from "@/sanity/helpers";

// Próg, po którym swipe liczy się jako zmiana slajdu — albo wystarczający dystans,
// albo szybki "flick" nawet na krótkim dystansie (typowe zachowanie karuzeli).
const SWIPE_OFFSET_THRESHOLD = 50;
const SWIPE_VELOCITY_THRESHOLD = 500;

type Props = {
    /**
     * Banery pobrane na SERWERZE (sanity.helpers/getBaners) i przekazane gotowe.
     * Wcześniej ten komponent był całą stroną 'use client' i sam pobierał dane
     * w useEffect — hero pojawiał się dopiero po hydratacji i round-tripie do
     * Sanity, więc user przez pierwsze sekundy po odświeżeniu widział pustkę.
     */
    collections: CollectionSummary[]
}

/**
 * Karuzela banerów strony głównej. Interaktywna logika (swipe, strzałki,
 * framer-motion) musi zostać w kliencie, ale DANE nie są tu pobierane —
 * przychodzą jako props z server componentu. Brak własnego fetcha = zero
 * opóźnienia między pierwszym malowaniem strony a widocznym banerem.
 */
const HomeCarousel = ({ collections }: Props) => {
    const [isIndex, setIndex] = useState<number>(0)
    const containerRef = useRef<HTMLDivElement>(null)
    const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
    const mobile = useMediaQuery('(max-width: 639px)');

  const goToSlide = (dir: 1 | -1) => {
    if (!collections.length) return;
    setIndex((prev) => (prev + dir + collections.length) % collections.length);
  };

  const handleSwipeEnd = (_: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
    const { offset, velocity } = info;
    if (offset.x < -SWIPE_OFFSET_THRESHOLD || velocity.x < -SWIPE_VELOCITY_THRESHOLD) {
      goToSlide(1);
    } else if (offset.x > SWIPE_OFFSET_THRESHOLD || velocity.x > SWIPE_VELOCITY_THRESHOLD) {
      goToSlide(-1);
    }
  };

  function cover(collection: CollectionSummary): string | null {
    const source = collection.image?.asset ? collection.image : collection.coverProductImage?.asset ? collection.coverProductImage : null;
    if (!source) return null;
    try {
      return urlFor(source as Parameters<typeof urlFor>[0]).url();
    } catch {
      return null;
    }
  }

  return (
    <motion.header
            ref={containerRef}
            onPanEnd={mobile ? handleSwipeEnd : undefined}
            style={mobile ? { touchAction: "pan-y" } : undefined}
            className='w-full min-h-[600px] 3xl:h-[80vh] h-[70vh] flex z-[9] relative'>
            {collections &&  collections.map((item,index)=>{
              const image = cover(item);
              return (
                <motion.div ref={(el) => { slideRefs.current[index] = el }} initial={{opacity:0}} animate={isIndex === index
                    ? { opacity: 1, zIndex: 2 }
                    : { opacity: 0, zIndex: 1 }}
                    transition={{ duration: 0.6, ease: "easeInOut" }}
                    key={index} className='w-full h-full overflow-hidden flex justify-center items-center top-0 left-0 z-[9] absolute '> {/**style={{backgroundImage:`url('${item.baner}')`}} */}
                    <div className="relative w-full h-full overflow-hidden z-1">
                      {/* FOREGROUND IMAGE */}
                      {/* `fill` = obraz absolutny na 100% x 100% kontenera. Wcześniej miał
                          width/height i tylko `w-full` — wysokość brał z rozciągania
                          elementu flex, czego Safari (iOS) nie robi dla <img>: liczył
                          wysokość z proporcji 1648×912 i zdjęcie nie wypełniało banera. */}
                      {image &&
                      <div className="absolute inset-0 z-[2] overflow-hidden">
                        <Image
                          src={image}
                          alt={item.image?.alt || item.title}
                          fill
                          sizes="100vw"
                          className="object-cover object-[65%] sm:object-top ease-in-out duration-300"
                          priority={index === 0}
                        />
                      </div>
                      }
                    </div>
                    {/* Gradient pod tekstem (telefon). pointer-events-none: wcześniej
                        leżał NAD przyciskiem i przejmował dotknięcia — „Sprawdź ofertę”
                        był na telefonach nieklikalny. */}
                    <div aria-hidden className="absolute sm:hidden block w-full h-full top-0 left-0 z-[2] pointer-events-none bg-gradient-to-t from-black/30 from-30% to-50% to-transparent"></div>
                    <Container className="absolute w-full h-full z-[3]">
                      <div className='absolute w-full flex flex-col z-[4] xl:pl-30 lg:pl-22 pl-[7%] lg:pr-10 pr-[7%] sm:bottom-[18%] bottom-[14%]'>
                          <h1 className='text-white sm:text-[clamp(40px,5vw,96px)] text-[25px] font-poppins sm:font-bold font-medium 1xl:leading-[110px] sm:leading-[90px] leading-[40px]'>{item.title}</h1>
                          <div className='text-white sm:text-[clamp(16px,1.5vw,22px)] font-poppins text-[13.7px] mb-5 max-w-[600px]'>
                            {item?.description && <p>{item.description} </p>}
                          </div>
                          {/* Przycisk prowadzi do kolekcji przypiętej do banera. Bez opublikowanej
                              kolekcji (albo bez jej adresu) go nie pokazujemy — martwy przycisk
                              to gorsze doświadczenie niż jego brak. Nieaktywne slajdy są
                              wyłączone z tabulacji, żeby fokus nie trafiał w niewidoczne linki. */}
                          {item?.slug && (
                            <Link
                              href={`/kolekcje/${encodeURIComponent(item.slug)}`}
                              tabIndex={isIndex === index ? 0 : -1}
                              aria-hidden={isIndex === index ? undefined : true}
                              className='bg-fancy-black rounded-[24px] cursor-pointer text-white hover:text-black md:text-[clamp(18px,1.6vw,22px)] font-poppins font-semibold sm:px-10 px-6 sm:py-3 py-2 inline-flex w-fit hover:bg-[#ededed] ease-in-out duration-400'
                            >
                              Sprawdź ofertę
                            </Link>
                          )}
                      </div>
                    </Container>
                </motion.div>
            )})}
            {collections &&
            <div className="w-auto h-auto absolute sm:right-20 right-0 max-sm:left-[50%] max-sm:translate-x-[-50%] sm:bottom-12 bottom-7 z-2">
              <div className='flex justify-center items-center space-x-2 z-10'>
                  <motion.div whileTap={{scale:0.8}} onTap={()=>goToSlide(-1)} className='cursor-pointer' ><ChevronLeft className='text-white xl:w-[24px] sm:w-[20px] w-[18px] xl:h-[24px] sm:h-[20px] h-[18px]'/></motion.div>
                  {Array.from({ length: collections?.length }, (e, i) =>(
                      <motion.div onClick={()=>setIndex(i)} initial={{backgroundColor:"#e5e5e5"}} animate={{backgroundColor: isIndex === i ? "#FEFEFE":"#e5e5e5" }} transition={{duration:0.2, ease:"easeInOut"}} key={i} className={`rounded-full xl:w-[17px] sm:w-[15px] w-[12px] xl:h-[17px] sm:h-[15px] h-[12px]`}></motion.div>
                  ))}
                  <motion.div whileTap={{scale:0.8}} onTap={()=>goToSlide(1)} className='cursor-pointer'><ChevronRight className='text-white xl:w-[24px] sm:w-[20px] w-[18px] xl:h-[24px] sm:h-[20px] h-[18px]'/> </motion.div>
              </div>
            </div>
            }
      </motion.header>
  )
}

export default HomeCarousel