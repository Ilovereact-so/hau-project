import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/verify-email(.*)',
  '/reset-password(.*)',
  '/sso-callback(.*)',
  '/403',
  '/404',
  '/studio(.*)',
  '/api/sanity/(.*)',
  '/api/webhooks/(.*)',
  // product browsing is public
  '/(products)/(.*)',
  '/subcategory/(.*)',
])

const isAdminRoute = createRouteMatcher(['/admin(.*)'])

export default clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims } = await auth()

  // trigger guest-cart merge on first authenticated request
  const guestId = req.cookies.get('guest_id')?.value
  const merged  = req.cookies.get('cart_merged')?.value
  if (userId && guestId && !merged) {
    const res = NextResponse.next()
    res.cookies.set('needs_cart_merge', '1', {
      httpOnly: true,
      maxAge:   60,
      sameSite: 'lax',
    })
    return res
  }

  if (isPublicRoute(req)) return NextResponse.next()

  // unauthenticated → sign-in with redirect back
  if (!userId) {
    const signInUrl = new URL('/sign-in', req.url)
    signInUrl.searchParams.set('redirect_url', req.url)
    return NextResponse.redirect(signInUrl)
  }

  // admin routes — require admin role
  if (isAdminRoute(req)) {
    const role = (sessionClaims?.metadata as { role?: string })?.role
    if (role !== 'admin') {
      return NextResponse.redirect(new URL('/403', req.url))
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
