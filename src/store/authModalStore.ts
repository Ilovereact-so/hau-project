import { create } from 'zustand'

export type AuthView = 'signIn' | 'signUp' | 'resetPassword'

export type OpenModalOptions = {
  /**
   * Dokąd przejść po zalogowaniu. Brak = zostajemy na bieżącej stronie
   * (odświeżamy ją, żeby komponenty serwerowe zobaczyły sesję).
   */
  redirectTo?: string | null
}

interface AuthModalState {
  isOpen: boolean
  view: AuthView
  redirectTo: string | null
  openModal: (view?: AuthView, options?: OpenModalOptions) => void
  closeModal: () => void
  setView: (view: AuthView) => void
}

export const useAuthModalStore = create<AuthModalState>((set) => ({
  isOpen: false,
  view: 'signIn',
  redirectTo: null,
  openModal: (view = 'signIn', options) =>
    set({ isOpen: true, view, redirectTo: options?.redirectTo ?? null }),
  closeModal: () => set({ isOpen: false, redirectTo: null }),
  setView: (view) => set({ view })
}))
