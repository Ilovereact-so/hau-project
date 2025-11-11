import React from 'react'

const Footer = () => {
  return (
    <div className='w-full bg-main px-10 py-8 xl:flex justify-start mt-12 space-x-10 hidden'>
        <div className='flex flex-col text-black w-auto'>
            <h1 className='text-[clamp(14px,2vw,34px)] font-bold'>HAU sklep</h1>
            <p className='text-[clamp(8px,1.4vw,18px)] inline-block min-w-[600px]'>© 2025 Hau sklep. Wszystkie prawa zastrzeżone.</p>
        </div>
        <div className='w-full flex h-full justify-center items-center'>
            <table id='Footer' className='w-full text-black text-[clamp(14px,1.3vw,20px)]'>
                <tbody className='h-full w-full'>
                    <tr >
                        <td>Regulamin</td>
                        <td>Dostawa</td>
                        <td>Zwroty i reklamacje</td>
                    </tr>
                    <tr>
                        <td>Polityka prywatności</td>
                        <td>Formy płatności</td>
                        <td>Moje konto</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
  )
}

export default Footer