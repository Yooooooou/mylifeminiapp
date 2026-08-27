/**
 * Карьера as a pipeline: which stage each application sits at, and how long it
 * has been sitting there. The list is ordered by staleness, so the one that
 * needs chasing is on top.
 *
 * "Собес" reads as chat shorthand next to the other stage names, so the label
 * is "Интервью" — the stored value stays "Собес", which is what the
 * spreadsheet's own COUNTIF formulas match on.
 */

import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Screen } from '../components/Screen';
import { Badge, Card, Empty, ErrorState, Section, Skeleton, Stack } from '../components/ui';
import { api } from '../lib/api';
import { humanDate } from '../lib/format';
import { Icon } from '../lib/icons';
import { useAsync } from '../lib/useAsync';

const STAGES = {
  Отклик: { label: 'Отклик', tone: 'info' },
  Собес: { label: 'Интервью', tone: 'stage' },
  Оффер: { label: 'Оффер', tone: 'success' },
  Отказ: { label: 'Отказ', tone: 'danger' },
};

const FILTERS = [
  { key: 'active', label: 'В работе' },
  { key: 'all', label: 'Все' },
  { key: 'Отклик', label: 'Отклик' },
  { key: 'Собес', label: 'Интервью' },
  { key: 'Оффер', label: 'Оффер' },
  { key: 'Отказ', label: 'Отказ' },
];

function daysSince(iso) {
  if (!iso) return null;
  const then = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(then.getTime())) return null;
  return Math.floor((Date.now() - then.getTime()) / 86400000);
}

export function Career() {
  const navigate = useNavigate();
  const load = useCallback(() => api.jobs(), []);
  const { data, loading, error, reload } = useAsync(load);
  const [filter, setFilter] = useState('active');

  const jobs = data ?? [];
  const counts = useMemo(() => {
    const byStage = {};
    for (const job of jobs) byStage[job.status] = (byStage[job.status] ?? 0) + 1;
    return {
      all: jobs.length,
      active: jobs.filter((job) => job.status !== 'Отказ').length,
      ...byStage,
    };
  }, [jobs]);

  const shown = useMemo(() => {
    const filtered =
      filter === 'all'
        ? jobs
        : filter === 'active'
          ? jobs.filter((job) => job.status !== 'Отказ')
          : jobs.filter((job) => job.status === filter);
    // Oldest contact first — that is the one going cold.
    return [...filtered].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  }, [jobs, filter]);

  return (
    <Screen title="Карьера" back={false}>
      {loading ? <Skeleton rows={4} /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}

      {data ? (
        jobs.length === 0 ? (
          <Empty
            title="Начни отслеживать поиск работы"
            body="Добавь первый отклик — увидишь его путь от отклика до оффера."
          />
        ) : (
          <>
            <Summary counts={counts} />

            <div className="-mx-4 mt-5 overflow-x-auto px-4">
              <div className="flex w-max gap-2">
                {FILTERS.filter((item) => item.key === 'all' || item.key === 'active' || counts[item.key])
                  .map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      aria-pressed={filter === item.key}
                      onClick={() => setFilter(item.key)}
                      className={`min-h-[36px] whitespace-nowrap rounded-full px-3.5 text-secondary transition-colors ${
                        filter === item.key
                          ? 'bg-accent text-accent-text'
                          : 'bg-surface text-hint'
                      }`}
                    >
                      {item.label}
                      {counts[item.key] ? (
                        <span className="ml-1.5 tabular-nums opacity-70">{counts[item.key]}</span>
                      ) : null}
                    </button>
                  ))}
              </div>
            </div>

            <Section className="mt-4">
              {shown.length === 0 ? (
                <Empty title="Здесь пусто" body="В этом статусе пока нет откликов." />
              ) : (
                <Stack>
                  {shown.map((job) => (
                    <JobRow key={job.id} job={job} onOpen={() => navigate(`/jobs/${job.id}`)} />
                  ))}
                </Stack>
              )}
            </Section>
          </>
        )
      ) : null}
    </Screen>
  );
}

function Summary({ counts }) {
  return (
    <Card>
      <p className="text-micro text-hint">Активных процессов</p>
      <p className="mt-1 text-hero font-semibold tabular-nums text-text">{counts.active}</p>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 border-t border-border pt-3">
        {Object.entries(STAGES).map(([key, stage]) =>
          counts[key] ? (
            <span key={key} className="flex items-center gap-2">
              <Badge tone={stage.tone}>{stage.label}</Badge>
              <span className="text-secondary tabular-nums text-text">{counts[key]}</span>
            </span>
          ) : null,
        )}
      </div>
    </Card>
  );
}

function JobRow({ job, onOpen }) {
  const stage = STAGES[job.status] ?? { label: job.status, tone: 'default' };
  const age = daysSince(job.date);
  const stale = job.status !== 'Отказ' && job.status !== 'Оффер' && age !== null && age >= 14;

  return (
    <Card onClick={onOpen}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-card font-medium text-text">{job.company}</p>
          {job.role ? (
            <p className="mt-0.5 truncate text-secondary text-hint">{job.role}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <Badge tone={stage.tone}>{stage.label}</Badge>
            <span className="text-micro text-hint">
              {job.date ? `отклик ${humanDate(job.date)}` : 'без даты'}
            </span>
          </div>
          {stale ? (
            <p className="mt-2 text-micro text-warning">
              Без движения {age} {age % 10 === 1 && age % 100 !== 11 ? 'день' : 'дней'} — стоит написать
            </p>
          ) : null}
          {job.note ? (
            <p className="mt-2 truncate text-secondary text-hint">{job.note}</p>
          ) : null}
        </div>
        <Icon.chevron size={18} className="mt-1 text-hint" />
      </div>
    </Card>
  );
}
