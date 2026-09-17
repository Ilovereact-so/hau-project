import type { SVGProps } from "react";

export function BulbIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"
      className={className} aria-hidden="true" {...props}>
      <path d="M24 6v4M10.9 11.1l2.8 2.8M37.1 11.1l-2.8 2.8M7 24h4M37 24h4"
        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <path
        d="M24 13.5c-6.1 0-10.8 4.8-10.8 10.7 0 3.8 2 6.5 4.6 8.9 1.5 1.4 2.2 3 2.2 5.2h8c0-2.2.7-3.8 2.2-5.2 2.6-2.4 4.6-5.1 4.6-8.9 0-5.9-4.7-10.7-10.8-10.7Z"
        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M20 38.3h8M21 42h6"
        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  );
}
