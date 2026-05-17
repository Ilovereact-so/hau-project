// components/FurgonetkaTest.tsx
'use client'
import { useEffect, useState } from 'react'

export default function FurgonetkaTest() {
  const [status, setStatus] = useState<string>('czekam...')

  useEffect(() => {
    fetch('https://api.furgonetka.pl/points/map?lat=52.2&lon=21.0&radius=5', {
      headers: { 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_FURGONETKA_MAP_API_KEY}` }
    })
      .then(r => setStatus(`HTTP ${r.status} — CORS OK`))
      .catch(e => setStatus(`Błąd: ${e.message}`))
  }, [])

  return <div style={{ padding: 20, background: '#f0f0f0' }}>Status: {status}</div>
}