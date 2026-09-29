'use client'
import Image from 'next/image'
import React, { useState, useTransition } from 'react'
import toast from 'react-hot-toast'
import { subscribeToNewsletter } from '@/actions/newsletter'
import { Check } from 'lucide-react'

const Newsletter = () => {
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const trimmed = email.trim()
    if (!trimmed) {
      toast.error('Podaj adres e-mail.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error('Podaj prawidłowy adres e-mail.')
      return
    }
    if (!consent) {
      toast.error('Zgoda na otrzymywanie newslettera jest wymagana.')
      return
    }

    startTransition(async () => {
      const result = await subscribeToNewsletter({ email: trimmed, consent })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Dziękujemy! Sprawdź skrzynkę — kod rabatowy już leci. 🐾')
      setEmail('')
      setConsent(false)
    })
  }

  return (
    <div className='flex flex-col justify-start lg:pt-5 sm:pt-3 pb-10 lg:mt-2 sm:mx-12 mx-7 rounded-[80px] relative z-1'>
       <div id='newsletterContainer' className=''> 
            <h1 style={{gridArea:"heading"}} className='text-[clamp(20px,2vw,40px)] text-black font-medium font-poppins sm:text-left text-center relative z-1'>Zapisz sie do newslettera<br/><span className='text-[#efefef]'>i odbierz 10% rabatu!</span></h1>
            <div style={{gridArea:"form"}} className='flex sm:w-auto max-sm:justify-center w-full h-auto relative z-1'>
                <form onSubmit={handleSubmit} className='flex flex-col space-y-2 w-full h-full bg-[#ffffff5d] p-6 rounded-[40px] backdrop-blur-[10px]'>
                    <label className='w-fit flex flex-col space-y-2'>
                        <p className='text-black text-[clamp(12px,1.3vw,18px)] font-medium'>Email:</p>
                    </label>
                    <div className='flex items-center space-x-2'>
                        <input
                            type='email'
                            required
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder='jankowalski@onet.pl'
                            className='px-5 flex justify-center items-center bg-white text-black placeholder:text-[#8E8E8E] text-[clamp(10px,1.2vw,16px)] rounded-[20px] py-3.5 outline-none w-full max-w-[180px] sm:max-w-[350px]'
                        />
                        <button
                            type='submit'
                            disabled={isPending}
                            className='text-white font-medium text-[clamp(12px,1.4vw,18px)] px-8 flex justify-center items-center bg-fancy-black rounded-[22px] h-[clamp(40px,4vw,55px)] cursor-pointer hover:opacity-90 ease-in-out duration-200 disabled:opacity-60 disabled:cursor-not-allowed'
                        >
                            {isPending ? 'Wysyłanie…' : 'Wyślij'}
                        </button>
                    </div>
                    <label className='sm:mt-4 mt-2 flex space-x-3 items-start'>
                        <label className='w-4 h-4 relative mt-1'>
                            <input
                                type='checkbox'
                                checked={consent}
                                onChange={e => setConsent(e.target.checked)}
                                className='w-4 h-4 absolute z-2 top-0 left-0 opacity-0 cursor-pointer'
                            />
                            <div className={`w-4 h-4 border-[2px] border-fancy-black rounded-[4px] pointer-events-none flex justify-center items-center ${
                              consent ? "bg-fancy-black" : ""
                            }`}>
                              <Check className={` ${consent ? "opacity-100":"opacity-0"} ease-in-out duration-200 text-white`}/>
                            </div>
                        </label>
                        <p className='text-black text-[14px] sm:max-w-[330px] max-w-[240px]'>Wyrażam zgodę na otrzymywanie newslettera i akcepuję politykę prywatności.</p>
                    </label>
                </form>
            </div>
            <div className='absolute sm:-right-12 -right-7 bottom-0 max-w-[1000px] sm:w-[60vw] w-[90vw] flex justify-end z-0'>
                <Image src="/newsletter.png" width={500} height={500} alt="newsletter_image" className='w-full '/>
            </div>
        </div>                
    </div>
  )
}

export default Newsletter