'server-only'
import React from 'react'
import { currentUser } from '@clerk/nextjs/server'
import { ShoppingBasket, User } from 'lucide-react'
import Image from 'next/image'
import { SignInButton } from '@clerk/nextjs'

const ServerUser = async() => {
    const user = await currentUser()
    console.log(user?.imageUrl)
    const avatarUrl = user?.imageUrl ?? "/default-avatar.png";
  return (
    <div className='flex space-x-4 xl:mt-3 rounded-full p-3 bg-[#c3c3c36e] h-fit'>
        {!user ? <SignInButton><User className='text-white w-[30px] h-[30px]'/></SignInButton> : <Image src={avatarUrl} alt='avatar' width={30} height={30} className='w-[30px] h-[30px] rounded-full'/> }
        <ShoppingBasket className='text-white w-[30px] h-[30px]'/>
    </div>
  )
}

export default ServerUser