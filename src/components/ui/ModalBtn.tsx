'use client'
import { useAuthModalStore } from '@/store/authModalStore';
import React from 'react'

const ModalBtn = ({type, children, className}: {type: string, children: React.ReactNode, className?: string}) => {
    const { openModal } = useAuthModalStore();
  return (
    <button onClick={() => openModal(type as 'signIn' | 'signUp' | 'resetPassword')} className={className}>
        {children}
    </button>
  )
}

export default ModalBtn