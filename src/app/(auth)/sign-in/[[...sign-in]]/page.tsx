"use client";

import SignInForm from "@/components/auth/SignInForm";

export default function SignInPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#20201F] p-4 font-poppins relative">
      <SignInForm isStandalone={true} />
    </div>
  );
}

