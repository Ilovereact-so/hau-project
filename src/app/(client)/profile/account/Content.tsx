"use client"
import React, { useState, useTransition, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Edit, Plus, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useUser } from '@clerk/nextjs'
import { saveProfileAddress, type ProfileAddressSection, type SavedAddress } from '@/actions/address'
import Field from '../../checkout/_components/Field'
import ProfileMenu from '@/components/ProfileMenu'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import ChangePasswordForm from '@/components/ChangePasswordForm'

/*
 * Dane konta: „Dane odbiorcy” i „Adres dostawy” (podpowiadane w kasie) oraz hasło.
 *
 * Każda sekcja pokazuje ZAPISANE dane, a edycja działa na osobnej kopii
 * roboczej. Wcześniej sekcja renderowała się warunkowo od wpisywanych na żywo
 * wartości — wyczyszczenie jednego pola odmontowywało cały formularz, układ
 * przeskakiwał i kolejne stuknięcie na telefonie trafiało w linki menu konta.
 */

type Errors = Partial<Record<keyof SavedAddress, string>>

const EMPTY: SavedAddress = {
  firstName: '', lastName: '', email: '', phone: '',
  street: '', apartment_number: undefined, city: '', postalCode: '', country: 'PL',
}

// Hasło zostaje na liczbie — tak steruje nim ChangePasswordForm.
const PASSWORD_EDIT = 4

const Content = ({ savedAddress }: { savedAddress: null | SavedAddress }) => {
  const [saved, setSaved] = useState<SavedAddress>(savedAddress ?? EMPTY)
  const [editing, setEditing] = useState<ProfileAddressSection | 'password' | null>(null)
  const { isLoaded, user } = useUser()

  const hasContact = Boolean(saved.firstName || saved.lastName || saved.email || saved.phone)
  const hasAddress = Boolean(saved.street || saved.city || saved.postalCode)

  return (
    <div className='flex max-md:flex-col w-full md:pt-10 pt-3'>
      <ProfileMenu selected={0} />
      <div className='w-full min-w-0 grid gap-x-16 gap-y-10 mt-2 xl:grid-cols-2'>
        <Section
          title='Dane odbiorcy'
          editing={editing === 'contact'}
          onEdit={() => setEditing('contact')}
          onCancel={() => setEditing(null)}
        >
          {editing === 'contact' ? (
            <SectionForm
              section='contact'
              initial={saved}
              onSaved={(address) => { setSaved(address); setEditing(null) }}
            />
          ) : hasContact ? (
            <SavedLines lines={[
              `${saved.firstName} ${saved.lastName}`.trim(),
              saved.email,
              saved.phone,
            ]} />
          ) : (
            <EmptyHint text='Dodaj dane odbiorcy — podpowiemy je w kasie.' onAdd={() => setEditing('contact')} />
          )}
        </Section>

        <Section
          title='Adres dostawy'
          editing={editing === 'address'}
          onEdit={() => setEditing('address')}
          onCancel={() => setEditing(null)}
        >
          {editing === 'address' ? (
            <SectionForm
              section='address'
              initial={saved}
              onSaved={(address) => { setSaved(address); setEditing(null) }}
            />
          ) : hasAddress ? (
            <SavedLines lines={[
              [saved.street, saved.apartment_number].filter(Boolean).join(' / '),
              `${saved.postalCode} ${saved.city}`.trim(),
              'Polska',
            ]} />
          ) : (
            <EmptyHint text='Dodaj adres dostawy kurierem — uzupełnimy go w kasie.' onAdd={() => setEditing('address')} />
          )}
        </Section>

        <div className='flex flex-col min-w-0 xl:col-span-2'>
          <div className='flex justify-between items-center gap-3'>
            <h2 className='text-black text-[clamp(16px,1.8vw,18px)] font-medium'>Ustawienia konta</h2>
            {user?.passwordEnabled && isLoaded && (
              <EditToggle
                editing={editing === 'password'}
                onEdit={() => setEditing('password')}
                onCancel={() => setEditing(null)}
                label='hasło'
              />
            )}
          </div>
          <ChangePasswordForm user={user} isLoaded={isLoaded} isEdit={editing === 'password' ? PASSWORD_EDIT : null} />
        </div>
      </div>
    </div>
  )
}

export default Content

// ─── sekcje ───────────────────────────────────────────────────────────────────

function Section({
  title, editing, onEdit, onCancel, children,
}: {
  title: string
  editing: boolean
  onEdit: () => void
  onCancel: () => void
  children: React.ReactNode
}) {
  return (
    <section className='flex flex-col min-w-0'>
      <div className='flex justify-between items-center gap-3'>
        <h2 className='text-black text-[clamp(16px,1.8vw,18px)] font-medium'>{title}</h2>
        <EditToggle editing={editing} onEdit={onEdit} onCancel={onCancel} label={title.toLowerCase()} />
      </div>
      <AnimatePresence mode='wait' initial={false}>
        <motion.div
          key={editing ? 'edit' : 'view'}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: 'easeInOut' }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </section>
  )
}

function EditToggle({
  editing, onEdit, onCancel, label,
}: { editing: boolean; onEdit: () => void; onCancel: () => void; label: string }) {
  return (
    <button
      type='button'
      onClick={editing ? onCancel : onEdit}
      aria-label={editing ? `Anuluj edycję: ${label}` : `Edytuj: ${label}`}
      className='grid size-9 place-items-center rounded-full text-black hover:bg-black/5 transition-colors cursor-pointer'
    >
      {editing ? <X width={20} height={20} /> : <Edit width={20} height={20} />}
    </button>
  )
}

function SavedLines({ lines }: { lines: string[] }) {
  return (
    <div className='flex flex-col text-[#6C6C6C] text-[clamp(15px,1.8vw,16px)] space-y-1 py-2 break-words'>
      {lines.filter(Boolean).map((line, i) => <p key={i}>{line}</p>)}
    </div>
  )
}

function EmptyHint({ text, onAdd }: { text: string; onAdd: () => void }) {
  return (
    <div className='flex flex-col items-start gap-2 py-2'>
      <p className='text-[#6C6C6C] text-[clamp(14px,1.6vw,15px)]'>{text}</p>
      <button type='button' onClick={onAdd} className='inline-flex items-center gap-1.5 text-black text-[15px] font-medium cursor-pointer hover:opacity-70'>
        <Plus size={18} aria-hidden /> Dodaj
      </button>
    </div>
  )
}

// ─── formularz sekcji ─────────────────────────────────────────────────────────

function SectionForm({
  section, initial, onSaved,
}: {
  section: ProfileAddressSection
  initial: SavedAddress
  onSaved: (address: SavedAddress) => void
}) {
  // Kopia robocza — niezależna od tego, co widać po zapisie.
  const [draft, setDraft] = useState<SavedAddress>(initial)
  const [errors, setErrors] = useState<Errors>({})
  const [showApartment, setShowApartment] = useState(Boolean(initial.apartment_number))
  const [pending, startTransition] = useTransition()

  const set = <K extends keyof SavedAddress>(key: K, value: SavedAddress[K]) => {
    setDraft(prev => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }))
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    startTransition(async () => {
      const result = await saveProfileAddress(section, draft)
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {})
        toast.error(result.error)
        return
      }
      toast.success('Zapisano')
      onSaved(result.address)
    })
  }

  return (
    <form onSubmit={submit} noValidate className='flex flex-col gap-3 py-3 max-w-[560px]'>
      {section === 'contact' ? (
        <>
          <div className='grid gap-3 sm:grid-cols-2'>
            <Field label='Imię' autoComplete='given-name' placeholder='Jan' value={draft.firstName} onChange={e => set('firstName', e.target.value)} error={errors.firstName} />
            <Field label='Nazwisko' autoComplete='family-name' placeholder='Kowalski' value={draft.lastName} onChange={e => set('lastName', e.target.value)} error={errors.lastName} />
          </div>
          <Field label='E-mail' type='email' autoComplete='email' inputMode='email' placeholder='jankowalski@gmail.com' value={draft.email} onChange={e => set('email', e.target.value)} error={errors.email} />
          <Field label='Telefon' type='tel' autoComplete='tel' inputMode='tel' placeholder='600 700 800' value={draft.phone} onChange={e => set('phone', e.target.value)} error={errors.phone} />
        </>
      ) : (
        <>
          <Field label='Ulica i numer' autoComplete='address-line1' placeholder='Mickiewicza 99' value={draft.street} onChange={e => set('street', e.target.value)} error={errors.street} />
          {showApartment ? (
            <Field label='Mieszkanie / lokal' autoComplete='address-line2' placeholder='13' value={draft.apartment_number ?? ''} onChange={e => set('apartment_number', e.target.value)} />
          ) : (
            <button type='button' onClick={() => setShowApartment(true)} className='self-start inline-flex items-center text-[15px] text-black cursor-pointer'>
              <Plus size={18} className='mr-2' aria-hidden /> mieszkanie / apartament / lokal
            </button>
          )}
          <div className='grid gap-3 sm:grid-cols-[minmax(0,140px)_minmax(0,1fr)]'>
            <Field label='Kod pocztowy' autoComplete='postal-code' inputMode='numeric' placeholder='33-100' value={draft.postalCode} onChange={e => set('postalCode', e.target.value)} error={errors.postalCode} />
            <Field label='Miejscowość' autoComplete='address-level2' placeholder='Tarnów' value={draft.city} onChange={e => set('city', e.target.value)} error={errors.city} />
          </div>
          <Field label='Kraj' value='Polska' readOnly tabIndex={-1} className='bg-[#F9F9F9] cursor-default' />
        </>
      )}
      <div className='flex justify-end pt-1'>
        <Button
          type='submit'
          disabled={pending}
          className={cn('w-fit rounded-full font-bold bg-fancy-black text-white text-[16px] py-6 px-8 hover:bg-fancy-black/90 transition-colors', pending && 'opacity-70')}
        >
          {pending ? 'Zapisuję…' : 'Zapisz'}
        </Button>
      </div>
    </form>
  )
}
