import ValueBar from './ValueBar'
import SubCategoryContainer from './SubcategoryContainer'
import AboutAs from './AboutAs'
import ProductCarusel2 from './ProductCarusel2'
import GuidesCarousel from './guides/GuidesCarousel'
import type { ResolvedSection } from '@/lib/homeLayout.server'

/*
 * Treść strony głównej pod banerem — sekcje w kolejności ustawionej w panelu
 * (Marketing → Strona główna). Karuzele dostają produkty policzone na
 * serwerze; stałe moduły renderują się jak dotąd.
 */
export default function HomeSections({ sections }: { sections: ResolvedSection[] }) {
  return (
    <div className='w-full h-full'>
      {sections.map((entry) => {
        const { section } = entry
        switch (section.kind) {
          case 'products':
            return (
              <ProductCarusel2
                key={section.key}
                title={section.title}
                subtitle={section.subtitle || undefined}
                products={entry.products}
                moreHref={entry.moreHref}
              />
            )
          case 'valueBar':
            return <ValueBar key={section.key} />
          case 'subcategories':
            return <SubCategoryContainer key={section.key} />
          case 'guides':
            return <GuidesCarousel key={section.key} />
          case 'about':
            return <AboutAs key={section.key} />
          default:
            return null
        }
      })}
    </div>
  )
}
