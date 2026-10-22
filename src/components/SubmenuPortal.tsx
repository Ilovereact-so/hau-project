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

/** Jak długo zamykający się panel podąża za zakładką (dłużej niż animacja zamykania). */
const CLOSE_FOLLOW_MS = 300;

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
    // trzymamy tylko dla otwartego panelu — i jeszcze przez czas animacji
    // zamykania, żeby zwijający się panel nie został w starym miejscu, gdy
    // w tym momencie przewija się pasek kategorii. Wcześniej każda kategoria
    // wołała getBoundingClientRect przy każdym przewinięciu czegokolwiek.
    updatePosition();

    const remove = () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    const timer = open ? null : setTimeout(remove, CLOSE_FOLLOW_MS);

    return () => {
      if (timer) clearTimeout(timer);
      remove();
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
