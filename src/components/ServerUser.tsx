'server-only'
import React from 'react'
import { currentUser } from '@clerk/nextjs/server'
import { ShoppingBasket, User } from 'lucide-react'
import Image from 'next/image'
import { SignInButton, SignOutButton } from '@clerk/nextjs'

const ServerUser = async({style = {}, mode}: {style?: React.CSSProperties, mode:number}) => {
    const user = await currentUser()
    console.log(user?.imageUrl)
    const avatarUrl = user?.imageUrl ?? "/default-avatar.png";
  return (
    <div style={style} className={mode === 1 ? "flex justify-center items-center":"flex justify-end items-start max-sm:pr-8" }>
      <div className={mode ===1 ? "flex justify-center items-center w-[100px] space-x-2" : "flex lg:mt-0 mt-6 justify-between items-center xl:space-x-4 space-x-3 xl:mt-3 rounded-full xl:p-3 p-2 bg-[#c3c3c36e] h-fit xl:min-w-[80px] min-w-[70px] w-fit"}>
          {!user ? <SignInButton><User className={`lg:w-[25px] w-[20px] lg:h-[25px] h-[20px] ${
            mode === 1 ? "text-black":"text-white"
          }`}/></SignInButton> : <SignOutButton><Image src={avatarUrl} alt='avatar' width={30} height={30} className='w-[30px] h-[30px] rounded-full'/></SignOutButton> }
          
          <ShoppingBasket className={`xl:w-[30px] w-[25px] xl:h-[30px] h-[25px] ${
            mode === 1 ? "text-black":"text-white"
          }`}/>
      </div>
    </div>
  )
}

export default ServerUser