import React from 'react'

const Newsletter = () => {
  return (
    <div className='flex flex-col justify-start bg-[#AF9E9E] px-15 pt-15 pb-10 mt-12 w-full'>
       <div className='flex justify-evenly items-start'> 
            <div className='flex flex-col space-y-4 w-auto h-auto'>
                <h1 className='text-[40px] text-black font-poppins'>Otrzymaj 10% rabatu <br/><span className='font-bold'>zapisując się do newslettera</span></h1>
                <form className='flex items-end space-x-8 w-full h-full'>
                    <label className='w-fit flex flex-col space-y-2'>
                        <p className='text-black text-[22px]'>Email:</p>
                        <input type='text' placeholder='kowalskijan@onet.pl' className='p-2 pl-4 flex justify-center items-center bg-white text-black text-[20px] rounded-[17px] h-[60px] outline-none w-[350px]'></input>
                    </label>
                    <button type='submit' className='text-white font-bold text-[20px] px-8 flex justify-center items-center bg-black rounded-[17px] h-[60px]'>Wyślij</button>
                </form>
            </div>
            <div className='text-[22px] text-black space-y-2 w-auto h-auto'>
                <h1>Będąc z nami otrzymasz:</h1>
                <ul className='list-disc pl-6 space-y-2'>
                    <li>powiadomienia o promocjach i wydarzeniach</li>
                    <li>specjalne kupony zniżkowe i promocje na darmowe dostawy</li>
                    <li>informacje o nowościach w sklepie</li>
                </ul>
            </div>
        </div>
        <div className='w-full h-auto flex justify-end mt-5'>
            <h1 className='text-[15px] text-black'>*minimalna kwota zamówienia to 100zł. Pełny regulamin promocji znajdziesz na <a className='underline cursor-pointer'>ehau.pl/regulamin</a></h1>
        </div>
    </div>
  )
}

export default Newsletter