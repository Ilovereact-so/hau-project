'use client'
import React, { useState } from 'react'
import AutoResizeInput from './AutoResizeInput'

const ResearchNav = ({isMobile, minWidth, mode, maxWidth}:{isMobile:boolean, minWidth:number, mode:number, maxWidth?:number}) => {
    const [value, setValue] = useState<string>("")
  return (
        <AutoResizeInput value={value} onChange={(e) => setValue(e.target.value)} minWidth={isMobile ? minWidth * 0.8 : minWidth} maxWidth={maxWidth || 500} placeholder='Obroża taktyczna..' className={`focus:outline-none font-poppins text-[clamp(14px,1.2vw,16px)] placeholder:text-[clamp(14px,1.2vw,16px)] text-black placeholder:text-[#4E4E4E] ${
            mode === 0 ? "placeholder:text-center placeholder:mr-[30px]": "text-left"
        }`}/>
  )
}

export default ResearchNav