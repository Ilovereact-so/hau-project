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
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims } = await auth();

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
