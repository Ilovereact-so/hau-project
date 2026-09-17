"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { consumePostAuthRedirect } from "@/lib/authRedirect";

export default function SSOCallback() {
  const { handleRedirectCallback } = useClerk();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const completeSignIn = async () => {
      try {
        const params = Object.fromEntries(searchParams.entries()); 
        // Clerk oczekuje obiektu { ...searchParams }

        await handleRedirectCallback(params); 
        // cel zapisany przed przekierowaniem do dostawcy OAuth
        router.push(consumePostAuthRedirect("/"));
      } catch (err) {
        console.error("Błąd w SSO callback:", err);
        router.push("/sign-in"); // fallback
      }
    };

    completeSignIn();
  }, [handleRedirectCallback, router, searchParams]);

  return <div className="px-20 py-20 rounded-[40px] flex-col space-y-3 bg-[#0E0E0E]">
      <div id="clerk-captcha" data-cl-theme="dark" data-cl-size="flexible" />
      <p className="text-white text-[16px]">Trwa logowanie...</p>
    </div>;
}
