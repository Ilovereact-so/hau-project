import React from 'react'
import ValueBar from './ValueBar'
import SubCategoryContainer from './SubcategoryContainer'
import AboutAs from './AboutAs'
import ProductCarusel2 from './ProductCarusel2'
import GuidesCarousel from './guides/GuidesCarousel'

const ContentContainer = () => {
  return (
    <div className='w-full h-full'>
        <ProductCarusel2
          title={"Znajdź psi przysmak"}
        />
        <ValueBar/>
        <ProductCarusel2
          title={"Pielęgnuj swojego psiaka"}
        />
        <SubCategoryContainer/>
        <ProductCarusel2
          className='xl:mt-20'
          title={"Idealne na wyjścia z pupilem"}
        />
        {/* Poradniki tuż nad sekcją "O nas" — najpierw pokazujemy, że wiemy, o czym
            mówimy (konkretne materiały), a dopiero potem opowiadamy o sobie. */}
        <GuidesCarousel/>
        <AboutAs/>
    </div>
  )
}

export default ContentContainer
