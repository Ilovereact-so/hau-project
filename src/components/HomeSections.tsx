import ValueBar from './ValueBar'
import SubCategoryContainer from './SubcategoryContainer'
import AboutAs from './AboutAs'
import ProductCarusel2 from './ProductCarusel2'
import GuidesCarousel from './guides/GuidesCarousel'
import type { ResolvedSection } from '@/lib/homeLayout.server'
import type { SocialLinks } from '@/lib/shopSettings'

/*
 * Treść strony głównej pod banerem — sekcje w kolejności ustawionej w panelu
 * (Marketing → Strona główna). Karuzele dostają produkty policzone na
 * serwerze; stałe moduły renderują się jak dotąd.
 */
export default function HomeSections({ sections, social }: { sections: ResolvedSection[]; social?: SocialLinks | null }) {
  let firstProductSection = true

  return (
    <div className='w-full h-full'>
      {sections.map((entry) => {
        const { section } = entry
        switch (section.kind) {
          case 'products':
            {
              const isLatestOffers = firstProductSection
              firstProductSection = false
              return (
                <ProductCarusel2
                  key={section.key}
                  id={isLatestOffers ? 'latest-offers' : undefined}
                  title={section.title}
                  subtitle={section.subtitle || undefined}
                  products={entry.products}
                  moreHref={entry.moreHref}
                  // „Losowo”: przeglądarka tasuje kolejność przy każdej wizycie
                  // (przypięte produkty zostają na początku).
                  shuffle={section.order === 'random'}
                  pinnedCount={(entry.products ?? []).filter((p) => section.pinnedIds.includes(p._id)).length}
                />
              )
            }
          case 'valueBar':
            return <ValueBar key={section.key} />
          case 'subcategories':
            return <SubCategoryContainer key={section.key} />
          case 'guides':
            return <GuidesCarousel key={section.key} />
          case 'about':
            return <AboutAs key={section.key} about={'about' in entry ? entry.about : undefined} social={social} />
          default:
            return null
        }
      })}
    </div>
  )
}
