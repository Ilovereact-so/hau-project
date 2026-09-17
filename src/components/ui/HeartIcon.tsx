import type { SVGProps } from "react";

export function HeartIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"
      className={className} aria-hidden="true" {...props}>
      <path
        d="M24 40.5 8.7 25.7C3.8 21 4.2 13.1 9.6 8.9c4.6-3.6 11.2-2.8 14.4 1.8C27.2 6.1 33.8 5.3 38.4 8.9c5.4 4.2 5.8 12.1.9 16.8L24 40.5Z"
        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
