'use client'
import React, { useState } from 'react'
import AutoResizeInput from './AutoResizeInput'

const ResearchNav = () => {
    const [value, setValue] = useState<string>("")
  return (
        <AutoResizeInput value={value} onChange={(e) => setValue(e.target.value)} minWidth={100} maxWidth={500} placeholder='Obroża taktyczna..' className='focus:outline-none font-poppins text-[clamp(14px,1.2vw,16px)] placeholder:text-[clamp(14px,1.2vw,16px)] text-black placeholder:text-[#4E4E4E]'/>
  )
}

export default ResearchNav