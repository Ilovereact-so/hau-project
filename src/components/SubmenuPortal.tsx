"use client";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface SubmenuPortalProps {
  anchorRef: React.RefObject<HTMLLabelElement | null>;
  open: boolean;
  children: React.ReactNode;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  exit: () => void;
}

export default function SubmenuPortal({ anchorRef, open, children, scrollRef: _scrollRef, exit: _exit }: SubmenuPortalProps) {
  const portalRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // tworzymy portal container
  useEffect(() => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    portalRef.current = el;

    return () => {
      document.body.removeChild(el);
    };
  }, []);

  useEffect(() => {
    const updatePosition = () => {
      const anchor = anchorRef.current;
      const container = containerRef.current;

      if (!anchor || !container) return;

      const rect = anchor.getBoundingClientRect();
      //const scrollRect = scrollContainer.getBoundingClientRect();
      container.style.top = `${rect.bottom + window.scrollY}px`;
      container.style.left = `${rect.left + window.scrollX}px`;
      container.style.minWidth = `${rect.width + 40}px`;
      // if( (rect.left < scrollRect.left || rect.right > scrollRect.right) && open){
      //   //exit();
      //    anchor.scrollIntoView({
      //       behavior: "instant",
      //       block: "nearest",
      //       inline: "nearest"
      //   });
      //   console.log("scrolling left", containerRef, scrollRect.left)
      // }
    };

    // Pozycję liczymy zawsze przy zmianie `open` (także na starcie — zamknięty
    // panel nie może wylądować na końcu strony), ale nasłuchy przewijania
    // trzymamy TYLKO dla otwartego panelu. Wcześniej każda kategoria w menu
    // wołała getBoundingClientRect przy każdym przewinięciu czegokolwiek
    // (także w trakcie płynnego przewijania paska kategorii podczas animacji).
    updatePosition();
    if (!open) return;

    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, anchorRef]);

  if (!portalRef.current) return null;

  return createPortal(
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        zIndex: 9999,
      }}
      className="pointer-events-none"
    >
      <div className="pointer-events-auto">{children}</div>
    </div>,
    portalRef.current
  );
}