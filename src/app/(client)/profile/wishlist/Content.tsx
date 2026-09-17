import ProfileMenu from '@/components/ProfileMenu'
import { WishlistPageClient } from '@/components/WishlistPageClient'
import React from 'react'

const Content = () => {
  return (
    <div className="flex 3md:flex-row flex-col w-full pt-10 font-poppins relative">
        <ProfileMenu selected={2}/>
        <WishlistPageClient />
    </div>
  )
}

export default Content