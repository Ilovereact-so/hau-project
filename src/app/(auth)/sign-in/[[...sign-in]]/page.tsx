"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import SignInForm from "@/components/auth/SignInForm";
import { ADMIN_IDLE_MINUTES } from "@/lib/adminRequest";

/** Informacja po automatycznym wylogowaniu z panelu (AdminSessionGuard). */
function IdleNotice() {
  const params = useSearchParams();
  if (params.get("reason") !== "idle") return null;
  return (
    <p
      role="status"
      className="absolute top-6 left-1/2 -translate-x-1/2 w-[min(92vw,440px)] m-0 rounded-[14px] bg-white/10 px-4 py-3 text-center text-[13px] leading-[1.5] text-white"
    >
      Wylogowaliśmy Cię po {ADMIN_IDLE_MINUTES} minutach bezczynności w panelu. Zaloguj się ponownie — wrócisz tam, gdzie skończyłeś.
    </p>
  );
}

export default function SignInPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#20201F] p-4 font-poppins relative">
      <Suspense fallback={null}>
        <IdleNotice />
      </Suspense>
      <SignInForm isStandalone={true} />
    </div>
  );
}
