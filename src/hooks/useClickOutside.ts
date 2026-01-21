import { useEffect } from "react";

export function useClickOutside<T extends HTMLDivElement | null>(
  ref: React.RefObject<T>,
  handler: () => void
) {
  useEffect(() => {
  const listener = (event: MouseEvent) => {
    if (!ref.current) return;
    if (ref.current.contains(event.target as Node)) return;
    handler();
  };

  document.addEventListener("click", listener);
  return () => {
    document.removeEventListener("click", listener);
  };
}, [ref, handler]);

}
