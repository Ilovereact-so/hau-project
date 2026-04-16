import React from 'react'
import ProductCarusel from './ProductCarusel'
import ValueBar from './ValueBar'
import SubCategoryContainer from './SubcategoryContainer'
import Newsletter from './Newsletter'
import AboutAs from './AboutAs'
import ProductCarusel2 from './ProductCarusel2'

const ContentContainer = () => {
  return (
    <div className='w-full h-full'>
        <ProductCarusel2
          title={"Znajdź psi przysmak"}
        />
        <ValueBar/>
        <ProductCarusel
          title={"Produkty objęte promocją"}
          subtitle={"Pielęgnuj swojego psiaka"}
        />
        <SubCategoryContainer/>
        <ProductCarusel
          className='xl:mt-20'
          title={"Produkty objęte promocją"}
          subtitle={"Idealne na wyjścia z pupilem"}
        />
        <AboutAs/>
    </div>
  )
}

export default ContentContainer