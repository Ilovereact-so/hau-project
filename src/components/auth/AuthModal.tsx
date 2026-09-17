"use client";

import { useAuthModalStore } from "@/store/authModalStore";
import { AnimatePresence, motion } from "framer-motion";
import SignInForm from "./SignInForm";
import SignUpForm from "./SignUpForm";
import { useEffect } from "react";

export default function AuthModal() {
  const { isOpen, view, closeModal } = useAuthModalStore();

  // Prevent scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 font-poppins"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeModal}
          />
          
          {/* Modal Content */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative z-10 w-full max-w-[405px]"
          >
            {view === "signIn" && <SignInForm isStandalone={false} />}
            {view === "signUp" && <SignUpForm isStandalone={false} />}
            {/* If there's a resetPassword view needed inside modal, we could add it here */}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
