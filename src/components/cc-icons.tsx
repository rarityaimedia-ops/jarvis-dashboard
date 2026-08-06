// Minimal inline stroke icons (16px, currentColor) — no icon dependency.
// Geometric HUD language; used by the sidebar nav, topbar, and panels.

type P = { className?: string };
const svg = (children: React.ReactNode) =>
  function Icon({ className }: P) {
    return (
      <svg
        viewBox="0 0 24 24"
        width="1em"
        height="1em"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden
      >
        {children}
      </svg>
    );
  };

export const IconBrain = svg(
  <>
    <circle cx="12" cy="12" r="3" />
    <circle cx="5" cy="7" r="1.4" />
    <circle cx="19" cy="8" r="1.4" />
    <circle cx="7" cy="18" r="1.4" />
    <circle cx="17" cy="17" r="1.4" />
    <path d="M6.2 7.8 9.4 10.5M17.7 8.7 14.6 11M8 16.9 10 13.7M15.7 15.9 13.6 13.4" />
  </>
);
export const IconTrading = svg(
  <>
    <path d="M4 18h16" />
    <path d="M5 15l4-5 3 3 6-8" />
    <path d="M18 5h1.5V6.5" />
  </>
);
export const IconOps = svg(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
  </>
);
// A sieve, not a chart. The quant system's output is REJECTIONS: many candidates in at
// the top, one drop out of the bottom. A rising-line icon would advertise the opposite.
export const IconQuant = svg(
  <>
    <path d="M3.5 4.5h17l-6.5 8v6.5l-4-2.5v-4z" />
    <path d="M12 21.5v.01" />
  </>
);
export const IconMic = svg(
  <>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" />
  </>
);
export const IconSearch = svg(
  <>
    <circle cx="11" cy="11" r="6" />
    <path d="M20 20l-4-4" />
  </>
);
export const IconBell = svg(
  <>
    <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </>
);
export const IconSync = svg(
  <>
    <path d="M4 12a8 8 0 0 1 13.7-5.7L20 8" />
    <path d="M20 4v4h-4" />
    <path d="M20 12a8 8 0 0 1-13.7 5.7L4 16" />
    <path d="M4 20v-4h4" />
  </>
);
export const IconCommand = svg(
  <>
    <path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z" />
  </>
);
export const IconBolt = svg(<path d="M13 3 5 13h6l-1 8 8-10h-6z" />);
export const IconChip = svg(
  <>
    <rect x="7" y="7" width="10" height="10" rx="1.5" />
    <path d="M10 4v3M14 4v3M10 17v3M14 17v3M4 10h3M4 14h3M17 10h3M17 14h3" />
  </>
);
