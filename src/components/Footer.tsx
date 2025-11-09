import React from 'react'

const Footer = () => {
  return (
    <div className='w-full bg-main px-10 py-8 flex justify-start mt-12 space-x-10'>
        <div className='flex flex-col text-black w-auto'>
            <h1 className='text-[34px] font-bold'>HAU sklep</h1>
            <p className='text-[18px] inline-block min-w-[600px]'>© 2025 Hau sklep. Wszystkie prawa zastrzeżone.</p>
        </div>
        <div className='w-full flex h-full justify-center items-center'>
            <table id='Footer' className='w-full text-black text-[20px]'>
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