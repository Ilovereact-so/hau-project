'use client'
import React, { useState } from 'react'
import AutoResizeInput from './AutoResizeInput'

const ResearchNav = ({isMobile, minWidth, mode, maxWidth, focusChanges, blurChanges}:{isMobile:boolean, minWidth:number, mode:number, maxWidth?:number, focusChanges?: VoidFunction, blurChanges?: VoidFunction}) => {
    const [value, setValue] = useState<string>("")
  return (
        <AutoResizeInput value={value} onChange={(e) => setValue(e.target.value)} onFocus={focusChanges} onBlur={blurChanges} minWidth={isMobile ? minWidth * 0.8 : minWidth} maxWidth={maxWidth || 500} placeholder='Obroża taktyczna..' className={`focus:outline-none font-poppins text-[clamp(14px,1.2vw,16px)] placeholder:text-[clamp(14px,1.2vw,16px)] text-black  ${
            mode === 0 ? "placeholder:text-center placeholder:mr-[30px] placeholder:text-[#4E4E4E]": "text-left placeholder:text-[#bdbdbd]"
        }`}/>
  )
}

export default ResearchNav