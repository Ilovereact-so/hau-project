import React, { useRef, useEffect, useState, ReactNode } from "react";
import { motion, useAnimationControls } from "framer-motion";
import useMediaQuery from "./useMediaQuery";

interface ProductCarouselProps {
  children: ReactNode;
  duration?: number;
}

export const ProductCarousel: React.FC<ProductCarouselProps> = ({
  children,
  duration = 20,
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const controls = useAnimationControls();
  const mobile = useMediaQuery("(max-width: 768px)")
  // Sprawdzenie overflow


  // Animacja tylko jeśli overflow
  useEffect(() => {
    if (mobile) {
      controls.start({
        x: ["0%", "-50%"],
        transition: {
          x: {
            repeat: Infinity,
            repeatType: "mirror",
            ease: "linear",
            duration,
          },
        },
      });
    } else {
      controls.stop();
      controls.set({ x: 0 });
    }
  }, [controls, duration, mobile]);

  return (
    <div
      ref={wrapperRef}
      className="overflow-hidden relative w-full"
    >
      <motion.div
        ref={contentRef}
        animate={controls}
        className="flex w-full justify-evenly"
        style={{ willChange: "transform" }}
      >
        {children}
        {mobile && children}
      </motion.div>
    </div>
  );
};
