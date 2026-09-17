'use client'
import React from 'react'
import AutoResizeInput from './AutoResizeInput'

const ResearchNav = ({isMobile, minWidth, mode, maxWidth, focusChanges, blurChanges, value, setValue}:{isMobile:boolean, minWidth:number, mode:number, maxWidth?:number, focusChanges?: VoidFunction, blurChanges?: VoidFunction, value?: string, setValue: (value: string) => void}) => {
    
  return (
        <AutoResizeInput 
          value={value} 
          onChange={(e) => setValue(e.target.value)} 
          onFocus={focusChanges} 
          onBlur={blurChanges} 
          minWidth={isMobile ? minWidth * 0.8 : minWidth} maxWidth={maxWidth || 500} 
          aria-label="Search products"
          role="searchbox"
          type="search"
          id='search-input'
          placeholder='Obroża taktyczna..' 
          className={`focus:outline-none font-poppins text-[clamp(14px,1.2vw,16px)] placeholder:text-[clamp(14px,1.2vw,16px)]  ${
            mode === 0 ? "placeholder:text-center xl:placeholder:mr-[30px] placeholder:text-[#4E4E4E] text-black": "text-left placeholder:text-[#bdbdbd] text-white"
        }`}/>
  )
}

export default ResearchNav