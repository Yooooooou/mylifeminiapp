/** Presentational building blocks. Cards group meaning, not every element. */

import { useEffect } from 'react';
import { haptic } from '../lib/telegram';
import { Icon } from '../lib/icons';

/* ------------------------------------------------------------- surfaces */

/**
 * `tone` rather than a background class in `className`: two Tailwind background
 * utilities have equal specificity, so which one wins depends on their order in
 * the generated stylesheet, not on the order they are written here. Picking the
 * background in one place removes that coin flip.
 */
export function Card({ children, className = '', onClick, as = 'div', tone = 'surface' }) {
  const interactive = typeof onClick === 'function';
  const Tag = interactive ? 'button' : as;
  const tones = {
    surface: 'bg-surface',
    accent: 'bg-accent text-accent-text',
  };
  return (
    <Tag
      type={interactive ? 'button' : undefined}
      onClick={
        interactive
          ? () => {
              haptic();
              onClick();
            }
          : undefined
      }
      className={`w-full rounded-xl2 p-card text-left ${tones[tone] ?? tones.surface} ${
        interactive
          ? 'transition-opacity active:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
          : ''
      } ${className}`}
    >
      {children}
    </Tag>
  );
}

/** A whole-card tap target with the affordance on the right. */
export function LinkCard({ children, onClick, className = '' }) {
  return (
    <Card onClick={onClick} className={className}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">{children}</div>
        <Icon.chevron size={18} className="text-hint" />
      </div>
    </Card>
  );
}

export function Section({ title, action, children, className = '' }) {
  return (
    <section className={`mt-section first:mt-0 ${className}`}>
      {title ? (
        // Not wrapped in a card: a heading is not an object, and nesting it in
        // one produced the card-inside-card noise the layout had before.
        <div className="mb-2.5 flex items-baseline justify-between gap-3 px-0.5">
          <h2 className="text-section font-semibold text-text">{title}</h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Stack({ children, className = '' }) {
  return <div className={`flex flex-col gap-3 ${className}`}>{children}</div>;
}

/* ---------------------------------------------------------------- data */

/**
 * One figure with its context. The number dominates; the label is small and
 * quiet, because a person scanning this screen is looking for the number.
 */
export function Stat({ label, value, sub, tone = 'default', size = 'md' }) {
  const tones = {
    default: 'text-text',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
  };
  const sizes = { md: 'text-section', lg: 'text-hero' };
  return (
    <div>
      <p className="text-micro text-hint">{label}</p>
      <p className={`mt-1 font-semibold tabular-nums ${sizes[size]} ${tones[tone]}`}>
        {value}
      </p>
      {sub ? <p className="mt-1 text-secondary text-hint">{sub}</p> : null}
    </div>
  );
}

/** A labelled progress bar. The label is mandatory: a bare bar is ambiguous. */
export function Progress({ value, max, tone = 'accent' }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const tones = {
    accent: 'bg-accent',
    success: 'bg-success',
    warning: 'bg-warning',
  };
  return (
    <div
      className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-elevated"
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-500 ${tones[tone]}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function Badge({ children, tone = 'default' }) {
  const tones = {
    default: 'text-hint',
    info: 'text-info',
    stage: 'text-stage',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-micro font-medium ${
        tones[tone] ?? tones.default
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

/* ------------------------------------------------------------- controls */

export function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  disabled,
  className = '',
}) {
  const styles = {
    primary: 'bg-accent text-accent-text',
    secondary: 'bg-surface text-text',
    quiet: 'bg-transparent text-link',
    danger: 'bg-transparent text-danger',
  }[variant];

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={
        onClick
          ? (event) => {
              haptic();
              onClick(event);
            }
          : undefined
      }
      className={`min-h-[48px] w-full rounded-xl2 px-4 text-card font-semibold transition-opacity active:opacity-70 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="text-secondary text-hint">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint ? <p className="mt-1 text-micro text-hint">{hint}</p> : null}
    </label>
  );
}

export function Input(props) {
  return (
    <input
      {...props}
      className="min-h-[48px] w-full rounded-xl2 bg-surface px-4 text-card text-text outline-none placeholder:text-hint focus:ring-2 focus:ring-accent"
    />
  );
}

export function Select({ options, children, ...props }) {
  return (
    <select
      {...props}
      className="min-h-[48px] w-full rounded-xl2 bg-surface px-4 text-card text-text outline-none focus:ring-2 focus:ring-accent"
    >
      {options
        ? options.map((option) => {
            const { value, label } =
              typeof option === 'string' ? { value: option, label: option } : option;
            return (
              <option key={value} value={value}>
                {label}
              </option>
            );
          })
        : children}
    </select>
  );
}

/**
 * A segmented Да/Нет, not a switch. The habit answers are tri-state — a day can
 * be unanswered — and a switch has no way to show that: "off" and "not asked
 * yet" would look identical, which is exactly the ambiguity to avoid.
 */
export function Toggle({ label, hint, value, onChange }) {
  const options = [
    { text: 'Да', answer: true },
    { text: 'Нет', answer: false },
  ];
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="min-w-0">
        <span className="block text-card text-text">{label}</span>
        {hint ? <span className="mt-0.5 block text-micro text-hint">{hint}</span> : null}
      </span>
      <div className="flex shrink-0 gap-1 rounded-full bg-elevated p-1">
        {options.map((option) => {
          const active = value === option.answer;
          return (
            <button
              key={option.text}
              type="button"
              aria-pressed={active}
              onClick={() => {
                haptic();
                // Tapping the active answer clears it back to "not answered".
                onChange(active ? null : option.answer);
              }}
              className={`min-h-[36px] min-w-[52px] rounded-full px-3 text-secondary font-medium transition-colors ${
                active
                  ? option.answer
                    ? 'bg-success text-white'
                    : 'bg-surface text-text'
                  : 'text-hint'
              }`}
            >
              {option.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Scale({ label, value, onChange, min = 1, max = 5 }) {
  const options = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <div className="px-4 py-3.5">
      {label ? <p className="mb-2 text-card text-text">{label}</p> : null}
      <div className="flex gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            aria-label={label ? `${label}: ${option}` : String(option)}
            aria-pressed={value === option}
            onClick={() => {
              haptic();
              onChange(option);
            }}
            className={`min-h-[44px] flex-1 rounded-xl2 text-card font-semibold transition-colors ${
              value === option ? 'bg-accent text-accent-text' : 'bg-elevated text-text'
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- states */

/**
 * Empty states say what will appear and how to start it. A screen that just
 * shows nothing leaves the reader unsure whether it is broken.
 */
export function Empty({ title, body, action }) {
  return (
    <Card className="text-center">
      <p className="text-card font-semibold text-text">{title}</p>
      {body ? <p className="mx-auto mt-1.5 max-w-[32ch] text-secondary text-hint">{body}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </Card>
  );
}

export function Skeleton({ rows = 3, className }) {
  if (className) {
    return <div aria-hidden="true" className={`animate-pulse rounded-xl2 bg-surface ${className}`} />;
  }
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-20 animate-pulse rounded-xl2 bg-surface" />
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <Card>
      <p className="text-card text-text">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 text-card font-semibold text-link"
        >
          Повторить
        </button>
      ) : null}
    </Card>
  );
}

/* --------------------------------------------------------- bottom sheet */

export function Sheet({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <button
        type="button"
        aria-label="Закрыть"
        onClick={onClose}
        className="absolute inset-0 bg-black/45"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative mx-auto w-full max-w-md animate-[sheet_180ms_ease-out] rounded-t-[1.5rem] bg-bg px-4 pb-8 pt-3"
      >
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-elevated" />
        {title ? (
          <h2 className="mb-3 px-1 text-section font-semibold text-text">{title}</h2>
        ) : null}
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------ compatibility ---
 * The form screens still address the earlier component names. Keeping the
 * aliases means the redesign lands section by section instead of in one
 * unreviewable rewrite. */

export function TextInput(props) {
  return <Input type="text" {...props} />;
}

export function NumberInput({ decimal = false, ...props }) {
  // A text input with a numeric keypad, not type="number": a comma is how a
  // decimal is typed in Russian, and type="number" silently discards it.
  return (
    <Input
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      autoComplete="off"
      {...props}
    />
  );
}

export function EmptyState({ title, description, action }) {
  return <Empty title={title} body={description} action={action} />;
}

export function Metric({ label, value, hint, tone = 'default' }) {
  return (
    <Card>
      <Stat label={label} value={value} sub={hint} tone={tone} />
    </Card>
  );
}
