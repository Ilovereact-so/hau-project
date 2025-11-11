import React from 'react'

const Newsletter = () => {
  return (
    <div className='flex flex-col justify-start bg-[#AF9E9E] lg:px-15 px-6 pt-15 pb-10 mt-12 w-full'>
       <div id='newsletterContainer' className=''> 
            <h1 style={{gridArea:"heading"}} className='text-[clamp(20px,2vw,40px)] text-black font-poppins sm:text-left text-center'>Otrzymaj 10% rabatu <br/><span className='font-bold'>zapisując się do newslettera</span></h1>
            <div style={{gridArea:"form"}} className='flex flex-col space-y-4 w-auto h-auto'>
                <form className='flex max-sm:justify-center items-end xl:space-x-8 space-x-5 w-full h-full'>
                    <label className='w-fit flex flex-col space-y-2'>
                        <p className='text-black text-[clamp(12px,1.5vw,22px)]'>Email:</p>
                        <input type='text' placeholder='kowalskijan@onet.pl' className='p-2 pl-4 flex justify-center items-center bg-white text-black text-[clamp(10px,1.2vw,20px)] rounded-[17px] h-[clamp(40px,4vw,60px)] outline-none w-max max-w-[350px]'></input>
                    </label>
                    <button type='submit' className='text-white font-bold text-[clamp(12px,1.4vw,20px)] px-8 flex justify-center items-center bg-black rounded-[17px] h-[clamp(40px,4vw,60px)]'>Wyślij</button>
                </form>
            </div>
            <div style={{gridArea:"description"}} className='text-[clamp(12px,1.5vw,22px)] text-black space-y-2 w-auto h-auto'>
                <h1>Będąc z nami otrzymasz:</h1>
                <ul className='list-disc pl-6 space-y-2'>
                    <li>powiadomienia o promocjach i wydarzeniach</li>
                    <li>specjalne kupony zniżkowe i promocje na darmowe dostawy</li>
                    <li>informacje o nowościach w sklepie</li>
                </ul>
            </div>
        </div>
        <div className='w-full h-auto flex sm:justify-end justify-center mt-5'>
            <h1 className='text-[clamp(8px,1vw,15px)] text-black'>*minimalna kwota zamówienia to 100zł. Pełny regulamin promocji znajdziesz na <a className='underline cursor-pointer'>ehau.pl/regulamin</a></h1>
        </div>
    </div>
  )
}

export default Newsletter