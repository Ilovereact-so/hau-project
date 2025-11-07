import React from 'react'

const NavHamburger = ({onClick, className}: {onClick: () => void, className: string}) => {
  return (
    <label htmlFor="check" className={className}>
      <input type="checkbox" id="check" onClick={onClick}/> 
      <span className='2lg:bg-white bg-black'></span>
      <span className='2lg:bg-white bg-black'></span>
      <span className='2lg:bg-white bg-black'></span>
    </label>
  )
}

export default NavHamburger