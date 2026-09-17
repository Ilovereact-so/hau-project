"use client";

import VerifyEmailInput from "@/components/VerifyEmailInput";
import { useSignUp } from "@clerk/nextjs";
import { Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { consumePostAuthRedirect } from "@/lib/authRedirect";

export default function VerifyEmail() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

    // tu trzymamy tylko info czy przycisk aktywny
  const [disabled, setDisabled] = useState(false);
  const timerRef = useRef<HTMLSpanElement | null>(null);
  const endTimeRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);

  // cleanup przy odmontowaniu — hook musi być wywołany przed warunkowym
  // `return` (Rules of Hooks), inaczej po załadowaniu Clerka React rzuca błąd
  // o zmienionej liczbie hooków.
  useEffect(() => {
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  if (!isLoaded) return null;

  const handleVerify = async (code: string) => {
    try {
      const result = await signUp.attemptEmailAddressVerification({
        code,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        // powrót tam, skąd user zaczął rejestrację (zapisane w SignUpForm)
        router.push(consumePostAuthRedirect("/"));
        router.refresh();
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.message || "Niepoprawny kod");
    }
  };
  const handleClick = () => {
        if (document.referrer && new URL(document.referrer).origin === window.location.origin) {
        router.back();
        } else {
        router.push("/");
        }
    };

 const startCooldown = (duration: number) => {
    setDisabled(true);
    endTimeRef.current = Date.now() + duration * 1000;

    const tick = () => {
      if (!timerRef.current || !endTimeRef.current) return;

      const remaining = Math.max(
        0,
        Math.ceil((endTimeRef.current - Date.now()) / 1000)
      );

      timerRef.current.textContent = `${remaining}s`;

      if (remaining > 0) {
        frameRef.current = requestAnimationFrame(tick); // 👈 kontynuacja pętli
      } else {
        setDisabled(false);
        endTimeRef.current = null;
        if (timerRef.current) timerRef.current.textContent = ""; // wyczyść licznik
      }
    };

    frameRef.current = requestAnimationFrame(tick); // 👈 uruchomienie pętli
  };

  const handleResend = async ()=>{
    if (!signUp) return;

    try {
      await signUp.prepareEmailAddressVerification({
        strategy: "email_code",
      });
      startCooldown(30); // cooldown 30 sekund
    } catch (err) {
      console.error("Resend error:", err);
    }
  };

  return (

    <div className="flex flex-col relative z-[2] max-w-[530px] w-full bg-[#0E0E0E] shadow-lg rounded-[70px] px-10 py-10 font-poppins">
        <div onClick={handleClick} ><Undo2 className="text-white mb-3 cursor-pointer"/></div>
        <p className="text-white text-[18px] leading-[36px] mb-7">Wpisz kod, który wysłaliśmy na Twój adres email.<br/><span className="text-[32px] font-bold text-left text-white">Zweryfikuj email</span></p>
        {error && <p className="text-red-500">{error}</p>}
        <VerifyEmailInput length={6} onComplete={handleVerify} />
        <div className="flex justify-start items-center space-x-4 mt-10">
          <button onClick={handleResend} disabled={disabled} type="button" className={`text-white text-[16px] font-bold px-7 py-4 rounded-full  inline-flex w-fit  ${
            disabled ? "bg-[#494949]":"bg-main cursor-pointer "
          }`}>Wyślij ponownie
          </button>
          {disabled && (
            <span
              ref={timerRef}
              className="text-white text-[16px] min-w-[40px]"
            >
              30s
            </span>
          )}
        </div>
    </div>
  );
}
