'use client'
import React, { useState, useRef, useEffect } from "react";

interface AutoResizeInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  minWidth?: number; // minimalna szerokość inputa
  maxWidth?: number; // maksymalna szerokość inputa
}

const AutoResizeInput: React.FC<AutoResizeInputProps> = ({
  minWidth = 50,
  maxWidth = 500,
  style,
  ...props
}) => {
  const [width, setWidth] = useState(minWidth);
  const spanRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (spanRef.current) {
      const newWidth = Math.min(
        Math.max(spanRef.current.offsetWidth + 10, minWidth), // +10px jako bufor
        maxWidth
      );
      setWidth(newWidth);
    }
  }, [props.value, minWidth, maxWidth]);

  return (
    <div className="inline-flex items-center">
      <input
        {...props}
        style={{
          ...style,
          width,
          transition: "width 0.2s ease-in-out",
        }}
        
      />
      {/* Ukryty span do mierzenia szerokości */}
      <span
        ref={spanRef}
        className="absolute invisible whitespace-pre px-2 py-1"
      >
        {props.value || props.placeholder || ""}
      </span>
    </div>
  );
};

export default AutoResizeInput;
