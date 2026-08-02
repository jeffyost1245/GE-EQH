// Hand-drawn nav glyphs rather than an icon package: five shapes don't
// justify a dependency, and these inherit currentColor so the active tab
// turns brand red without a second asset.
//
// Drawn heavy and simple on purpose — they're read at thumbnail size, in
// sunlight, often by someone wearing gloves and not looking closely.

const base = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.1,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function DashboardIcon() {
  return (
    <svg {...base} aria-hidden>
      <line x1="5" y1="20" x2="5" y2="14" />
      <line x1="12" y1="20" x2="12" y2="9" />
      <line x1="19" y1="20" x2="19" y2="4" />
    </svg>
  );
}

export function LogIcon() {
  return (
    <svg {...base} strokeWidth={2.6} aria-hidden>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export function EntriesIcon() {
  return (
    <svg {...base} aria-hidden>
      <line x1="9" y1="7" x2="20" y2="7" />
      <line x1="9" y1="12" x2="20" y2="12" />
      <line x1="9" y1="17" x2="20" y2="17" />
      <circle cx="4.5" cy="7" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="17" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Excavator: tracks, cab, boom and bucket. */
export function MachinesIcon() {
  return (
    <svg {...base} aria-hidden>
      <rect x="2.5" y="16.5" width="12" height="4" rx="2" />
      <rect x="4" y="10" width="7" height="6" rx="1" />
      <path d="M11 11.5 L16.5 6.5 L20.5 9" />
      <path d="M18.5 12.5 L21.5 10.5 L22 14 L19.5 15 Z" />
    </svg>
  );
}

/** Hard hat. */
export function CrewIcon() {
  return (
    <svg {...base} aria-hidden>
      <path d="M4 16.5a8 8 0 0 1 16 0" />
      <line x1="2.5" y1="16.5" x2="21.5" y2="16.5" />
      <path d="M10 8.9V6.4a2 2 0 0 1 4 0v2.5" />
    </svg>
  );
}
