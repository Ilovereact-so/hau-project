import React, { useEffect, useRef } from 'react'

const NavHamburger = ({onClick, className, isOpen}: {onClick: () => void, className: string, isOpen:boolean}) => {
  const refMenu = useRef<HTMLInputElement>(null)
  
  useEffect(()=>{
    if(!isOpen && refMenu.current?.checked == true){
      refMenu.current.checked = false
    }
  },[isOpen, refMenu])
  return (
    <label id='Navlabel' htmlFor="check" className={className}>
      <input type="checkbox" id="check" ref={refMenu} onClick={onClick}/> 
      <span className={`${isOpen ? "bg-black":"bg-white"}`}></span>
      <span className={`${isOpen ? "bg-black":"bg-white"}`}></span>
      <span className={`${isOpen ? "bg-black":"bg-white"}`}></span>
    </label>
  )
}

export default NavHamburger