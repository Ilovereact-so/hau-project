'server-only'
import React from 'react'
import { currentUser } from '@clerk/nextjs/server'
import { Heart, ShoppingBagIcon, ShoppingBasket, User } from 'lucide-react'
import Image from 'next/image'
import { SignInButton, SignOutButton } from '@clerk/nextjs'
import CartIcon from './CartIcon'
import UserIcon from './UserIcon'

const ServerUser = async({style = {}, mode}: {style?: React.CSSProperties, mode:number}) => {
    const user = await currentUser()
    //console.log(user?.imageUrl)
    const avatarUrl = user?.imageUrl ?? "/default-avatar.png";
  return (
    <div style={style} className={mode === 1 ? "flex justify-center items-center max-md:mr-6":"flex justify-end items-start max-sm:pr-8" }>
      <div className={mode ===1 ? "flex justify-center items-center w-max" : "flex lg:mt-0 mt-6 relative justify-between items-center rounded-full lg:px-3 px-2 py-1 bg-fancy-black h-fit lg:min-w-[80px] min-w-[70px] w-fit"}>
          <div className=' w-auto'>
              {!user ? <SignInButton><User className={`lg:min-w-[25px] min-w-[20px] lg:min-h-[25px] min-h-[20px] stroke-[1.4px] mx-1.5 my-2 ${
              mode === 1 ? "text-black":"text-white"
            }`}/></SignInButton> 
            : 
            <UserIcon avatarUrl={avatarUrl} mode={mode}/>
             }
          </div>
        
          <CartIcon mode={mode} />
          
      </div>
    </div>
  )
}

export default ServerUser