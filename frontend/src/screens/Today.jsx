/**
 * "Сегодня" answers three questions in this order: what should I do today,
 * how am I doing, what changed. The old dashboard answered only the middle
 * one, as a grid of five equally-weighted tiles.
 */

import { useNavigate } from 'react-router-dom';

import { ActivityFeed } from '../components/ActivityFeed';
import { HomeScreenPrompt } from '../components/HomeScreenPrompt';
import { Screen } from '../components/Screen';
import {
  Card,
  Empty,
  ErrorState,
  LinkCard,
  Progress,
  Section,
  Skeleton,
  Stack,
  Stat,
} from '../components/ui';
import { api } from '../lib/api';
import { delta, humanDate, kg, money, plural } from '../lib/format';
import { Icon } from '../lib/icons';
import { useAsync } from '../lib/useAsync';

const WEEKDAYS = [
  'воскресенье', 'понедельник', 'вторник', 'среда',
  'четверг', 'пятница', 'суббота',
];

function todayLabel() {
  const now = new Date();
  const day = now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  return `${day} · ${WEEKDAYS[now.getDay()]}`;
}

export function Today() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useAsync(() => api.dashboard(), []);

  return (
    <Screen title="Сегодня" subtitle={todayLabel()} back={false}>
      {loading ? <Skeleton rows={4} /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {data ? <TodayBody data={data} navigate={navigate} /> : null}
    </Screen>
  );
}

function TodayBody({ data, navigate }) {
  const { habits_today: habits, weight, funnel, week, streak } = data;
  const done = Boolean(habits?.complete);

  return (
    <>
      <CheckinTask done={done} streak={streak} onOpen={() => navigate('/habits')} />
      <HomeScreenPrompt />

      <Section title="Деньги">
        <Stack>
          <WeekCard week={week} onOpen={() => navigate('/money')} />
          <DebtCard
            remaining={data.debt_total}
            initial={data.debt_initial}
            onOpen={() => navigate('/money')}
          />
        </Stack>
      </Section>

      <Section title="Прогресс">
        <div className="grid grid-cols-2 gap-3">
          <Card onClick={() => navigate('/progress')}>
            <Stat
              label="Вес"
              value={weight.current === null ? '—' : kg(weight.current)}
              sub={weightSub(weight)}
              tone={weight.delta !== null && weight.delta < 0 ? 'success' : 'default'}
            />
          </Card>
          <Card onClick={() => navigate('/career')}>
            <Stat label="Карьера" value={careerValue(funnel)} sub={careerSub(funnel)} />
          </Card>
        </div>
      </Section>

      <Section
        title="Последние события"
        action={
          data.recent.length > 3 ? (
            <button
              type="button"
              onClick={() => navigate('/history')}
              className="text-secondary font-medium text-link"
            >
              Вся история
            </button>
          ) : null
        }
      >
        {data.recent.length ? (
          <ActivityFeed items={data.recent.slice(0, 5)} />
        ) : (
          <Empty
            title="Пока ничего не записано"
            body="Добавь первую запись — она появится здесь."
          />
        )}
      </Section>
    </>
  );
}

/**
 * The one thing that changes shape with state. Undone, it is the loudest thing
 * on the screen; done, it shrinks to a quiet confirmation — rather than a
 * permanent "0 дней" tile that never asked for anything.
 */
function CheckinTask({ done, streak, onOpen }) {
  if (done) {
    return (
      <Card className="flex items-center gap-3">
        <span className="text-success">
          <Icon.check size={20} />
        </span>
        <p className="flex-1 text-body text-text">Чек-ин за сегодня заполнен</p>
        {streak > 1 ? (
          <span className="text-secondary tabular-nums text-hint">
            {streak} {plural(streak, ['день', 'дня', 'дней'])} подряд
          </span>
        ) : null}
      </Card>
    );
  }

  return (
    <Card onClick={onOpen} tone="accent">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-micro opacity-80">Главное на сегодня</p>
          <p className="mt-1 text-card font-semibold">Пройти дневной чек-ин</p>
          {streak > 0 ? (
            <p className="mt-1 text-secondary opacity-80">
              Серия: {streak} {plural(streak, ['день', 'дня', 'дней'])} — не прерывай
            </p>
          ) : null}
        </div>
        <span className="shrink-0 rounded-full bg-black/15 px-3.5 py-2 text-secondary font-semibold">
          Отметиться
        </span>
      </div>
    </Card>
  );
}

function WeekCard({ week, onOpen }) {
  const hasData = week.income > 0 || week.mandatory > 0 || week.to_debt > 0;

  if (!hasData) {
    return (
      <Card onClick={onOpen}>
        <p className="text-micro text-hint">Эта неделя</p>
        <p className="mt-1 text-card font-medium text-text">Ещё нет записей</p>
        <p className="mt-1 text-secondary text-hint">
          Добавь доход или траты, чтобы увидеть остаток.
        </p>
      </Card>
    );
  }

  return (
    <LinkCard onClick={onOpen}>
      <Stat
        label="Остаток за неделю"
        value={money(week.remainder)}
        size="lg"
        tone={week.remainder < 0 ? 'danger' : 'default'}
        sub={`Доход ${money(week.income)} · траты ${money(week.mandatory + week.to_debt)}`}
      />
    </LinkCard>
  );
}

/** Remaining, repaid and the share of the way — not a bare "из 1 289 895 ₸". */
function DebtCard({ remaining, initial, onOpen }) {
  if (!initial) {
    return (
      <Empty
        title="Долгов не записано"
        body="Добавь долг, чтобы видеть прогресс выплаты."
      />
    );
  }

  const repaid = Math.max(0, initial - remaining);
  const share = Math.round((repaid / initial) * 100);

  return (
    <LinkCard onClick={onOpen}>
      <Stat label="Долги" value={`${money(remaining)} осталось`} />
      <p className="mt-1 text-secondary text-hint">
        Погашено {money(repaid)} · {share}%
      </p>
      <Progress value={repaid} max={initial} tone="success" />
    </LinkCard>
  );
}

function weightSub(weight) {
  if (weight.current === null) return 'нет записей';
  const change = delta(weight.delta);
  const when = weight.recorded_on ? humanDate(weight.recorded_on) : null;
  return change ? `${change} кг · ${when}` : when;
}

/**
 * A conversion rate over two applications is noise that reads as failure. Show
 * the pipeline instead until the sample is big enough to mean anything.
 */
const CONVERSION_MIN = 10;

function careerValue(funnel) {
  if (!funnel.applications) return '—';
  if (funnel.applications >= CONVERSION_MIN && funnel.conversion !== null) {
    return `${funnel.conversion}%`;
  }
  const active = funnel.applications - funnel.rejections;
  return `${active} ${plural(active, ['активный', 'активных', 'активных'])}`;
}

function careerSub(funnel) {
  if (!funnel.applications) return 'нет откликов';
  if (funnel.applications >= CONVERSION_MIN && funnel.conversion !== null) {
    return `${funnel.offers} из ${funnel.applications} откликов`;
  }
  return `${funnel.interviews} ${plural(funnel.interviews, ['интервью', 'интервью', 'интервью'])}`;
}
