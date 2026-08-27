/**
 * An activity feed, not a register of rows. Each line says what changed and by
 * how much; entries group under the day they happened.
 *
 * There are no clock times here on purpose — the spreadsheet stores a date per
 * record and no timestamp, so a time would have to be invented.
 */

import { humanDate } from '../lib/format';
import { IconBadge } from '../lib/icons';

const ICONS = {
  finance: { name: 'money', tone: 'money' },
  body: { name: 'weight', tone: 'body' },
  jobs: { name: 'career', tone: 'jobs' },
  habits: { name: 'check', tone: 'habits' },
};

function groupByDay(items) {
  const groups = [];
  for (const item of items) {
    const key = item.date ?? 'unknown';
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(item);
    else groups.push({ key, label: item.date ? humanDate(item.date) : 'Без даты', items: [item] });
  }
  return groups;
}

export function ActivityFeed({ items, onOpen }) {
  return (
    <div className="flex flex-col gap-5">
      {groupByDay(items).map((group) => (
        <div key={group.key}>
          <p className="mb-1.5 px-0.5 text-micro font-medium uppercase tracking-wide text-hint">
            {group.label}
          </p>
          {/* One card per day, rows divided by hairlines — cards mark groups,
              not every individual event. */}
          <div className="overflow-hidden rounded-xl2 bg-surface">
            {group.items.map((item, index) => {
              const icon = ICONS[item.type] ?? { name: 'circle', tone: 'default' };
              const interactive = typeof onOpen === 'function' && item.editable;
              const Row = interactive ? 'button' : 'div';
              return (
                <Row
                  key={`${item.type}-${item.id}`}
                  type={interactive ? 'button' : undefined}
                  onClick={interactive ? () => onOpen(item) : undefined}
                  className={`flex w-full items-center gap-3 px-card py-3 text-left ${
                    index > 0 ? 'border-t border-border' : ''
                  } ${interactive ? 'transition-opacity active:opacity-70' : ''}`}
                >
                  <IconBadge name={icon.name} tone={icon.tone} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body font-medium text-text">{item.title}</p>
                    <p className="truncate text-secondary text-hint">{item.kind}</p>
                  </div>
                  {item.value ? (
                    <span className="shrink-0 text-body tabular-nums text-hint">
                      {item.value}
                    </span>
                  ) : null}
                </Row>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
