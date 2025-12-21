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
  const spanRef = useRef<HTMLHeadingElement>(null);
  const maxWidthWindow = typeof window !== 'undefined' ? window.innerWidth: 0;
  useEffect(() => {
    if (spanRef.current) {
      const newWidth = Math.min(
        Math.max(spanRef.current.offsetWidth, minWidth), // +10px jako bufor
        maxWidth
      );
      setWidth(newWidth);
    }
  }, [props.value, minWidth, maxWidth]);

  return (
    <div className="inline-flex items-center relative">
      <input
        {...props}
        style={{
          ...style,
          width,
          transition: "width 0.2s ease-in-out",
        }}
        
      />
      {/* Ukryty span do mierzenia szerokości */}
      <div className="absolute invisible whitespace-pre font-poppins text-[clamp(14px,1.2vw,16px)] font-normal tracking-normal overflow-hidden">
        <h1 style={{maxWidth:maxWidth}} ref={spanRef}>{props.value || props.placeholder }</h1>
      </div>
      
    </div>
  );
};

export default AutoResizeInput;
