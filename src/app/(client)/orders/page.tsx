import { redirect } from 'next/navigation'

// Zamówienia mieszkają teraz w profilu (/profile/orders). Stary adres zostaje
// jako przekierowanie — linkują do niego maile, historia przeglądarki i
// wcześniejsze wersje checkoutu.
export default function OrdersRedirect() {
  redirect('/profile/orders')
}
