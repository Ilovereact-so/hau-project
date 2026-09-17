import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth, currentUser } from '@clerk/nextjs/server'
import { AdminShell } from '@/components/admin/layout/AdminShell'
import { THEME_COOKIE } from '@/components/admin/layout/navigation'
import { getAdminCounters } from '@/lib/admin/counters'
import './admin-theme.css'

export const dynamic = 'force-dynamic'

// Drugi poziom ochrony (pierwszy: middleware /admin(.*)). Gdyby ktoś w przyszłości
// dodał trasę poza matcher middleware, layout i tak nie wpuści bez roli admina.
export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { userId, sessionClaims } = await auth()
  if (!userId) redirect('/sign-in?redirect_url=/admin')
  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role
  if (role !== 'admin') redirect('/403')

  const [user, counters, cookieStore] = await Promise.all([
    currentUser().catch(() => null),
    getAdminCounters(),
    cookies(),
  ])

  const name =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    user?.username ||
    'Administrator'

  return (
    <AdminShell
      user={{
        name,
        email: user?.primaryEmailAddress?.emailAddress ?? '',
        imageUrl: user?.imageUrl ?? null,
      }}
      counters={counters}
      initialDark={cookieStore.get(THEME_COOKIE)?.value === 'dark'}
    >
      {children}
    </AdminShell>
  )
}
