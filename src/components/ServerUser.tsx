'server-only'
import React from 'react'
import { currentUser } from '@clerk/nextjs/server'
import { unstable_rethrow } from 'next/navigation'
import CartIcon from './CartIcon'
import UserIcon from './UserIcon'

const ServerUser = async({style = {}, mode, cart = false}: {style?: React.CSSProperties, mode:number, cart?: boolean}) => {
    const user = await safeCurrentUser()
    //console.log(user?.imageUrl)
    const avatarUrl = user ? (user.imageUrl || "/default-avatar.png") : null;
    //mode 0 = główny look, mode 1 = produktowy itd
  return (
    <div style={style} className={mode === 1 ? "flex sm:justify-center justify-end sm:items-center items-start max-sm:pr-0":"flex justify-end items-start max-sm:pr-0 " }> {/** lg:px-3 px-2 py-1*/}
      <div id='menu_dock_container' className={mode === 1 ? cart ? "flex sm:justify-center ease-in-out duration-300 items-center justify-between max-sm:w-max w-fit max-md:mt-3 max-sm:h-[46px] max-sm:relative max-sm:rounded-full max-sm:bg-fancy-black max-sm:min-w-[70px]" : "flex sm:justify-center items-center justify-between max-sm:w-max w-fit max-md:mt-3 max-sm:h-[46px] max-sm:relative max-sm:rounded-l-full max-sm:bg-fancy-black max-sm:min-w-[70px]" : "flex lg:mt-0 mt-6 max-sm:h-[46px] relative justify-between items-center sm:rounded-full rounded-l-full bg-fancy-black h-fit lg:min-w-[80px] min-w-[70px] w-fit"}>
          <div className='w-auto flex justify-center items-center h-full'>
              {/* Gość też dostaje menu konta: ikona → profil (wishlista), w menu logowanie */}
              <UserIcon avatarUrl={avatarUrl} mode={mode} card={cart}/>
          </div>
        
          <CartIcon mode={mode} />
          
      </div>
    </div>
  )
}

// Navbar siedzi też w głównym not-found.tsx, który Next renderuje w drzewie
// KAŻDEJ strony — również statycznej (np. /studio), gdzie nie ma nagłówków
// z clerkMiddleware i currentUser() rzuca. Wtedy pokazujemy wersję gościa
// zamiast wywracać całą stronę błędem 500.
async function safeCurrentUser() {
  try {
    return await currentUser()
  } catch (err) {
    unstable_rethrow(err)
    return null
  }
}

export default ServerUser