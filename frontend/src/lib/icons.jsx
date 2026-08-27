/**
 * One icon system, drawn from the Lucide geometry: 24×24 box, 1.75 stroke,
 * currentColor. Emoji were replaced because they render at a different weight
 * and size on every platform and read as content rather than interface.
 */

function Svg({ children, size = 22, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      {children}
    </svg>
  );
}

export const Icon = {
  today: (p) => (
    <Svg {...p}>
      <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
      <path d="M8 2.5v4M16 2.5v4M3 9.5h18" />
      <path d="M9.5 14.5l1.8 1.8 3.4-3.6" />
    </Svg>
  ),
  money: (p) => (
    <Svg {...p}>
      <rect x="2.5" y="6" width="19" height="13" rx="2.5" />
      <path d="M2.5 10.5h19" />
      <circle cx="17" cy="15" r="1.4" />
    </Svg>
  ),
  career: (p) => (
    <Svg {...p}>
      <rect x="2.5" y="7" width="19" height="13" rx="2.5" />
      <path d="M8.5 7V5.5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2V7" />
      <path d="M2.5 12.5h19" />
    </Svg>
  ),
  progress: (p) => (
    <Svg {...p}>
      <path d="M3 19h18" />
      <path d="M6.5 19v-5M12 19V7M17.5 19v-8.5" />
    </Svg>
  ),
  weight: (p) => (
    <Svg {...p}>
      <path d="M12 3.5a2.2 2.2 0 0 1 2.1 1.5H17a3 3 0 0 1 2.95 2.46l1.6 9A3 3 0 0 1 18.6 20H5.4a3 3 0 0 1-2.95-3.54l1.6-9A3 3 0 0 1 7 5h2.9A2.2 2.2 0 0 1 12 3.5Z" />
      <path d="M9 11.5h6" />
    </Svg>
  ),
  check: (p) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.2 12.3l2.5 2.5 5.1-5.4" />
    </Svg>
  ),
  circle: (p) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
    </Svg>
  ),
  plus: (p) => (
    <Svg {...p}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  ),
  chevron: (p) => (
    <Svg {...p}>
      <path d="M9 5.5l6.5 6.5L9 18.5" />
    </Svg>
  ),
  down: (p) => (
    <Svg {...p}>
      <path d="M3.5 7.5l6 6 4-4 6.5 6.5" />
      <path d="M20 12.5V16.5H16" />
    </Svg>
  ),
  up: (p) => (
    <Svg {...p}>
      <path d="M3.5 16.5l6-6 4 4 6.5-6.5" />
      <path d="M20 11.5V7.5H16" />
    </Svg>
  ),
  clock: (p) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.3l3.2 1.9" />
    </Svg>
  ),
  history: (p) => (
    <Svg {...p}>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
      <path d="M3.5 4.5V9H8" />
      <path d="M12 7.5v5l3 1.8" />
    </Svg>
  ),
  close: (p) => (
    <Svg {...p}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  ),
  target: (p) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" />
    </Svg>
  ),
  debt: (p) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M14.6 9.3c-.5-.8-1.5-1.2-2.6-1.2-1.6 0-2.7.8-2.7 2s1.1 1.8 2.7 2 2.9.7 2.9 2-1.2 2.1-2.9 2.1c-1.2 0-2.2-.4-2.7-1.3" />
    </Svg>
  ),
};

/** A soft tinted square behind an icon, used in list rows. */
export function IconBadge({ name, tone = 'default', size = 22 }) {
  const Glyph = Icon[name] ?? Icon.circle;
  const tones = {
    default: 'text-hint',
    money: 'text-info',
    body: 'text-success',
    jobs: 'text-stage',
    habits: 'text-warning',
  };
  return (
    <span
      className={`flex h-9 w-9 items-center justify-center rounded-xl2 bg-elevated ${
        tones[tone] ?? tones.default
      }`}
    >
      <Glyph size={size - 4} />
    </span>
  );
}
