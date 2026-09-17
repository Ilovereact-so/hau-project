type PawProps = {
  className?: string;
};

export function Paw_Filled({ className }: PawProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <circle cx="7.2" cy="8" r="2.2" fill="currentColor" />
      <circle cx="16.8" cy="8" r="2.2" fill="currentColor" />
      <circle cx="4.8" cy="12.5" r="2.1" fill="currentColor" />
      <circle cx="19.2" cy="12.5" r="2.1" fill="currentColor" />

      <path
        d="M12 11.2C9.35 11.2 6.8 14.15 6.8 16.65C6.8 19.15 9.15 20.4 12 20.4C14.85 20.4 17.2 19.15 17.2 16.65C17.2 14.15 14.65 11.2 12 11.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function Paw_Empty({ className }: PawProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <circle
        cx="7.2"
        cy="8"
        r="2.2"
        stroke="currentColor"
        strokeWidth="1.5"
      />

      <circle
        cx="16.8"
        cy="8"
        r="2.2"
        stroke="currentColor"
        strokeWidth="1.5"
      />

      <circle
        cx="4.8"
        cy="12.5"
        r="2.1"
        stroke="currentColor"
        strokeWidth="1.5"
      />

      <circle
        cx="19.2"
        cy="12.5"
        r="2.1"
        stroke="currentColor"
        strokeWidth="1.5"
      />

      <path
        d="M12 11.2C9.35 11.2 6.8 14.15 6.8 16.65C6.8 19.15 9.15 20.4 12 20.4C14.85 20.4 17.2 19.15 17.2 16.65C17.2 14.15 14.65 11.2 12 11.2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
export function Paw_Half({ className }: PawProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="paw-half-fill" x1="0" y1="0" x2="1" y2="0">
          <stop offset="50%" stopColor="currentColor" />
          <stop offset="50%" stopColor="transparent" />
        </linearGradient>
      </defs>

      <circle
        cx="7.2"
        cy="8"
        r="2.2"
        fill="url(#paw-half-fill)"
        stroke="currentColor"
        strokeWidth="1.5"
      />

      <circle
        cx="16.8"
        cy="8"
        r="2.2"
        fill="url(#paw-half-fill)"
        stroke="currentColor"
        strokeWidth="1.5"
      />

      <circle
        cx="4.8"
        cy="12.5"
        r="2.1"
        fill="url(#paw-half-fill)"
        stroke="currentColor"
        strokeWidth="1.5"
      />

      <circle
        cx="19.2"
        cy="12.5"
        r="2.1"
        fill="url(#paw-half-fill)"
        stroke="currentColor"
        strokeWidth="1.5"
      />

      <path
        d="M12 11.2C9.35 11.2 6.8 14.15 6.8 16.65C6.8 19.15 9.15 20.4 12 20.4C14.85 20.4 17.2 19.15 17.2 16.65C17.2 14.15 14.65 11.2 12 11.2Z"
        fill="url(#paw-half-fill)"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}