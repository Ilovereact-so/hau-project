'use client'
import Image from 'next/image'
import React, { useEffect, useRef, useState, useTransition } from 'react'
import toast from 'react-hot-toast'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { subscribeToNewsletter } from '@/actions/newsletter'
import { Check, Mail, RotateCw } from 'lucide-react'

// Wynik zapisu pokazywany zamiast formularza.
interface Sent {
  email:             string
  alreadySubscribed: boolean
  mailSent:          boolean
}

const Newsletter = () => {
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [sent, setSent] = useState<Sent | null>(null)
  const [isPending, startTransition] = useTransition()

  function subscribe(address: string) {
    startTransition(async () => {
      const result = await subscribeToNewsletter({ email: address, consent: true })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setSent({ email: address, alreadySubscribed: result.alreadySubscribed, mailSent: result.mailSent })
      setEmail('')
      setConsent(false)
    })
  }

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

    subscribe(trimmed)
  }

  return (
    <div className='flex flex-col justify-start lg:pt-5 sm:pt-3 pb-10 lg:mt-2 sm:mx-12 mx-7 rounded-[80px] relative z-1'>
       <div id='newsletterContainer' className=''> 
            <h1 style={{gridArea:"heading"}} className='text-[clamp(20px,2vw,40px)] text-black font-medium font-poppins sm:text-left text-center relative z-1'>Zapisz sie do newslettera<br/><span className='text-[#efefef]'>i odbierz 10% rabatu!</span></h1>
            <div style={{gridArea:"form"}} className='flex sm:w-auto max-sm:justify-center w-full h-auto relative z-1'>
                <AnimatePresence mode='wait' initial={false}>
                {sent ? (
                  <NewsletterSent
                    key='sent'
                    sent={sent}
                    isPending={isPending}
                    onRetry={() => subscribe(sent.email)}
                    onReset={() => setSent(null)}
                  />
                ) : (
                <motion.form
                    key='form'
                    onSubmit={handleSubmit}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className='flex flex-col space-y-2 w-full h-full bg-[#ffffff5d] p-6 rounded-[40px] backdrop-blur-[10px]'>
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
                </motion.form>
                )}
                </AnimatePresence>
            </div>
            <div className='absolute sm:-right-12 -right-7 bottom-0 max-w-[1000px] sm:w-[60vw] w-[90vw] flex justify-end z-0'>
                <Image src="/newsletter.png" width={500} height={500} alt="newsletter_image" className='w-full '/>
            </div>
        </div>                
    </div>
  )
}

// ─── Potwierdzenie wysłania ─────────────────────────────────────────────────

const MINT = '#6EB0A6'
const MINT_BG = '#e2f3f0'
const AMBER = '#C98A2B'
const AMBER_BG = '#fbf0dc'

function NewsletterSent({
  sent,
  isPending,
  onRetry,
  onReset,
}: {
  sent:      Sent
  isPending: boolean
  onRetry:   () => void
  onReset:   () => void
}) {
  const reduceMotion = useReducedMotion()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const failed = !sent.mailSent

  // Fokus na nagłówek — czytnik ekranu od razu ogłasza wynik, a klawiatura
  // nie ląduje na znikniętym przycisku „Wyślij”.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [sent])

  const accent = failed ? AMBER : MINT
  const accentBg = failed ? AMBER_BG : MINT_BG

  const title = failed
    ? 'Zapisaliśmy Cię, ale…'
    : sent.alreadySubscribed
      ? 'Już jesteś z nami!'
      : 'Jesteś na liście!'

  const spring = reduceMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 320, damping: 18 }

  return (
    <motion.div
      role='status'
      aria-live='polite'
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: reduceMotion ? 0 : 0.28, ease: 'easeOut' }}
      className='flex sm:flex-row flex-col sm:items-center items-start gap-5 w-full h-full bg-[#ffffff5d] p-6 rounded-[40px] backdrop-blur-[10px] sm:max-w-[520px]'
    >
      {/* Koperta w kółku + odznaka ✓ / ↻ */}
      <div className='relative shrink-0 w-[72px] h-[72px]'>
        {!reduceMotion && !failed && (
          <motion.span
            aria-hidden
            className='absolute inset-0 rounded-full'
            style={{ backgroundColor: accentBg }}
            initial={{ scale: 1, opacity: 0.8 }}
            animate={{ scale: 1.6, opacity: 0 }}
            transition={{ duration: 1.1, ease: 'easeOut', delay: 0.35 }}
          />
        )}
        <motion.div
          aria-hidden
          className='relative w-full h-full rounded-full flex items-center justify-center'
          style={{ backgroundColor: accentBg }}
          initial={{ scale: 0.6 }}
          animate={{ scale: 1 }}
          transition={spring}
        >
          <motion.span
            initial={reduceMotion ? false : { y: 10, opacity: 0, rotate: -12 }}
            animate={{ y: 0, opacity: 1, rotate: 0 }}
            transition={{ ...spring, delay: reduceMotion ? 0 : 0.1 }}
          >
            <Mail size={30} strokeWidth={1.8} style={{ color: accent }} />
          </motion.span>
        </motion.div>
        <motion.span
          aria-hidden
          className='absolute -right-1 -bottom-1 w-7 h-7 rounded-full flex items-center justify-center border-[3px] border-white'
          style={{ backgroundColor: accent }}
          initial={reduceMotion ? false : { scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ ...spring, delay: reduceMotion ? 0 : 0.3 }}
        >
          {failed
            ? <RotateCw size={13} strokeWidth={3} className='text-white' />
            : <Check size={14} strokeWidth={3.5} className='text-white' />}
        </motion.span>
      </div>

      <div className='flex flex-col min-w-0'>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className='text-black font-poppins font-semibold text-[clamp(18px,1.6vw,24px)] leading-tight outline-none'
        >
          {title}{!failed && <span aria-hidden> 🐾</span>}
        </h2>

        <p className='mt-1.5 text-black/80 text-[clamp(13px,1.1vw,15px)] leading-snug'>
          {failed ? (
            <>Adres <Address email={sent.email} /> jest na liście, ale wiadomość z&nbsp;kodem −10% nie wyszła.</>
          ) : sent.alreadySubscribed ? (
            <>Ten adres był już zapisany — kod −10% wysłaliśmy jeszcze raz na <Address email={sent.email} />.</>
          ) : (
            <>Kod rabatowy −10% wysłaliśmy na <Address email={sent.email} />.</>
          )}
        </p>

        {!failed && (
          <p className='mt-1 text-black/55 text-[13px] leading-snug'>
            Nie widzisz wiadomości? Zajrzyj do folderu Spam lub Oferty.
          </p>
        )}

        <div className='mt-4 flex flex-wrap items-center gap-2'>
          {failed && (
            <button
              type='button'
              onClick={onRetry}
              disabled={isPending}
              className='text-white font-medium text-[14px] px-5 h-10 inline-flex items-center gap-2 bg-fancy-black rounded-[18px] cursor-pointer hover:opacity-90 ease-in-out duration-200 disabled:opacity-60 disabled:cursor-not-allowed'
            >
              <RotateCw size={15} className={isPending ? 'animate-spin' : ''} />
              {isPending ? 'Wysyłanie…' : 'Wyślij ponownie'}
            </button>
          )}
          <button
            type='button'
            onClick={onReset}
            disabled={isPending}
            className='text-black font-medium text-[14px] px-5 h-10 inline-flex items-center bg-white/80 hover:bg-white rounded-[18px] cursor-pointer ease-in-out duration-200 disabled:opacity-60'
          >
            {failed ? 'Zmień adres' : 'Zapisz inny adres'}
          </button>
        </div>
      </div>
    </motion.div>
  )
}

function Address({ email }: { email: string }) {
  return <strong className='font-semibold text-black break-all'>{email}</strong>
}

export default Newsletter