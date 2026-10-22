"use client";

import React, { useState, ChangeEvent, FormEvent } from "react";
import { useSignIn } from "@clerk/clerk-react";
import Image from "next/image";
import { Eye, EyeOff, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuthModalStore } from "@/store/authModalStore";
import {
  currentPath, redirectFromQuery, rememberPostAuthRedirect, sanitizeRedirect,
} from "@/lib/authRedirect";

interface ClerkError {
  errors?: { longMessage: string }[];
}

const GoogleIcon: React.FC = () => <Image width={20} height={20} alt="GoogleIcon" src={"/img/Google.svg"}/>;
const FacebookIcon: React.FC = () => <Image width={20} height={20} alt="FacebookIcon" src={"/img/Facebook.svg"}/>;
const AppleIcon: React.FC = () => <Image width={20} height={20} alt="AppleIcon" src={"/img/Apple.svg"}/>;

interface SignInFormProps {
  isStandalone?: boolean;
}

export default function SignInForm({ isStandalone = false }: SignInFormProps) {
  const { isLoaded, signIn, setActive } = useSignIn();
  const [email, setEmail] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isPasswordCellShow, setShowPasswordCell] = useState<boolean>(false);
  const router = useRouter();
  const { setView, closeModal, redirectTo } = useAuthModalStore();

  // Cel po zalogowaniu:
  //  - strona /sign-in → ?redirect_url (bezpieczny) albo strona główna,
  //  - modal → redirectTo z openModal() albo zostajemy na bieżącej stronie.
  const resolveTarget = (): string | null =>
    isStandalone ? (redirectFromQuery() ?? "/") : sanitizeRedirect(redirectTo);

  const handleEmailSignIn = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isLoaded) return;
    setError("");

    try {
      const result = await signIn?.create({ identifier: email, password});
      
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        const target = resolveTarget();
        if (!isStandalone) closeModal();
        if (target) router.push(target);
        // Komponenty serwerowe w layoucie (navbar) muszą zobaczyć nową sesję.
        router.refresh();
      } else {
        // Clerk wymaga dodatkowego kroku (np. 2FA) — logujemy sam status,
        // bez całej odpowiedzi, żeby nie wypisywać danych sesji w konsoli.
        console.warn("[auth] logowanie wymaga dodatkowego kroku:", result.status);
      }
    } catch (err) {
      const clerkErr = err as ClerkError;
      setError(
        clerkErr.errors ? clerkErr.errors[0].longMessage : "Błąd logowania"
      );
    }
  };

  const handleOAuthSignIn = async (provider: "oauth_google" | "oauth_facebook" | "oauth_apple") => {
    setError("");
    try {
      const target = resolveTarget() ?? currentPath();
      rememberPostAuthRedirect(target);
      await signIn?.authenticateWithRedirect({
        strategy: provider,
        redirectUrl: "/sso-callback",
        redirectUrlComplete: target,
      });
    } catch (err) {
      const clerkErr = err as ClerkError;
      setError(
        clerkErr.errors ? clerkErr.errors[0].longMessage : "Błąd logowania OAuth"
      );
    }
  };

  const handleEmailChange = (e: ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    setShowPasswordCell(e.target.value.length > 4);
  };

  const handleResetPassword = () => {
    if (isStandalone) {
      router.push(`/reset-password?email=${encodeURIComponent(email)}&step=1`);
    } else {
      router.push(`/reset-password?email=${encodeURIComponent(email)}&step=1`);
      // Optional: open reset inside modal if we implement it, but for now redirecting is fine.
      closeModal();
    }
  };

  const handleGoToSignUp = () => {
    if (isStandalone) {
      const target = redirectFromQuery();
      router.push(target ? `/sign-up?redirect_url=${encodeURIComponent(target)}` : "/sign-up");
    } else {
      setView("signUp");
    }
  };

  const handleClickBack = () => {
    if (!isStandalone) {
      closeModal();
    } else {
      if (document.referrer && new URL(document.referrer).origin === window.location.origin) {
        router.back();
      } else {
        router.push("/");
      }
    }
  };

  return (
      <div className="max-w-[405px] w-full bg-[#0E0E0E] shadow-lg rounded-[70px] p-12 relative z-[2]">
        <div onClick={handleClickBack} ><Undo2 className="text-white mb-3 cursor-pointer hover:text-main transition-colors"/></div>
        <h1 className="text-[20px] text-left text-white font-poppins">Kontynuuj w<br/><span className="font-bold text-[36px] leading-[36px]">Hau</span></h1>
        {error && <p className="text-red-500 text-left text-[14px] mt-2">{error}</p>}

        <div className="flex justify-between mt-10">
          <button
            onClick={() => handleOAuthSignIn("oauth_google")}
            className="flex justify-center items-center sm:px-9 px-7 py-[11px] bg-[#282828] rounded-full cursor-pointer hover:bg-white/20 transition-all duration-300 icon"
          >
            <GoogleIcon />
          </button>

          <button
            onClick={() => handleOAuthSignIn("oauth_facebook")}
            className="flex justify-center items-center sm:px-9 px-7 py-[11px] bg-[#282828] rounded-full cursor-pointer hover:bg-white/20 transition-all duration-300 icon"
          >
            <FacebookIcon />
          </button>

          <button
            onClick={() => handleOAuthSignIn("oauth_apple")}
            className="flex justify-center items-center sm:px-9 px-7 py-[11px] bg-[#282828] rounded-full cursor-pointer hover:bg-white/20 transition-all duration-300 icon"
          >
            <AppleIcon />
          </button>
        </div>

        <div className="flex items-center justify-center space-x-4 mt-6 mb-8">
            <hr className="w-2/3 border-white/20"/>
            <span className="text-white text-[16px]">lub</span>
            <hr className="w-2/3 border-white/20"/>
        </div>

        <form onSubmit={handleEmailSignIn} className="space-y-3">
          <label>
            <p className="text-[16px] text-white font-poppins mb-3">Adres Email </p>
          <div className="overflow-hidden">
            <input
              type="email"
              value={email}
              autoComplete="username"
              onChange={handleEmailChange}
              placeholder="Wpisz swój adres e-mail"
              required
              className="w-full rounded-full bg-[#282828] px-5 py-3 focus:outline-none focus:ring-2 focus:ring-main placeholder:text-[#737373] placeholder:text-[16px] text-white ease-in-out duration-300"
            />
          </div>
          </label>
          <label>
            <motion.p animate={isPasswordCellShow ? {opacity:1, display:"block", marginBottom:8,marginTop:12}:{opacity:0,display:"none", marginBottom:0,marginTop:0}} initial={{opacity:0,display:"none", marginBottom:0,marginTop:0}} className="text-[16px] text-white font-poppins">Password</motion.p>
            <div className="flex justify-center items-center w-full">
            <motion.div animate={isPasswordCellShow ? {width:"100%",height:"auto",marginBottom:8}:{width:0, height:0, marginBottom:0}} initial={{width:0, height:0, marginBottom:0}} className="relative overflow-hidden">
                <input
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Wpisz hasło"
                className="w-full rounded-full bg-[#282828] px-5 py-3 focus:outline-none focus:ring-2 focus:ring-main placeholder:text-[#737373] placeholder:text-[16px] text-white ease-in-out duration-300"
                />
                <button type="button" onClick={()=> setShowPassword((prev) => !prev)} className="absolute top-[50%] translate-y-[-50%] right-5 text-gray-400 hover:text-white transition-colors z-3">
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
            </motion.div>
            </div>
          </label>
          <div id="clerk-captcha" data-cl-theme="dark" data-cl-size="flexible" />
          {error && <p onClick={handleResetPassword} className="text-[14px] text-main mt-1 cursor-pointer hover:underline">Zapomniałeś hasła?</p>}
          <button
            type="submit"
            className="w-full bg-[#94cdc3] text-white py-3 px-4 rounded-full hover:brightness-75 transition text-[16px] font-bold cursor-pointer mt-4"
          >
            Kontynuuj
          </button>
        </form>
        
        <hr className="mt-6 border-white/20"/>
        <p className="text-[14px] text-white text-center mt-4">
          Nie masz jeszcze konta?{" "}
          <button onClick={handleGoToSignUp} type="button" className="text-[#94cdc3] font-bold cursor-pointer hover:underline">
            Zarejestruj się
          </button>
        </p>
      </div>
  );
}
