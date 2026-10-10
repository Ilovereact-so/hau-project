/*
 * Znaki metod płatności (BLIK, karty, Google Pay, Apple Pay) — rysowane
 * w kodzie (bez plików graficznych), wspólne dla kasy i koszyka.
 */

export function LogoBlik() {
  return (
    <span className="inline-flex items-center justify-center bg-black text-white text-[11px] font-black tracking-wide px-2.5 py-1 rounded-[6px] leading-none select-none">
      blik
    </span>
  )
}

export function LogoCards() {
  return (
    <span className="flex items-center gap-1">
      <span className="text-[11px] font-bold text-[#1A1F71] border border-[#1A1F71] px-1.5 py-0.5 rounded leading-none">VISA</span>
      <span className="inline-flex items-center">
        <span className="w-5 h-5 rounded-full bg-[#EB001B] inline-block -mr-2.5"/>
        <span className="w-5 h-5 rounded-full bg-[#F79E1B] inline-block"/>
      </span>
    </span>
  )
}

export function LogoGooglePay() {
  return (
    <span className="flex items-center gap-1">
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 11.5v-3h7.1c.1.5.1 1 .1 1.5 0 4.1-2.8 7-7.2 7-4.1 0-7.5-3.4-7.5-7.5S7.9 4 12 4c2 0 3.7.7 5 1.9l-2.1 2.1C14 7.3 13.1 7 12 7c-2.8 0-5 2.2-5 5s2.2 5 5 5c2.3 0 3.8-1.2 4.3-3H12v-2.5z" fill="#4285F4"/>
      </svg>
      <span className="text-[13px] font-medium tracking-tight">
        <span style={{color:'#4285F4'}}>G</span><span style={{color:'#EA4335'}}>o</span><span style={{color:'#FBBC05'}}>o</span><span style={{color:'#4285F4'}}>g</span><span style={{color:'#34A853'}}>l</span><span style={{color:'#EA4335'}}>e</span>
        <span className="text-black font-medium"> Pay</span>
      </span>
    </span>
  )
}

export function LogoApplePay() {
  return (
    <span className="flex items-center gap-1">
      <svg width="13" height="16" viewBox="0 0 814 1000" fill="currentColor" aria-hidden="true">
        <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-37.8-155.5-127.4C46 790.8.1 693.7.1 601.8c0-159.2 103.7-243.6 205.1-243.6 54.1 0 99.4 35.7 133.5 35.7 32.6 0 84.4-37.8 147-37.8 23.7 0 108.2 2.6 168.1 81.2zm-97.8-187.1c32.1-38.1 55.1-90.9 55.1-143.7 0-7.7-.6-15.4-1.9-21.7-52.5 1.9-114.1 35.1-151.5 79.2-28.9 33.3-56.4 85.4-56.4 139.5 0 8.3 1.3 16.6 1.9 19.1 3.2.6 8.4 1.3 13.5 1.3 47.4 0 105.6-31.9 139.3-73.7z"/>
      </svg>
      <span className="text-[13px] font-medium text-black"> Pay</span>
    </span>
  )
}
