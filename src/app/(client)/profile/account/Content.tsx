"use client"
import { SavedAddress } from '@/actions/address'
import React, { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Field from '../../checkout/_components/Field'
import ProfileMenu from '@/components/ProfileMenu'
import { Edit, Plus, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { CheckoutAddress } from '@/actions/checkout'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useUser } from '@clerk/nextjs'
import ChangePasswordForm from '@/components/ChangePasswordForm'

const Content = ({savedAddress}:{savedAddress:null | SavedAddress}) => {
  
  const [isEdit, setEdit] = useState<number | null>(null)
  const [errors, setErrors] = useState<Partial<Record<keyof CheckoutAddress, string>>>({})
  const [address, setAddress] = useState<SavedAddress | null>(savedAddress)
  const [additionalField, setAdditionalField] = useState<boolean>(!!address?.apartment_number)
  const { isLoaded, user } = useUser();

    
    function setField<K extends keyof CheckoutAddress>(key: K, val: CheckoutAddress[K]) {
      setAddress(prev => prev ? ({ ...prev, [key]: val }) : prev)
      if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }))
    }
  
    function validate(): boolean {
      const e: Partial<Record<keyof CheckoutAddress, string>> = {}
      if (!address?.firstName.trim())            e.firstName  = 'Wymagane'
      if (!address?.lastName.trim())             e.lastName   = 'Wymagane'
      if (!address?.email.includes('@'))         e.email      = 'Nieprawidłowy email'
      if (!address?.phone.trim())                e.phone      = 'Wymagane'
      if (!address?.street.trim())             e.street     = 'Wymagane'
      if (!address?.city.trim())               e.city       = 'Wymagane'
      if (address?.postalCode && !/^\d{2}-\d{3}$/.test(address?.postalCode)) e.postalCode = 'Format: XX-XXX'
      
      setErrors(e)
      return Object.keys(e).length === 0
    }
  
    function handleContinue() {
      if (!validate()) { toast.error('Uzupełnij wymagane pola'); return }
      //onContinue({address})
    }
    const handleBack = ()=>{
        setEdit(null)
        setAdditionalField(!!address?.apartment_number)
    }
    return (
    <div className='flex max-md:flex-col w-full md:pt-10 pt-3'>
        <ProfileMenu selected={0}/>
        <div className='w-full flex mt-2 lg:space-x-20 3xs:space-x-13 lg:space-y-10 space-y-7 flex-wrap'>
            {address?.email && address?.firstName && address?.lastName && address?.phone &&
            <ContainerModule Title="Dane adresata" isEdit={isEdit} setEdit={setEdit} triger={0} handleBack={handleBack}>
              {[address].map((item,_)=>
                {
                    const triger = 0
                  return(
                    <AnimatePresence mode="wait" initial={false} key={_}>
                      {isEdit == triger ?
                        <motion.div
                            key="edit"
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.2, ease: 'easeInOut' }}
                            className='flex flex-col relative space-y-2 py-3'>
                            <Field label="E-mail" type="email" placeholder="jankowalski@gmail.com" value={item?.email} onChange={e => setField('email', e.target.value)} error={errors.email} />
                            <div className='flex space-x-5'>
                                <Field label="Imię" type="text" placeholder="Jan" value={item?.firstName} onChange={e => setField('firstName', e.target.value)} error={errors.firstName} />
                                <Field label="Nazwisko" type="text" placeholder="Kowalski" value={item?.lastName} onChange={e => setField('lastName', e.target.value)} error={errors.lastName} />
                            </div>
                            <Field label="Telefon" type="text" name='phone' placeholder="848037241" value={item?.phone} onChange={e => setField('phone', e.target.value)} error={errors.phone} className='w-fit' />
                            <div className='w-full flex justify-end'>
                                <Button type="button" onClick={handleContinue}
                                    className="w-fit rounded-full font-bold bg-fancy-black text-white text-[16px] py-6 px-8 hover:bg-fancy-black/90 transition-colors">
                                    Zapisz i kontynuj
                                </Button>
                            </div>
                        </motion.div>
                        :
                        <motion.div
                            key="view"
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.2, ease: 'easeInOut' }}
                            className='flex flex-col text-[#6C6C6C] text-[clamp(15px,1.8vw,16px)] space-y-1 py-2'>
                            <p className=''>{item?.firstName} {item?.lastName}</p>
                            <p className=''>{item?.email}</p>
                            <p className=''>+48 {item?.phone}</p>
                        </motion.div>
                      }
                    </AnimatePresence>
                  )
                }
              )}
              
            </ContainerModule>
            }
            {address?.street && address?.postalCode && address?.city && 
            <ContainerModule Title="Adres" isEdit={isEdit} setEdit={setEdit} triger={1} handleBack={handleBack}>
              {[address].map((item,_)=>
                {
                    const triger = 1
                  return(
                    <AnimatePresence mode="wait" initial={false} key={_}>
                      {isEdit == triger ?
                        <motion.div
                            key="edit"
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.2, ease: 'easeInOut' }}
                            className='flex flex-col relative space-y-2 py-3'>
                            <Field label="Adres" type="text" placeholder="Mickiewicza 99" value={item?.street} onChange={e => setField('street', e.target.value)} error={errors.street} />
                            <div className='flex space-x-5'>
                                <Field label="Kod pocztowy" type="text" placeholder="33-100" value={item?.postalCode} onChange={e => setField('postalCode', e.target.value)} error={errors.postalCode} />
                                <Field label="Miejscowość" type="text" placeholder="Tarnów" value={item?.city} onChange={e => setField('city', e.target.value)} error={errors.city} />
                                <Field label="Kraj/region" placeholder="Polska" value="Polska" readOnly className="bg-[#F9F9F9] cursor-default" />
                            </div>
                            { !additionalField && (
                                <div onClick={() => setAdditionalField(true)} className="text-[16px] cursor-pointer flex items-center text-black">
                                    <Plus size={18} className="mr-2" />
                                    <p>mieszkanie / apartament / lokal</p>
                                </div>
                                )}
                                <div className={cn(
                                "grid transition-all duration-300",
                                additionalField ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                                )}>
                                <div className="overflow-hidden">
                                    <Field label="mieszkanie / apartament / lokal" placeholder="13"
                                    value={item?.apartment_number || ''} onChange={e => setField('apartment_number', e.target.value)} />
                                </div>
                                </div>
                            <div className='w-full flex justify-end'>
                                <Button type="button" onClick={handleContinue}
                                    className="w-fit rounded-full font-bold bg-fancy-black text-white text-[16px] py-6 px-8 hover:bg-fancy-black/90 transition-colors">
                                    Zapisz i kontynuj
                                </Button>
                            </div>
                        </motion.div>
                        :
                        <motion.div
                            key="view"
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.2, ease: 'easeInOut' }}
                            className='flex flex-col text-[#6C6C6C] text-[clamp(15px,1.8vw,16px)] space-y-1 py-2'>
                            <p className=''>{item?.street}</p>
                            <p className=''>{item?.postalCode} {item?.city}</p>
                        </motion.div>
                      }
                    </AnimatePresence>
                  )
                }
              )}
              
            </ContainerModule>
            }
            {address?.email && address?.firstName && address?.lastName && address?.phone &&
            <ContainerModule Title="Punkt odbioru" isEdit={isEdit} setEdit={setEdit} triger={2} handleBack={handleBack}>
              {[address].map((item,_)=>
                {
                    const triger = 2
                  return(
                    <AnimatePresence mode="wait" initial={false} key={_}>
                      {isEdit == triger ?
                        <motion.div
                            key="edit"
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.2, ease: 'easeInOut' }}
                            className='flex flex-col relative space-y-2 py-3'>
                            <Field label="Adres" type="text" placeholder="Mickiewicza 99" value={item?.street} onChange={e => setField('street', e.target.value)} error={errors.street} />
                            <div className='flex space-x-5'>
                                <Field label="Kod pocztowy" type="text" placeholder="33-100" value={item?.postalCode} onChange={e => setField('postalCode', e.target.value)} error={errors.postalCode} />
                                <Field label="Miejscowość" type="text" placeholder="Tarnów" value={item?.city} onChange={e => setField('city', e.target.value)} error={errors.city} />
                                <Field label="Kraj/region" placeholder="Polska" value="Polska" readOnly className="bg-[#F9F9F9] cursor-default" />
                            </div>
                            { !additionalField && (
                                <div onClick={() => setAdditionalField(true)} className="text-[16px] cursor-pointer flex items-center text-black">
                                    <Plus size={18} className="mr-2" />
                                    <p>mieszkanie / apartament / lokal</p>
                                </div>
                                )}
                                <div className={cn(
                                "grid transition-all duration-300",
                                additionalField ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                                )}>
                                <div className="overflow-hidden">
                                    <Field label="mieszkanie / apartament / lokal" placeholder="13"
                                    value={item?.apartment_number || ''} onChange={e => setField('apartment_number', e.target.value)} />
                                </div>
                                </div>
                            <div className='w-full flex justify-end'>
                                <Button type="button" onClick={handleContinue}
                                    className="w-fit rounded-full font-bold bg-fancy-black text-white text-[16px] py-6 px-8 hover:bg-fancy-black/90 transition-colors">
                                    Zapisz i kontynuj
                                </Button>
                            </div>
                        </motion.div>
                        :
                        <motion.div
                            key="view"
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.2, ease: 'easeInOut' }}
                            className='flex flex-col text-[#6C6C6C] text-[clamp(15px,1.8vw,16px)] space-y-1 py-2'>
                            <p className=''>{item?.street}</p>
                            <p className=''>{item?.postalCode} {item?.city}</p>
                        </motion.div>
                      }
                    </AnimatePresence>
                  )
                }
              )}
              
            </ContainerModule>
            }
            <div className='flex flex-col'>
                <div className="flex justify-between items-center space-x-3">
                    <h1 className="text-black text-[clamp(16px,1.8vw,18px)] font-medium">Ustawienia konta</h1>
                    {user?.passwordEnabled && isLoaded && 
                    <AnimatePresence mode="wait" initial={false} key={"edit"}>
                        {isEdit == 4 ? 
                        <motion.div
                            key="edit"
                            initial={{ opacity: 0}}
                            animate={{ opacity: 1}}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2, ease: 'easeInOut' }}
                            >
                            <X width={20} height={20} onClick={() => handleBack()} className='text-black cursor-pointer' />
                        </motion.div>
                        :
                        <motion.div
                            key="view"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2, ease: 'easeInOut' }}
                            >
                            <Edit width={20} height={20} onClick={() => setEdit(4)} className='text-black cursor-pointer' />
                        </motion.div>
                        }
                    </AnimatePresence>
                    }
                </div>
                <ChangePasswordForm user={user} isLoaded={isLoaded} isEdit={isEdit}/>
            </div>
        </div>
    </div>
  )
}

export default Content



const ContainerModule = ({Title, children, isEdit, setEdit, triger, handleBack}: {Title: string, children: React.ReactNode, isEdit: number | null, setEdit: (value: number | null) => void, triger: number, handleBack: () => void}) =>{

    return(
        <div className='flex flex-col max-3xs:w-full'>
            <div className="flex justify-between items-center space-x-3">
            <h1 className="text-black text-[clamp(16px,1.8vw,18px)] font-medium">{Title}</h1>
            <AnimatePresence mode="wait" initial={false} key={"edit"}>
                {isEdit == triger ? 
                <motion.div
                    key="edit"
                    initial={{ opacity: 0}}
                    animate={{ opacity: 1}}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    >
                    <X width={20} height={20} onClick={() => handleBack()} className='text-black cursor-pointer' />
                </motion.div>
                :
                <motion.div
                    key="view"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    >
                    <Edit width={20} height={20} onClick={() => setEdit(triger)} className='text-black cursor-pointer' />
                </motion.div>
                }
            </AnimatePresence>
            </div>
            {children}
        </div>
    )
}