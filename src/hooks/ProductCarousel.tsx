import React, { useRef, useEffect, useState, ReactNode } from "react";
import { motion, useAnimationControls } from "framer-motion";

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
  const [isOverflowing, setIsOverflowing] = useState(false);

  // Sprawdzenie overflow
  useEffect(() => {
    const wrapper = wrapperRef.current;
    const content = contentRef.current;
    if (!wrapper || !content) return;

    const checkOverflow = () => {
      const overflowing = content.scrollWidth > wrapper.clientWidth;
      setIsOverflowing(overflowing);
    };

    checkOverflow();
    window.addEventListener("resize", checkOverflow);
    return () => window.removeEventListener("resize", checkOverflow);
  }, []);

  // Animacja tylko jeśli overflow
  useEffect(() => {
    if (isOverflowing) {
      controls.start({
        x: ["0%", "-50%"],
        transition: {
          x: {
            repeat: Infinity,
            repeatType: "loop",
            ease: "linear",
            duration,
          },
        },
      });
    } else {
      controls.stop();
      controls.set({ x: 0 });
    }
  }, [isOverflowing, controls, duration]);

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
        {isOverflowing && children}
      </motion.div>
    </div>
  );
};
