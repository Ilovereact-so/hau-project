'server-only'
import React from 'react'
import { currentUser } from '@clerk/nextjs/server'
import { ShoppingBasket, User } from 'lucide-react'
import Image from 'next/image'
import { SignInButton, SignOutButton } from '@clerk/nextjs'

const ServerUser = async() => {
    const user = await currentUser()
    console.log(user?.imageUrl)
    const avatarUrl = user?.imageUrl ?? "/default-avatar.png";
  return (
    <div className='flex justify-between items-center lg:space-x-4 space-x-3 xl:mt-3 rounded-full 2lg:p-3 p-2 bg-[#c3c3c36e] h-fit lg:min-w-[80px] min-w-[70px]'>
        {!user ? <SignInButton><User className='text-white lg:w-[30px] w-[25px] lg:h-[30px] h-[25px]'/></SignInButton> : <SignOutButton><Image src={avatarUrl} alt='avatar' width={30} height={30} className='w-[30px] h-[30px] rounded-full'/></SignOutButton> }
        <ShoppingBasket className='text-white lg:w-[30px] w-[25px] lg:h-[30px] h-[25px]'/>
    </div>
  )
}

export default ServerUser