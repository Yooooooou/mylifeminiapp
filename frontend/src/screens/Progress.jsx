/**
 * Прогресс merges Тело and Привычки: both answer "am I moving?".
 *
 * The weight number alone says little, so the screen leads with the change over
 * a chosen window and draws the trend. The chart is inline SVG over the real
 * points — no library, and it reads in either theme because every stroke takes
 * currentColor from a themed parent.
 */

import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Screen } from '../components/Screen';
import { Card, Empty, ErrorState, Section, Skeleton, Stack, Stat } from '../components/ui';
import { api } from '../lib/api';
import { humanDate, kg, plural } from '../lib/format';
import { Icon } from '../lib/icons';
import { useAsync } from '../lib/useAsync';

const RANGES = [
  { key: 30, label: '30 дней' },
  { key: 90, label: '3 месяца' },
  { key: 0, label: 'Всё' },
];

export function Progress() {
  const navigate = useNavigate();
  const load = useCallback(
    () =>
      Promise.all([api.body(), api.habitsToday()]).then(([body, habits]) => ({ body, habits })),
    [],
  );
  const { data, loading, error, reload } = useAsync(load);
  const [range, setRange] = useState(30);

  const points = useMemo(() => {
    if (!data) return [];
    const weighed = data.body
      .filter((entry) => entry.weight !== null && entry.date)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (!range) return weighed;
    const cutoff = new Date(Date.now() - range * 86400000).toISOString().slice(0, 10);
    const windowed = weighed.filter((entry) => entry.date >= cutoff);
    // Never show an empty chart just because the window is quiet.
    return windowed.length >= 2 ? windowed : weighed.slice(-2);
  }, [data, range]);

  return (
    <Screen title="Прогресс" back={false}>
      {loading ? <Skeleton rows={4} /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}

      {data ? (
        <>
          <Section title="Вес">
            {points.length === 0 ? (
              <Empty
                title="Ещё нет измерений"
                body="Добавь первое — здесь появится динамика."
              />
            ) : (
              <Card>
                <WeightHeader points={points} range={range} />
                {points.length >= 2 ? <Chart points={points} /> : null}
                <div className="mt-4 flex gap-2 border-t border-border pt-3">
                  {RANGES.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      aria-pressed={range === option.key}
                      onClick={() => setRange(option.key)}
                      className={`min-h-[34px] flex-1 rounded-full text-micro transition-colors ${
                        range === option.key ? 'bg-elevated text-text' : 'text-hint'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </Card>
            )}
          </Section>

          <Section title="Привычки">
            <Stack>
              <HabitsCard habits={data.habits} onOpen={() => navigate('/habits')} />
            </Stack>
          </Section>

          <Section title="Измерения">
            <Stack>
              {[...points].reverse().slice(0, 8).map((entry) => (
                <Card key={entry.id} onClick={() => navigate('/weight')}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-card font-medium tabular-nums text-text">
                      {kg(entry.weight)}
                    </span>
                    <span className="text-secondary text-hint">{humanDate(entry.date)}</span>
                  </div>
                  {entry.note ? (
                    <p className="mt-1 text-secondary text-hint">{entry.note}</p>
                  ) : null}
                </Card>
              ))}
            </Stack>
          </Section>
        </>
      ) : null}
    </Screen>
  );
}

function WeightHeader({ points, range }) {
  const last = points[points.length - 1];
  const first = points[0];
  const change = last.weight - first.weight;
  const windowLabel = range ? RANGES.find((r) => r.key === range).label.toLowerCase() : 'всё время';

  const text =
    Math.abs(change) < 0.05
      ? 'без изменений'
      : `${change < 0 ? '−' : '+'}${Math.abs(change).toFixed(1).replace('.', ',')} кг за ${windowLabel}`;

  return (
    <div className="flex items-start justify-between gap-3">
      <Stat label={`Сейчас · ${humanDate(last.date)}`} value={kg(last.weight)} size="lg" />
      <span
        className={`mt-5 flex items-center gap-1.5 text-secondary font-medium ${
          change < -0.05 ? 'text-success' : change > 0.05 ? 'text-warning' : 'text-hint'
        }`}
      >
        {change < -0.05 ? <Icon.down size={16} /> : change > 0.05 ? <Icon.up size={16} /> : null}
        {text}
      </span>
    </div>
  );
}

function Chart({ points }) {
  const width = 320;
  const height = 96;
  const pad = 6;

  const values = points.map((point) => point.weight);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const coords = points.map((point, index) => ({
    x: pad + (index / (points.length - 1)) * (width - pad * 2),
    y: pad + (1 - (point.weight - min) / span) * (height - pad * 2),
  }));

  const line = coords.map((c, i) => `${i ? 'L' : 'M'}${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
  const area = `${line} L${coords[coords.length - 1].x.toFixed(1)} ${height - pad} L${coords[0].x.toFixed(1)} ${height - pad} Z`;
  const tip = coords[coords.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="mt-4 w-full text-accent"
      role="img"
      aria-label={`Динамика веса, ${points.length} измерений`}
      preserveAspectRatio="none"
    >
      <path d={area} fill="currentColor" opacity="0.12" />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <circle cx={tip.x} cy={tip.y} r="3.5" fill="currentColor" />
    </svg>
  );
}

function HabitsCard({ habits, onOpen }) {
  const fields = [
    ['Медитация', habits.meditation],
    ['Тренировка', habits.workout],
    ['Работа сделана', habits.work_done],
  ];
  const filled = fields.filter(([, value]) => value !== null).length;

  if (filled === 0 && habits.mood === null) {
    return (
      <Empty
        title="Чек-ин за сегодня не заполнен"
        body="Тридцать секунд вечером — и день попадёт в статистику."
        action={
          <button
            type="button"
            onClick={onOpen}
            className="text-card font-semibold text-link"
          >
            Отметиться
          </button>
        }
      />
    );
  }

  return (
    <Card onClick={onOpen}>
      <p className="text-micro text-hint">Чек-ин за сегодня</p>
      <div className="mt-2.5 flex flex-col gap-2">
        {fields.map(([label, value]) => (
          <div key={label} className="flex items-center gap-2.5">
            <span className={value ? 'text-success' : value === false ? 'text-hint' : 'text-hint opacity-50'}>
              {value ? <Icon.check size={18} /> : <Icon.circle size={18} />}
            </span>
            <span className="text-body text-text">{label}</span>
          </div>
        ))}
      </div>
      {habits.mood !== null ? (
        <p className="mt-3 border-t border-border pt-3 text-secondary text-hint">
          Настроение <span className="font-medium text-text">{habits.mood}</span> из 5
        </p>
      ) : null}
    </Card>
  );
}
