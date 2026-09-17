import { redirect } from 'next/navigation'

// Wishlista mieszka w profilu (/profile/wishlist) — także dla gości.
// Stary adres zostaje jako przekierowanie (linki, zakładki przeglądarki).
export default function WishlistRedirect() {
  redirect('/profile/wishlist')
}