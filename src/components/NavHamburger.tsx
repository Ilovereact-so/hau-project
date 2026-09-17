import React from 'react'

const NavHamburger = ({onClick, className, isOpen, mode: _mode}: {onClick: () => void, className: string, isOpen:boolean, mode: number}) => {
  
  const bar = `absolute left-1/2 top-[13px] h-[2px] w-6 -translate-x-1/2 rounded-full transition-all duration-200 ease-in-out bg-[#d9d9d9]`

  return (
    <button
      type="button"
      aria-label={isOpen ? 'Zamknij menu' : 'Otwórz menu'}
      aria-expanded={isOpen}
      onClick={onClick}
      className={`relative h-7 w-7 shrink-0 cursor-pointer ${className}`}
    >
      <span className={`${bar} ${isOpen ? 'translate-y-[0px] rotate-45' : '-translate-y-[7px] rotate-0'}`} />
      <span className={`${bar} ${isOpen ? 'scale-x-0 opacity-0' : 'scale-x-100 opacity-100'}`} />
      <span className={`${bar} ${isOpen ? 'translate-y-[0px] -rotate-45' : 'translate-y-[7px] rotate-0'}`} />
    </button>
  )
}

export default NavHamburger
