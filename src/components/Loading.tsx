"use client";
import { Loader2 } from "lucide-react";
import Image from "next/image";

const Loading = () => {
  return (
    <div className="fixed min-h-screen w-full bg-white left-0 top-0 flex items-center justify-center z-100">
      <div className="flex flex-col justify-center items-center gap-1">
        <Image src="/logo_hau.svg" alt="e-hau" priority width={100} height={100} />
        <div className="flex items-center space-x-2 text-fancy-black absolute right-5 bottom-5">
          <Loader2 className="animate-spin" />
        </div>
      </div>
    </div>
  );
};

export default Loading;