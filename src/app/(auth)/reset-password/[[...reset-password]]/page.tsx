"use client";
import VerifyEmailInput from "@/components/VerifyEmailInput";
import { Eye, EyeOff, Undo2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import {animate, motion} from "framer-motion"
import { useSignIn } from "@clerk/clerk-react";

export default function ResetPassword() {
  const {isLoaded, signIn, setActive } = useSignIn();

  const router = useRouter();
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEmail, setEmail] = useState<string>("");
  const [isPassword, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);


    // tu trzymamy tylko info czy przycisk aktywny
  const [disabled, setDisabled] = useState(false);
  const timerRef = useRef<HTMLSpanElement | null>(null);
  const endTimeRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);

  const searchParams = useSearchParams();
  const step = searchParams?.get("step") ?? "1";
  
  // Dodajemy efekt do ładowania emaila z parametrów URL
  useEffect(() => {
    const emailParam = searchParams?.get("email");
    if (emailParam) {
      setEmail(String(emailParam));
    }
  }, [searchParams]);

  // Wszystkie hooki muszą być zadeklarowane przed jakimkolwiek warunkowym zwrotem
  useEffect(() => {
    if (searchParams) {
      const emailParam = searchParams.get("email");
      if (emailParam) {
        setEmail(String(emailParam));
      }
    }
  }, [searchParams]);

  // Cleanup effect dla animation frame
  useEffect(() => {
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  if (!isLoaded) return null;

  const handleVerify = async () => {
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: String(code),
        password:isPassword,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        setError('')
        router.push("/"); // 👈 redirect po udanym logowaniu
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.errors?.[0]?.message || "Niepoprawny kod");
    }
  };

  const create = async(e: FormEvent<HTMLFormElement>)=>{
    e.preventDefault();
    if (!isLoaded) return;
    setError("");

    try{
      await signIn
      .create({strategy: 'reset_password_email_code',identifier: isEmail,})
      .then((_) => {
        handleConfirm()
      })
    } catch (err: any) {
      setError(err.errors?.[0]?.message || "Niepoprawny Email");
      console.log(isEmail)
    }
  }


  const handleClick = () => {
        router.back();
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
    if (!signIn) return;

    try {
      await signIn.create({strategy: 'reset_password_email_code',identifier: isEmail,})
      startCooldown(30); // cooldown 30 sekund
    } catch (err) {
      console.error("Resend error:", err);
    }
  };



  const filter = {
    times: [0,0.5,1],
    values: ["contrast(1) opacity(1)","contrast(0.4) opacity(0.7)", "contrast(1) opacity(1)"]
  }
  
  const handleConfirm = ()=>{
    animate("#RPcontainer", {filter: filter.values},{ duration: 3 ,type:"keyframes", times:filter.times})
    setTimeout(()=>{
      updateEmailInUrl(isEmail);
    },1000)

  }
  
  const updateEmailInUrl = (newEmail: string) => {
    //const params = new URLSearchParams(searchParams.toString());
    // params.set("step", "confirm");
    // params.set("email", newEmail);
    // // replace zamiast push żeby nie dodawać do historii przeglądarki
    // router.push(`?${params.toString()}`);
    router.push(`/reset-password?email=${newEmail}&step=2`);
  };

  return (

    <motion.div id="RPcontainer" className="flex flex-col relative z-[2] max-w-[530px] w-full bg-[#0E0E0E] shadow-lg rounded-[70px] px-10 py-10 font-poppins">
        <div onClick={handleClick} ><Undo2 className="text-white mb-3 cursor-pointer"/></div>
        {step === "2" && (
        <div>
            <p className="text-white text-[18px] leading-[36px] mb-7">Wpisz kod, który wysłaliśmy na Twój adres email i<br/><span className="text-[32px] font-bold text-left text-white">Zmień hasło</span></p>
            {error && <p className="text-red-500 mb-2">{error}</p>}
            <VerifyEmailInput length={6} onComplete={(e)=>setCode(e)} />
            <div className="flex justify-start items-center space-x-4 mt-8">
            <button onClick={handleResend} disabled={disabled} type="button" className={`text-white text-[16px] font-bold px-7 py-3 rounded-full bg-main inline-flex w-fit  ease-in-out duration-300  ${
                disabled ? "brightness-[25%]":"cursor-pointer brightness-100 hover:brightness-75"
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
            <hr className="my-6 bg-gray-300"/>
            <label>
              <p className="text-[16px] text-white font-poppins mb-1">Nowe hasło</p>
              <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={isPassword}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Wpisz hasło"
                className="w-full rounded-full bg-[#282828] px-5 py-3 focus:outline-none focus:ring-2 focus:ring-main placeholder:text-[#737373] placeholder:text-[16px] text-white ease-in-out duration-300"
                />
              <button type="button" onClick={()=> setShowPassword((prev) => !prev)} className="absolute top-[50%] translate-y-[-50%] right-5 text-black z-3 cursor-pointer">
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
              </div>
            </label>
            <div className="w-full flex justify-center items-center mt-6">
              <button onClick={handleVerify} className="px-8 py-3 bg-main rounded-full text-white text-[16px] font-bold cursor-pointer hover:brightness-75 ease-in-out duration-300">Zakończ</button>
            </div>
        </div>
        )}
        { step === "1" && (
        <div >
            <p className="text-white text-[18px] leading-[36px] mb-7">Wybierz konto do którego chcesz zmienić<br/><span className="text-[32px] font-bold text-left text-white">Hasło</span></p>
            {error && <p className="text-red-500">{error}</p>}
            <form onSubmit={create}>
              <label>
                  <p className="text-[16px] text-white font-poppins mb-2">Email address</p>
                  <div className="overflow-hidden">
                      <input
                      type="email"
                      value={isEmail}
                      onChange={(e)=>setEmail(e.target.value)}
                      placeholder="Wpisz swój address email"
                      required
                      className="w-min min-w-[330px] rounded-full bg-[#282828] px-5 py-4 focus:outline-none focus:ring-2 focus:ring-main placeholder:text-[#737373] placeholder:text-[16px] text-white ease-in-out duration-300"
                      />
                  </div>
              </label>
              <div className="flex justify-start items-center space-x-4 mt-6">
                  <button  disabled={disabled} type="submit" className={`text-white text-[16px] font-bold px-10 py-4 rounded-full  inline-flex w-fit bg-main cursor-pointer hover:brightness-75 `}>
                      Potwierdź
                  </button>
              </div>
            </form>
        </div>
        )}
    </motion.div>
  );
}
