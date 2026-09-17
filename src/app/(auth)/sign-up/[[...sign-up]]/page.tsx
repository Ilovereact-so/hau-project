"use client";

import SignUpForm from "@/components/auth/SignUpForm";

export default function SignUpPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#20201F] p-4 font-poppins relative">
      <SignUpForm isStandalone={true} />
    </div>
  );
}
