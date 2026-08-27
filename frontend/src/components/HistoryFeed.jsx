/** The activity feed, shared by the dashboard and the full history screen. */

import { humanDate } from '../lib/format';
import { EmptyState } from './ui';

const ICONS = {
  finance: '₸',
  body: '⚖️',
  jobs: '💼',
  habits: '✅',
};

export function HistoryFeed({ items, onSelect, empty = 'Пока ничего не записано.' }) {
  if (!items?.length) return <EmptyState title={empty} />;

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl2 bg-surface">
      {items.map((item) => (
        <li key={`${item.type}-${item.kind}-${item.id}`}>
          <button
            type="button"
            onClick={onSelect ? () => onSelect(item) : undefined}
            disabled={!onSelect}
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-opacity active:opacity-70 disabled:active:opacity-100"
          >
            <span aria-hidden="true" className="w-5 shrink-0 text-center text-base">
              {ICONS[item.type] ?? '•'}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-2">
                <span className="truncate text-[15px] text-text">{item.title}</span>
                <span className="shrink-0 text-[11px] text-hint">{item.kind}</span>
              </span>
              {item.value ? (
                <span className="mt-0.5 block truncate text-xs text-hint">{item.value}</span>
              ) : null}
            </span>
            {item.date ? (
              <span className="shrink-0 text-xs text-hint">{humanDate(item.date)}</span>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}
