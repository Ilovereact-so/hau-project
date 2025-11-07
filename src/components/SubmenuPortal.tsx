"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface SubmenuPortalProps {
  anchorRef: React.RefObject<HTMLDivElement | null>;
  open: boolean;
  children: React.ReactNode;
}

export default function SubmenuPortal({ anchorRef, open, children }: SubmenuPortalProps) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [shouldRender, setShouldRender] = useState<boolean>(open);

  // ⏱️ zapobiega znikaniu portalu zanim skończy się animacja
  useEffect(() => {
    if (open) {
      setShouldRender(true);
    } else {
      const timeout = setTimeout(() => setShouldRender(false), 350); // tyle trwa Twoja animacja
      return () => clearTimeout(timeout);
    }
  }, [open]);

  // tworzymy kontener w body
  useEffect(() => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    elRef.current = el;
    return () => {
      document.body.removeChild(el);
    };
  }, []);

  // aktualizacja pozycji submenu
  useEffect(() => {
    if (!shouldRender) return;

    const updatePosition = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      setPos({
        top: rect.bottom + window.scrollY,
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
  }, [shouldRender, anchorRef]);

  if (!elRef.current || !shouldRender || !pos) return null;

  const style: React.CSSProperties = {
    position: "absolute",
    top: pos.top,
    left: pos.left,
    minWidth: pos.width,
    zIndex: 9999,
  };

  return createPortal(
    <div style={style} className="relative z-[9999] pointer-events-none">
      {/* pointer-events w rodzicu wyłączone — kontrola w childzie */}
      <div className="pointer-events-auto">{children}</div>
    </div>,
    elRef.current
  );
}
