"use client";

import React, { useState, ChangeEvent, FormEvent } from "react";
import { SignUpButton, useSignIn } from "@clerk/clerk-react";
import Image from "next/image";
import { ArrowLeft, ArrowLeftIcon, Eye, EyeOff, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import {motion} from "framer-motion"
// Typ dla błędów z Clerk
interface ClerkError {
  errors?: { longMessage: string }[];
}

// Ikony (możesz zastąpić SVG)
const GoogleIcon: React.FC = () => <Image width={20} height={20} alt="GoogleIcon" src={"/img/Google.svg"}/>;
const FacebookIcon: React.FC = () => <Image width={20} height={20} alt="FacebookIcon" src={"/img/Facebook.svg"}/>;
const AppleIcon: React.FC = () => <Image width={20} height={20} alt="AppleIcon" src={"/img/Apple.svg"}/>;

const CustomSignInForm: React.FC = () => {
  const { isLoaded, signIn, setActive } = useSignIn();
  const [email, setEmail] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isPasswordCellShow, setShowPasswordCell] = useState<boolean>(false);

  // Logowanie przez email
  const handleEmailSignIn = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isLoaded) return;
    setError("");

    try {
      const result = await signIn?.create({ identifier: email, password});
      
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.push("/");
        console.log("✅ Zalogowano pomyślnie!");
      } else {
        console.log("⚠️ Inne wymagane kroki:", result);
      }
    } catch (err) {
      const clerkErr = err as ClerkError;
      setError(
        clerkErr.errors ? clerkErr.errors[0].longMessage : "Błąd logowania"
      );
    }
  };

  // Logowanie OAuth
  const handleOAuthSignIn = async (provider: "oauth_google" | "oauth_facebook" | "oauth_apple") => {
    setError("");
    try {
      await signIn?.authenticateWithRedirect({
        strategy: provider,
        redirectUrl: "/sso-callback", // przekierowanie po zalogowaniu
        redirectUrlComplete: "/"
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
    setShowPasswordCell(e.target.value.length > 4)
  };

  const handleResetPassword = ()=>{
    router.push(`/reset-password?email=${encodeURIComponent(email)}&step=1`);
  }
  const router = useRouter();
  const handleClick = () => {
    if (document.referrer && new URL(document.referrer).origin === window.location.origin) {
      router.back();
    } else {
      router.push("/");
    }
  };

  return (
      <div className="max-w-[405px] w-full bg-[#0E0E0E] shadow-lg rounded-[70px] p-12 relative z-[2]">
        <div onClick={handleClick} ><Undo2 className="text-white mb-3 cursor-pointer"/></div>
        <h1 className="text-[20px] text-left text-white font-poppins">Continue to<br/><span className="font-bold text-[36px] leading-[36px]">StudyLab</span></h1>
        {error && <p className="text-red-500 text-left text-[14px] mt-2">{error}</p>}

        <div className="flex justify-between mt-10">
          <button
            onClick={() => handleOAuthSignIn("oauth_google")}
            className="flex justify-center items-center px-9 py-[11px] bg-[#282828] rounded-full cursor-pointer ease-in-out duration-300 icon"
          >
            <GoogleIcon />
          </button>

          <button
            onClick={() => handleOAuthSignIn("oauth_facebook")}
            className="flex justify-center items-center px-9 py-[11px] bg-[#282828] rounded-full cursor-pointer ease-in-out duration-300 icon"
          >
            <FacebookIcon />
          </button>

          <button
            onClick={() => handleOAuthSignIn("oauth_apple")}
            className="flex justify-center items-center px-9 py-[11px] bg-[#282828] rounded-full cursor-pointer ease-in-out duration-300 icon"
          >
            <AppleIcon />
          </button>
        </div>

        <div className="flex items-center justify-center space-x-4 mt-6 mb-8">
            <hr className="w-2/3"/>
            <span className="text-white text-[16px]">or</span>
            <hr className="w-2/3"/>
        </div>

        <form onSubmit={handleEmailSignIn} className="space-y-3">
          <label>
            <p className="text-[16px] text-white font-poppins mb-3">Email address</p>
          <div className="overflow-hidden">
            <input
              type="email"
              value={email}
              autoComplete="username"
              onChange={handleEmailChange}
              placeholder="Wpisz swój address email"
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
                <button type="button" onClick={()=> setShowPassword((prev) => !prev)} className="absolute top-[50%] translate-y-[-50%] right-5 text-black z-3">
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
            </motion.div>
            </div>
          </label>
          <div id="clerk-captcha" data-cl-theme="dark" data-cl-size="flexible" />
          {error && <h1 onClick={handleResetPassword} className="text-[14px] text-main mt-1 cursor-pointer">Zapomniałeś hasła?</h1>}
          <button
            type="submit"
            className="w-full bg-main text-white py-3 px-4 rounded-full hover:brightness-75 transition text-[16px] font-bold cursor-pointer mt-4"
          >
            Continue
          </button>
        </form>
        
        <hr className="mt-6 bg-gray-300"/>
        <h1 className="text-[14px] text-white text-center mt-4">Nie masz jeszczę konta? <SignUpButton><button className="text-main font-bold cursor-pointer">Zarejestruj się</button></SignUpButton></h1>
      </div>
  );
};

export default CustomSignInForm;
