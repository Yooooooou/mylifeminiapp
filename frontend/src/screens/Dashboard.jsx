import { useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { delta, humanDate, kg, money, percent, plural } from '../lib/format';
import { Card, ErrorState, Metric, Skeleton } from '../components/ui';
import { HistoryFeed } from '../components/HistoryFeed';

const QUICK_ACTIONS = [
  { to: '/income', label: '+ Доход', icon: '₸' },
  { to: '/weight', label: '+ Вес', icon: '⚖️' },
  { to: '/habits', label: 'Чек-ин', icon: '✅' },
  { to: '/jobs/new', label: '+ Отклик', icon: '💼' },
];

export function Dashboard() {
  const navigate = useNavigate();
  const load = useCallback(() => api.dashboard(), []);
  const { data, loading, error, reload } = useAsync(load);

  if (loading) return <DashboardSkeleton />;
  if (error) return <div className="p-4 pt-6"><ErrorState message={error} onRetry={reload} /></div>;

  const checkedInToday = Boolean(data.habits_today && data.habits_today.id);

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-10 pt-5">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold text-text">Трекер</h1>
        <p className="mt-0.5 text-sm text-hint">{data.week.period}</p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <Metric
          label="Долг сейчас"
          value={money(data.debt_total)}
          hint={
            data.debt_initial
              ? `из ${money(data.debt_initial)}`
              : undefined
          }
        />
        <Metric
          label="Вес сейчас"
          value={kg(data.weight.current)}
          hint={weightHint(data.weight)}
          tone={data.weight.delta < 0 ? 'good' : data.weight.delta > 0 ? 'bad' : 'default'}
        />
        <Metric
          label="Отклик → оффер"
          value={percent(data.funnel.conversion)}
          hint={`${data.funnel.offers} из ${data.funnel.applications}`}
        />
        <Metric
          label="Чек-ины подряд"
          value={`${data.streak} ${plural(data.streak, ['день', 'дня', 'дней'])}`}
          hint={checkedInToday ? 'сегодня заполнен' : 'сегодня ещё нет'}
          tone={checkedInToday ? 'good' : 'default'}
        />
      </div>

      <Card className="mt-3">
        <p className="text-xs text-hint">Остаток за неделю</p>
        <p
          className={`mt-1 text-2xl font-semibold tabular-nums ${
            data.week.remainder < 0 ? 'text-danger' : 'text-text'
          }`}
        >
          {money(data.week.remainder)}
        </p>
        <div className="mt-3 flex justify-between text-xs text-hint">
          <span>доход {money(data.week.income)}</span>
          <span>траты {money(data.week.mandatory)}</span>
          <span>на долг {money(data.week.to_debt)}</span>
        </div>
      </Card>

      <nav className="mt-4 grid grid-cols-4 gap-2">
        {QUICK_ACTIONS.map((action) => (
          <Link
            key={action.to}
            to={action.to}
            className="flex flex-col items-center gap-1.5 rounded-xl2 bg-surface px-1 py-3 text-center transition-opacity active:opacity-70"
          >
            <span aria-hidden="true" className="text-lg leading-none">{action.icon}</span>
            <span className="text-[11px] leading-tight text-text">{action.label}</span>
          </Link>
        ))}
      </nav>

      <section className="mt-6">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-text">Последние изменения</h2>
          <Link to="/history" className="text-sm text-link">
            Вся история
          </Link>
        </div>
        <HistoryFeed
          items={data.recent}
          onSelect={(item) => navigate(`/history?type=${item.type}`)}
        />
      </section>

      <section className="mt-6 grid grid-cols-2 gap-2">
        <Link
          to="/jobs"
          className="rounded-xl2 bg-surface px-4 py-3 text-sm text-text transition-opacity active:opacity-70"
        >
          Отклики →
        </Link>
        <Link
          to="/debts"
          className="rounded-xl2 bg-surface px-4 py-3 text-sm text-text transition-opacity active:opacity-70"
        >
          Долги →
        </Link>
      </section>
    </div>
  );
}

function weightHint(weight) {
  const change = delta(weight.delta);
  const when = weight.recorded_on ? humanDate(weight.recorded_on) : null;
  if (change && when) return `${change} кг · ${when}`;
  if (when) return when;
  return undefined;
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto w-full max-w-md px-4 pb-10 pt-5">
      <Skeleton className="mb-5 h-9 w-32" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-[5.5rem]" />
        ))}
      </div>
      <Skeleton className="mt-3 h-28" />
      <Skeleton className="mt-4 h-[4.5rem]" />
      <Skeleton className="mt-6 h-52" />
    </div>
  );
}
