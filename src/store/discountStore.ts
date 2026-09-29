import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

/*
 * Kod rabatowy wpisany w koszyku. Trzymamy WYŁĄCZNIE kod — kwotę rabatu
 * zawsze liczy serwer (`previewDiscountCode`, a przy zamówieniu kasa), więc
 * nic z localStorage nie wpływa na cenę. Kod przechodzi z koszyka do kasy
 * i znika po złożeniu zamówienia albo gdy serwer go odrzuci.
 */
interface DiscountState {
  code: string | null
  setCode: (code: string | null) => void
}

export const useDiscountStore = create<DiscountState>()(
  persist(
    set => ({
      code: null,
      setCode: code => set({ code }),
    }),
    {
      name: 'hau-discount',
      version: 1,
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
)
