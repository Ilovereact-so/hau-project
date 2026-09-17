'use client'
import { Toaster as HotToaster } from 'react-hot-toast'

export default function Toaster() {
  return (
    <HotToaster
      position='top-center'
      toastOptions={{
        duration: 4000,
        style: {
          fontFamily: 'var(--font-poppins), sans-serif',
          fontSize: '14px',
          borderRadius: '16px',
          padding: '12px 20px',
        },
      }}
    />
  )
}