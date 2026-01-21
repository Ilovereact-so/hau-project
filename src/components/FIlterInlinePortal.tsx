"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"

type PortalProps = {
  anchorRef: React.RefObject<HTMLDivElement | null>;
  open: boolean;
  children: React.ReactNode
}

export function FilterInlinePortal({ anchorRef, open, children }: PortalProps) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  // tworzymy kontener w body
  useEffect(() => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    elRef.current = el;
    return () => {
      document.body.removeChild(el);
    };
  }, []);

  // aktualizacja pozycji
  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      setPos({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    };

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, anchorRef]);

  if (!elRef.current || !pos) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0, ease: "easeInOut" }}
          style={{
            position: "absolute",
            top: pos.top,
            left: pos.left,
            minWidth: pos.width + 40,
            zIndex: 9999,
          }}
          className="relative pointer-events-none"
        >
          <div className="pointer-events-auto">
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    elRef.current
  );
}
