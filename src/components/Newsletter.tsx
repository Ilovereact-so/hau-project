'use client'
import Image from 'next/image'
import React, { useEffect, useRef, useState, useTransition } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { subscribeToNewsletter } from '@/actions/newsletter'
import { Check, Mail, RotateCw } from 'lucide-react'

// Wynik zapisu pokazywany zamiast formularza.
interface Sent {
  email:             string
  alreadySubscribed: boolean
  mailSent:          boolean
}

interface FormErrors {
  email?: string
  consent?: string
  submit?: string
}
// Zapis wymaga potwierdzenia linkiem z maila (double opt-in) — kod −10%
// przychodzi dopiero po kliknięciu „Potwierdzam zapis”.

const Newsletter = () => {
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [sent, setSent] = useState<Sent | null>(null)
  const [errors, setErrors] = useState<FormErrors>({})
  const [isPending, startTransition] = useTransition()

  function subscribe(address: string) {
    setErrors({})
    startTransition(async () => {
      const result = await subscribeToNewsletter({ email: address, consent: true })
      if (!result.ok) {
        setErrors({ submit: result.error })
        return
      }
      setSent({ email: address, alreadySubscribed: result.status === 'already', mailSent: result.status === 'already' || result.mailSent })
      setEmail('')
      setConsent(false)
      setErrors({})
    })
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const trimmed = email.trim()
    const nextErrors: FormErrors = {}
    if (!trimmed) {
      nextErrors.email = 'Podaj adres e-mail.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      nextErrors.email = 'Podaj prawidłowy adres e-mail.'
    }
    if (!consent) {
      nextErrors.consent = 'Zgoda na otrzymywanie newslettera jest wymagana.'
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    subscribe(trimmed)
  }

  return (
    <div className='flex flex-col justify-start lg:pt-5 sm:pt-3 pb-10 lg:mt-2 sm:mx-12 mx-7 rounded-[80px] relative z-1'>
       <div id='newsletterContainer' className=''> 
            <h2 style={{gridArea:"heading"}} className='text-[clamp(20px,2vw,40px)] text-black font-medium font-poppins sm:text-left text-center relative z-1'>Zapisz sie do newslettera<br/><span className='text-[#efefef]'>i odbierz 10% rabatu!</span></h2>
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
                            onChange={e => {
                              setEmail(e.target.value)
                              setErrors(current => ({ ...current, email: undefined, submit: undefined }))
                            }}
                            placeholder='jankowalski@onet.pl'
                            aria-invalid={Boolean(errors.email)}
                            aria-describedby={errors.email ? 'newsletter-email-error' : undefined}
                            className={`px-5 flex justify-center items-center bg-white text-black placeholder:text-[#8E8E8E] text-[clamp(10px,1.2vw,16px)] rounded-[20px] py-3.5 outline-none w-full max-w-[180px] sm:max-w-[350px] border-2 ${errors.email ? 'border-red-500' : 'border-transparent'}`}
                        />
                        <button
                            type='submit'
                            disabled={isPending}
                            className='text-white font-medium text-[clamp(12px,1.4vw,18px)] px-8 flex justify-center items-center bg-fancy-black rounded-[22px] h-[clamp(40px,4vw,55px)] cursor-pointer hover:opacity-90 ease-in-out duration-200 disabled:opacity-60 disabled:cursor-not-allowed'
                        >
                            {isPending ? 'Wysyłanie…' : 'Wyślij'}
                        </button>
                    </div>
                    {errors.email && (
                      <p id='newsletter-email-error' role='alert' className='text-red-600 text-sm'>{errors.email}</p>
                    )}
                    <label className='sm:mt-4 mt-2 flex space-x-3 items-start'>
                        <label className='w-4 h-4 relative mt-1'>
                            <input
                                type='checkbox'
                                checked={consent}
                                onChange={e => {
                                  setConsent(e.target.checked)
                                  setErrors(current => ({ ...current, consent: undefined, submit: undefined }))
                                }}
                                aria-invalid={Boolean(errors.consent)}
                                aria-describedby={errors.consent ? 'newsletter-consent-error' : undefined}
                                className='w-4 h-4 absolute z-2 top-0 left-0 opacity-0 cursor-pointer'
                            />
                            <div className={`w-4 h-4 border-[2px] rounded-[4px] pointer-events-none flex justify-center items-center ${
                              errors.consent ? 'border-red-400' : 'border-fancy-black'
                            } ${
                              consent ? "bg-fancy-black" : ""
                            }`}>
                              <Check className={` ${consent ? "opacity-100":"opacity-0"} ease-in-out duration-200 text-white`}/>
                            </div>
                        </label>
                        <p className={`text-[14px] sm:max-w-[330px] max-w-[240px] text-black `}>Wyrażam zgodę na otrzymywanie newslettera i akcepuję politykę prywatności.</p>
                    </label>
                    {errors.consent && (
                      <p id='newsletter-consent-error' role='alert' className='text-red-400 text-[12px]'>{errors.consent}</p>
                    )}
                    {errors.submit && (
                      <p role='alert' className='text-red-600 text-sm'>{errors.submit}</p>
                    )}
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
//
// Ten sam szklany panel co formularz (rozmiar, zaokrąglenie, rozmycie), żeby
// sekcja nie „skakała”: nagłówek jak w formularzu, jedna linijka treści,
// akcje w stylu sklepu (czarna pigułka jak „Wyślij”, link z podkreśleniem).

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

  // Fokus na nagłówek — czytnik ekranu ogłasza wynik, a klawiatura nie
  // zostaje na przycisku „Wyślij”, który właśnie zniknął.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [sent])

  const title = failed ? 'Nie wysłaliśmy maila' : sent.alreadySubscribed ? 'Już jesteś z nami' : 'Potwierdź zapis w mailu'

  return (
    <motion.div
      role='status'
      aria-live='polite'
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: reduceMotion ? 0 : 0.2 }}
      className='flex flex-col justify-center w-full h-full min-h-[190px] bg-[#ffffff5d] p-6 rounded-[40px] backdrop-blur-[10px]'
    >
      <div className='flex items-center gap-2'>
        <motion.span
          aria-hidden
          className={`grid size-6 place-items-center rounded-full ${failed ? 'bg-black/10 text-black' : 'bg-fancy-black text-white'}`}
          initial={reduceMotion ? false : { scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 22, delay: 0.1 }}
        >
          {failed ? <Mail size={13} strokeWidth={2.2} /> : <Check size={14} strokeWidth={3} />}
        </motion.span>
        <p className='text-black/60 text-[clamp(12px,1.1vw,14px)] font-medium'>
          {failed ? 'Coś poszło nie tak' : sent.alreadySubscribed ? 'Newsletter' : 'Jeszcze jeden krok'}
        </p>
      </div>

      <h2
        ref={headingRef}
        tabIndex={-1}
        className='mt-3 text-black font-poppins font-medium text-[clamp(18px,1.6vw,26px)] leading-tight outline-none'
      >
        {title}
      </h2>
      <div className='flex flex-col gap-y-1.5 leading-snug max-w-[440px] font-poppins'>
        <p className='text-black/70 font-normal text-[clamp(13px,1.1vw,15px)]'>
          {failed ? (
            <>Nie udało się wysłać maila z linkiem potwierdzającym na <Address email={sent.email} />. Spróbuj ponownie za chwilę.</>
          ) : sent.alreadySubscribed ? (
            <>Adres <Address email={sent.email} /> jest już zapisany do newslettera — kod −10% był w mailu powitalnym.</>
          ) : (
            <>Wysłaliśmy link na <Address email={sent.email} />. </>
          )}
        </p>
        {!failed && !sent.alreadySubscribed &&
        <p className='mt-2 text-[15px]'>
          Kliknij „Potwierdzam zapis” zaraz potem przyjdzie kod -10%. <br/> Nie widzisz maila? Zajrzyj do Spamu lub Ofert.
        </p>
        }
      </div>

      <div className='mt-4 flex flex-wrap items-center gap-x-4 gap-y-2'>
        {failed && (
          <button
            type='button'
            onClick={onRetry}
            disabled={isPending}
            className='text-white font-medium text-[clamp(12px,1.2vw,15px)] px-6 h-[clamp(36px,3.2vw,46px)] inline-flex items-center gap-2 bg-fancy-black rounded-[22px] cursor-pointer hover:opacity-90 ease-in-out duration-200 disabled:opacity-60 disabled:cursor-not-allowed'
          >
            {isPending && <RotateCw size={14} className='animate-spin' aria-hidden />}
            {isPending ? 'Wysyłanie…' : 'Wyślij ponownie'}
          </button>
        )}
        <button
          type='button'
          onClick={onReset}
          disabled={isPending}
          className='text-black/70 text-[clamp(12px,1.1vw,13px)] underline underline-offset-4 decoration-black/30 hover:decoration-black cursor-pointer disabled:opacity-60'
        >
          {failed ? 'Zmień adres' : 'Zapisz inny adres'}
        </button>
      </div>
    </motion.div>
  )
}

function Address({ email }: { email: string }) {
  return <span className='text-black/70 break-words'>{email}</span>
}

export default Newsletter