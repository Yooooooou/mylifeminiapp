/**
 * Деньги: this week, then the debts. Every debt figure is named — "осталось",
 * "погашено" — because a bare bar next to two numbers could mean either.
 */

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { Screen } from '../components/Screen';
import {
  Card,
  Empty,
  ErrorState,
  Progress,
  Section,
  Skeleton,
  Stack,
  Stat,
} from '../components/ui';
import { api } from '../lib/api';
import { money, percent } from '../lib/format';
import { Icon } from '../lib/icons';
import { useAsync } from '../lib/useAsync';

export function Money() {
  const navigate = useNavigate();
  const load = useCallback(
    () => Promise.all([api.debts(), api.cashflow()]).then(([debts, weeks]) => ({ debts, weeks })),
    [],
  );
  const { data, loading, error, reload } = useAsync(load);

  return (
    <Screen title="Деньги" back={false}>
      {loading ? <Skeleton rows={4} /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {data ? <MoneyBody data={data} navigate={navigate} /> : null}
    </Screen>
  );
}

function MoneyBody({ data, navigate }) {
  const current = data.weeks.find((week) => week.is_current) ?? null;
  const totals = data.debts.reduce(
    (acc, debt) => ({
      remaining: acc.remaining + (debt.remaining ?? 0),
      initial: acc.initial + (debt.total ?? 0),
      minimum: acc.minimum + (debt.minimum ?? 0),
    }),
    { remaining: 0, initial: 0, minimum: 0 },
  );
  const repaid = Math.max(0, totals.initial - totals.remaining);

  return (
    <>
      <Section title="Эта неделя">
        {current ? (
          <Card>
            <Stat
              label={current.period}
              value={money(current.remainder)}
              size="lg"
              tone={current.remainder < 0 ? 'danger' : 'default'}
              sub="осталось после трат и выплат по долгу"
            />
            <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-3">
              <Line label="Доход" value={current.income_nedelka + current.income_other} />
              <Line label="Траты" value={current.mandatory} />
              <Line label="На долг" value={current.to_debt} />
            </dl>
          </Card>
        ) : (
          <Empty
            title="За эту неделю ещё нет записей"
            body="Добавь доход — строка недели создастся сама."
          />
        )}
      </Section>

      <Section title="Долги">
        {data.debts.length === 0 ? (
          <Empty title="Долгов не записано" body="Добавь долг, чтобы следить за выплатой." />
        ) : (
          <Stack>
            <Card>
              <Stat label="Осталось выплатить" value={money(totals.remaining)} size="lg" />
              <p className="mt-1 text-secondary text-hint">
                Погашено {money(repaid)} из {money(totals.initial)} ·{' '}
                {Math.round((repaid / totals.initial) * 100)}%
              </p>
              <Progress value={repaid} max={totals.initial} tone="success" />
              {totals.minimum > 0 ? (
                <p className="mt-3 border-t border-border pt-3 text-secondary text-hint">
                  Минимальные платежи за месяц:{' '}
                  <span className="font-medium tabular-nums text-text">
                    {money(totals.minimum)}
                  </span>
                </p>
              ) : null}
            </Card>

            {/* Largest balance first: with no due dates in the sheet, size is
                the only ordering the data actually supports. */}
            {[...data.debts]
              .sort((a, b) => (b.remaining ?? 0) - (a.remaining ?? 0))
              .map((debt) => (
                <DebtRow key={debt.id} debt={debt} onOpen={() => navigate(`/debts/${debt.id}`)} />
              ))}
          </Stack>
        )}
      </Section>
    </>
  );
}

function Line({ label, value }) {
  return (
    <div>
      <dt className="text-micro text-hint">{label}</dt>
      <dd className="mt-0.5 text-body font-medium tabular-nums text-text">{money(value)}</dd>
    </div>
  );
}

function DebtRow({ debt, onOpen }) {
  const initial = debt.total ?? 0;
  const remaining = debt.remaining ?? 0;
  const repaid = Math.max(0, initial - remaining);
  const share = initial > 0 ? Math.round((repaid / initial) * 100) : 0;

  return (
    <Card onClick={onOpen}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-card font-medium text-text">{debt.name}</p>
          <p className="mt-1 text-section font-semibold tabular-nums text-text">
            {money(remaining)}{' '}
            <span className="text-secondary font-normal text-hint">осталось</span>
          </p>
          <p className="mt-1 text-secondary text-hint">
            Погашено {money(repaid)} · {share}%
          </p>
        </div>
        <Icon.chevron size={18} className="mt-1 text-hint" />
      </div>

      <Progress value={repaid} max={initial} tone="success" />

      {debt.minimum || debt.rate ? (
        <p className="mt-3 flex flex-wrap gap-x-4 text-secondary text-hint">
          {debt.minimum ? <span>Мин. платёж {money(debt.minimum)}</span> : null}
          {debt.rate ? <span>Ставка {percent(debt.rate)}</span> : null}
        </p>
      ) : null}
    </Card>
  );
}
