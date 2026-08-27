/** Small presentational building blocks shared by every screen. */

import { haptic } from '../lib/telegram';

export function Card({ children, className = '', onClick }) {
  const interactive = typeof onClick === 'function';
  const Tag = interactive ? 'button' : 'div';
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
      className={`w-full rounded-xl2 bg-surface p-4 text-left ${
        interactive ? 'active:opacity-70 transition-opacity' : ''
      } ${className}`}
    >
      {children}
    </Tag>
  );
}

export function Metric({ label, value, hint, tone = 'default' }) {
  const toneClass =
    tone === 'good' ? 'text-emerald-500' : tone === 'bad' ? 'text-danger' : 'text-text';
  return (
    <Card>
      <p className="text-xs text-hint">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-hint">{hint}</p> : null}
    </Card>
  );
}

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
      className={`w-full rounded-xl2 px-4 py-3 text-base font-medium transition-opacity active:opacity-70 disabled:opacity-50 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-hint">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-hint">{hint}</span> : null}
    </label>
  );
}

const inputClass =
  'w-full rounded-xl2 border border-border bg-surface px-4 py-3 text-base text-text outline-none placeholder:text-hint focus:border-accent';

export function TextInput(props) {
  return <input {...props} className={inputClass} />;
}

/** Numeric entry that opens the phone's digit keypad. */
export function NumberInput({ decimal = false, ...props }) {
  return (
    <input
      {...props}
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      className={`${inputClass} tabular-nums`}
    />
  );
}

export function Select({ options, ...props }) {
  return (
    <select {...props} className={inputClass}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/** Yes/no answer as two big targets — no free text to mistype on a phone. */
export function Toggle({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-base text-text">{label}</span>
      <div className="flex shrink-0 gap-1.5">
        {[
          { key: true, text: 'Да' },
          { key: false, text: 'Нет' },
        ].map(({ key, text }) => (
          <button
            key={String(key)}
            type="button"
            aria-pressed={value === key}
            onClick={() => {
              haptic();
              onChange(value === key ? null : key);
            }}
            className={`min-w-[3.5rem] rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              value === key
                ? 'bg-accent text-accent-text'
                : 'bg-surface text-hint'
            }`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Scale({ label, value, onChange, max = 5 }) {
  return (
    <div className="py-2.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-base text-text">{label}</span>
        <span className="text-sm text-hint tabular-nums">{value ? `${value}/${max}` : '—'}</span>
      </div>
      <div className="flex gap-1.5">
        {Array.from({ length: max }, (_, index) => index + 1).map((step) => (
          <button
            key={step}
            type="button"
            aria-label={`${label}: ${step}`}
            aria-pressed={value === step}
            onClick={() => {
              haptic();
              onChange(value === step ? null : step);
            }}
            className={`flex-1 rounded-xl2 py-3 text-base font-medium transition-colors ${
              value === step ? 'bg-accent text-accent-text' : 'bg-surface text-hint'
            }`}
          >
            {step}
          </button>
        ))}
      </div>
    </div>
  );
}

const BADGE_TONES = {
  Отклик: 'bg-sky-500/15 text-sky-500',
  Собес: 'bg-amber-500/15 text-amber-500',
  Оффер: 'bg-emerald-500/15 text-emerald-500',
  Отказ: 'bg-zinc-500/15 text-hint',
};

export function Badge({ children }) {
  const tone = BADGE_TONES[children] ?? 'bg-zinc-500/15 text-hint';
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>{children}</span>
  );
}

export function Progress({ value }) {
  const pct = Math.max(0, Math.min(100, Math.round((value ?? 0) * 100)));
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-border"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Placeholder blocks so a load never shows an empty screen. */
export function Skeleton({ className = 'h-20' }) {
  return <div className={`animate-pulse rounded-xl2 bg-surface ${className}`} />;
}

export function EmptyState({ title, action }) {
  return (
    <div className="py-10 text-center">
      <p className="text-sm text-hint">{title}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <Card className="text-center">
      <p className="text-sm text-text">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 text-sm font-medium text-link"
        >
          Повторить
        </button>
      ) : null}
    </Card>
  );
}
