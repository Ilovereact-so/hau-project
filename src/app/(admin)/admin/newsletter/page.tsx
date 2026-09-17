import { redirect } from 'next/navigation'

// Ustawienia newslettera są częścią zakładki Marketing.
export default function NewsletterAdminPage() {
  redirect('/admin/marketing')
}
