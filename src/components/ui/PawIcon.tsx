import type { SVGProps } from "react";

export function PawIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"
      className={className} aria-hidden="true" {...props}>
      <ellipse cx="15.2" cy="16.2" rx="4.2" ry="6"
        transform="rotate(-18 15.2 16.2)" stroke="currentColor" strokeWidth="2.5"/>
      <ellipse cx="24" cy="12.2" rx="4.2" ry="6"
        stroke="currentColor" strokeWidth="2.5"/>
      <ellipse cx="32.8" cy="16.2" rx="4.2" ry="6"
        transform="rotate(18 32.8 16.2)" stroke="currentColor" strokeWidth="2.5"/>
      <path
        d="M11.2 30.2c0-6.1 5.3-10.3 12.8-10.3s12.8 4.2 12.8 10.3c0 4.6-3.3 7.8-7.3 7.8-2.5 0-4-1.8-5.5-1.8s-3 1.8-5.5 1.8c-4 0-7.3-3.2-7.3-7.8Z"
        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
