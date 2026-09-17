"use client";

import { useSignUp } from "@clerk/nextjs";
import { Eye, EyeOff, Undo2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuthModalStore } from "@/store/authModalStore";
import {
  currentPath, redirectFromQuery, rememberPostAuthRedirect, sanitizeRedirect,
} from "@/lib/authRedirect";

const GoogleIcon: React.FC = () => <Image width={20} height={20} alt="GoogleIcon" src={"/img/Google.svg"}/>;
const FacebookIcon: React.FC = () => <Image width={20} height={20} alt="FacebookIcon" src={"/img/Facebook.svg"}/>;
const AppleIcon: React.FC = () => <Image width={20} height={20} alt="AppleIcon" src={"/img/Apple.svg"}/>;

interface SignUpFormProps {
  isStandalone?: boolean;
}

export default function SignUpForm({ isStandalone = false }: SignUpFormProps) {
  const { isLoaded, signUp } = useSignUp();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const { setView, closeModal, redirectTo } = useAuthModalStore();

  // Po rejestracji (weryfikacja e-maila / OAuth) wracamy tam, skąd user przyszedł.
  const resolveTarget = (): string =>
    (isStandalone ? redirectFromQuery() : sanitizeRedirect(redirectTo) ?? currentPath()) ?? "/";
  
  if (!isLoaded) return null;

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);

    try {
      await signUp.create({ emailAddress: email, password: password });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      rememberPostAuthRedirect(resolveTarget());
      
      if (!isStandalone) closeModal();
      router.push("/verify-email");
    } catch (err: any) {
      setError(err.errors?.[0]?.message || "Coś poszło nie tak");
    } finally {
      setPending(false);
    }
  };

  const handleOAuth = (strategy: "oauth_google" | "oauth_facebook" | "oauth_apple") => {
    const target = resolveTarget();
    rememberPostAuthRedirect(target);
    return signUp.authenticateWithRedirect({
      strategy,
      redirectUrl: "/sso-callback",
      redirectUrlComplete: target,
    });
  };

  const handleGoToSignIn = () => {
    if (isStandalone) {
      const target = redirectFromQuery();
      router.push(target ? `/sign-in?redirect_url=${encodeURIComponent(target)}` : "/sign-in");
    } else {
      setView("signIn");
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
      <div onClick={handleClickBack}><Undo2 className="text-white mb-3 cursor-pointer hover:text-main transition-colors"/></div>
      <h1 className="text-[20px] text-left text-white font-poppins">Create your account in<br/><span className="font-bold text-[36px] leading-[36px]">Hau store</span></h1>
      {error && <p className="text-red-500 text-left text-[14px] mt-2">{error}</p>}

      {/* Social logins */}
      <div className="flex justify-between mt-10">
        <button
          onClick={() => handleOAuth("oauth_google")}
          className="flex justify-center items-center px-9 py-[11px] bg-[#282828] rounded-full cursor-pointer hover:bg-white/20 transition-all duration-300 icon"
        >
          <GoogleIcon/>
        </button>
        <button
          onClick={() => handleOAuth("oauth_facebook")}
          className="flex justify-center items-center px-9 py-[11px] bg-[#282828] rounded-full cursor-pointer hover:bg-white/20 transition-all duration-300 icon"
        >
          <FacebookIcon />
        </button>
        <button
          onClick={() => handleOAuth("oauth_apple")}
          className="flex justify-center items-center px-9 py-[11px] bg-[#282828] rounded-full cursor-pointer hover:bg-white/20 transition-all duration-300 icon"
        >
          <AppleIcon />
        </button>
      </div>

      <div className="flex items-center justify-center space-x-4 mt-6 mb-6">
          <hr className="w-2/3 border-white/20"/>
          <span className="text-white text-[16px]">or</span>
          <hr className="w-2/3 border-white/20"/>
      </div>

      {/* Email signup */}
      <form onSubmit={handleEmailSignUp} className="space-y-3">
          <label>
              <p className="text-[16px] text-white font-poppins mb-2">Email address</p>
              <input
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Wpisz swój address email"
                  className="w-full rounded-full bg-[#282828] px-5 py-3 focus:outline-none focus:ring-2 focus:ring-main placeholder:text-[#737373] placeholder:text-[16px] text-white"
              />
          </label>
          <label>
              <p className="text-[16px] text-white font-poppins mb-2 mt-3">Password</p>
              <div className="relative">
                  <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Wpisz hasło"
                  className="w-full rounded-full bg-[#282828] px-5 py-3 focus:outline-none focus:ring-2 focus:ring-main placeholder:text-[#737373] placeholder:text-[16px] text-white mb-2"
                  />
                  <button type="button" onClick={()=> setShowPassword((prev) => !prev)} className="absolute top-[50%] translate-y-[-50%] right-5 text-gray-400 hover:text-white transition-colors z-3">
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
              </div>
          </label>
          <div id="clerk-captcha" data-cl-theme="dark" data-cl-size="flexible" />
        <button
          type="submit"
          disabled={pending}
          className="w-full bg-main text-white py-3 px-4 rounded-full hover:brightness-75 transition text-[16px] font-bold cursor-pointer"
        >
          {pending ? "Rejestracja..." : "Continue"}
        </button>
      </form>
      <hr className="mt-6 border-white/20"/>
      <h1 className="text-[14px] text-white text-center mt-4">
        Masz już konto?{" "}
        <button onClick={handleGoToSignIn} type="button" className="text-main font-bold cursor-pointer hover:underline">
          Zaloguj się
        </button>
      </h1>
    </div>
  );
}
