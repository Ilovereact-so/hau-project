import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/verify-email(.*)",
  "/reset-password(.*)",
  "/sso-callback(.*)",
  "/403",
  "/404",
  "/api/sanity/import-csv(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims } = await auth();
  
  const guestId = req.cookies.get('guest_id')?.value
  const merged = req.cookies.get('cart_merged')?.value

  // ustaw flagę w cookie — merge obsłuży layout serwerowy
  if (userId && guestId && !merged) {
    const res = NextResponse.next()
    res.cookies.set('needs_cart_merge', '1', {
      httpOnly: true,
      maxAge:   60,  // krótki TTL — tylko na czas renderowania layoutu
      sameSite: 'lax',
    })
    return res
  }
  // 🔹 Zezwól na publiczne ścieżki
  if (isPublicRoute(req)) return NextResponse.next();

  // 🔹 Jeśli user niezalogowany → przekieruj na logowanie
  if (!userId) {
    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set("redirect_url", req.url);
    return NextResponse.redirect(signInUrl);
  }

  // 🔹 Bezpieczny odczyt metadanych użytkownika
  const role = (sessionClaims?.metadata as { role?: string })?.role;
  // 🔹 Jeśli user nie jest adminem → przekieruj na /403
  if (role !== "admin") {
    return NextResponse.redirect(new URL("/403", req.url));
  }

  // ✅ Jeśli admin → przepuść
  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
