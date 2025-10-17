"use client";

import React, { useRef, useState, useEffect } from "react";

interface VerifyEmailInputProps {
  length?: number;            // domyślnie 6
  onlyDigits?: boolean;       // domyślnie true – akceptuj tylko cyfry
  onComplete: (code: string) => void;
}

export default function VerifyEmailInput({
  length = 6,
  onlyDigits = true,
  onComplete,
}: VerifyEmailInputProps) {
  const [values, setValues] = useState<string[]>(Array(length).fill(""));
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  // Opcjonalnie: fokus na pierwsze pole
  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  const sanitize = (v: string) => {
    const s = v.trim();
    return onlyDigits ? s.replace(/\D/g, "") : s.replace(/[\s]/g, "");
  };

  const moveFocus = (idx: number) => {
    if (idx >= 0 && idx < length) inputsRef.current[idx]?.focus();
  };

  const handleChange = (index: number, raw: string) => {
    const v = sanitize(raw);
    if (!v) {
      // wyczyszczono – tylko ustaw pusty znak
      const next = [...values];
      next[index] = "";
      setValues(next);
      return;
    }

    // jeżeli user wkleił kilka znaków do jednego inputa
    if (v.length > 1) {
      fillFrom(index, v);
      return;
    }

    // normalny 1 znak
    const next = [...values];
    next[index] = v[0];
    setValues(next);

    // auto-przeskok
    if (index < length - 1) moveFocus(index + 1);

    // complete?
    if (next.every(ch => ch !== "")) onComplete(next.join(""));
  };

  // wklejanie: wpisz od aktywnego indeksu po kolei
  const fillFrom = (startIndex: number, payload: string) => {
    const chars = payload.slice(0, length - startIndex).split("");
    const next = [...values];
    for (let i = 0; i < chars.length; i++) {
      next[startIndex + i] = chars[i];
    }
    setValues(next);

    const last = Math.min(startIndex + chars.length - 1, length - 1);
    moveFocus(Math.min(last + 1, length - 1));

    if (next.every(ch => ch !== "")) onComplete(next.join(""));
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault(); // zapobiegaj domyślnemu kasowaniu, robimy własne
      const next = [...values];

      if (next[index]) {
        // jeśli obecne pole ma znak – usuń i zostań
        next[index] = "";
        setValues(next);
        return;
      }

      // jeśli puste – cofnij fokus i usuń poprzednie
      if (index > 0) {
        next[index - 1] = "";
        setValues(next);
        moveFocus(index - 1);
      }
      return;
    }

    if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      moveFocus(index - 1);
    }

    if (e.key === "ArrowRight" && index < length - 1) {
      e.preventDefault();
      moveFocus(index + 1);
    }
  };

  const handlePasteContainer = (index: number) => (e: React.ClipboardEvent<HTMLDivElement>) => {
    const data = sanitize(e.clipboardData.getData("text"));
    if (!data) return;
    e.preventDefault();
    fillFrom(index, data);
  };

  return (
    <div className="flex justify-around w-full">
      {values.map((val, i) => (
        <div
          key={i}
          onPaste={handlePasteContainer(i)}
          className="relative"
        >
          <input
            ref={(el) => { inputsRef.current[i] = el; }} 
            type="text"
            inputMode={onlyDigits ? "numeric" : "text"}
            autoComplete="one-time-code"
            maxLength={1}
            value={val}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onFocus={(e) => e.currentTarget.select()}
            className="w-[60px] h-[72px] text-center text-[18px] rounded-[18px] focus:outline-none focus:ring-2 focus:ring-main bg-[#282828] text-white"
          />
        </div>
      ))}
    </div>
  );
}
