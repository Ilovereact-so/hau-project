import React from 'react'
import ProductCarusel from './ProductCarusel'
import ValueBar from './ValueBar'
import SubCategoryContent from './SubCategoryContent'
import Newsletter from './Newsletter'

const ContentContainer = () => {
  return (
    <div className='w-full h-full'>
        <ProductCarusel
          title={"Produkty objęte promocją"}
          subtitle={"Znajdź psi przysmak"}
        />
        <ValueBar/>
        <ProductCarusel
          title={"Produkty objęte promocją"}
          subtitle={"Pielęgnuj swojego psiaka"}
        />
        <SubCategoryContent/>
        <Newsletter/>
        <ProductCarusel
          title={"Produkty objęte promocją"}
          subtitle={"Idealne na wyjścia z pupilem"}
        />
    </div>
  )
}

export default ContentContainer