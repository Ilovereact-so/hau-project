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
        <ProductCarusel2
          title={"Pielęgnuj swojego psiaka"}
        />
        <SubCategoryContainer/>
        <ProductCarusel2
          className='xl:mt-20'
          title={"Idealne na wyjścia z pupilem"}
        />
        <AboutAs/>
    </div>
  )
}

export default ContentContainer