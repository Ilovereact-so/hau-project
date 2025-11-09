import React from 'react'
import ProductGrid from './ProductGrid'
import ProductCarusel from './ProductCarusel'
import ValueBar from './ValueBar'
import SubCategoryContent from './SubCategoryContent'

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
    </div>
  )
}

export default ContentContainer