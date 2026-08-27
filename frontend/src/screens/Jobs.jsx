import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { humanDate } from '../lib/format';
import { confirmAction } from '../lib/telegram';
import { Screen } from '../components/Screen';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Select,
  Skeleton,
  TextInput,
} from '../components/ui';
import { useToast } from '../components/Toast';

const STATUSES = ['Отклик', 'Собес', 'Оффер', 'Отказ'];
const STATUS_OPTIONS = STATUSES.map((value) => ({ value, label: value }));

export function Jobs() {
  const navigate = useNavigate();
  const load = useCallback(() => api.jobs(), []);
  const { data, loading, error, reload } = useAsync(load);

  return (
    <Screen
      title="Отклики"
      subtitle={data ? `${data.length} всего` : undefined}
      action={
        <Link
          to="/jobs/new"
          className="rounded-full bg-accent px-3.5 py-2 text-sm font-medium text-accent-text"
        >
          + Новый
        </Link>
      }
    >
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-[4.5rem]" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : data.length === 0 ? (
        <EmptyState
          title="Ещё нет откликов."
          action={<Button onClick={() => navigate('/jobs/new')}>Добавить первый</Button>}
        />
      ) : (
        <ul className="space-y-2">
          {data.map((job) => (
            <li key={job.id}>
              <Card onClick={() => navigate(`/jobs/${job.id}`)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium text-text">{job.company}</p>
                    <p className="mt-0.5 truncate text-sm text-hint">{job.role ?? '—'}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <Badge>{job.status ?? '—'}</Badge>
                    {job.applied_on ? (
                      <span className="text-[11px] text-hint">{humanDate(job.applied_on)}</span>
                    ) : null}
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </Screen>
  );
}

export function JobForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const isNew = id === undefined;

  const load = useCallback(async () => {
    if (isNew) return null;
    const jobs = await api.jobs();
    const job = jobs.find((entry) => String(entry.id) === id);
    if (!job) throw new Error('Отклик не найден.');
    return job;
  }, [id, isNew]);

  const { data, loading, error } = useAsync(load, [id]);

  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const current =
    form ??
    (isNew
      ? { company: '', role: '', status: 'Отклик', note: '' }
      : data && {
          company: data.company ?? '',
          role: data.role ?? '',
          status: data.status ?? 'Отклик',
          note: data.note ?? '',
        });

  if (!isNew && loading) return <FormSkeleton />;
  if (error) {
    return (
      <Screen title="Отклик">
        <ErrorState message={error} />
      </Screen>
    );
  }
  if (!current) return <FormSkeleton />;

  const set = (key) => (event) =>
    setForm({ ...current, [key]: event.target.value });

  const valid = current.company.trim().length > 0;

  async function submit(event) {
    event.preventDefault();
    if (!valid || saving) return;

    setSaving(true);
    const payload = {
      company: current.company.trim(),
      role: current.role.trim() || null,
      status: current.status,
      note: current.note.trim() || null,
    };

    try {
      if (isNew) {
        await api.createJob(payload);
        toast('Отклик добавлен');
      } else {
        await api.updateJob(id, payload);
        toast('Статус обновлён');
      }
      navigate('/jobs');
    } catch (err) {
      toast(err.message, 'error');
      setSaving(false);
    }
  }

  async function remove() {
    if (!(await confirmAction('Удалить запись?'))) return;
    try {
      await api.deleteJob(id);
      toast('Удалено');
      navigate('/jobs');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <Screen title={isNew ? 'Новый отклик' : current.company || 'Отклик'}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Компания">
          <TextInput
            autoFocus={isNew}
            value={current.company}
            onChange={set('company')}
            maxLength={120}
          />
        </Field>

        <Field label="Роль">
          <TextInput value={current.role} onChange={set('role')} maxLength={120} />
        </Field>

        <Field label="Статус">
          <Select value={current.status} options={STATUS_OPTIONS} onChange={set('status')} />
        </Field>

        <Field label="Заметка">
          <TextInput
            value={current.note}
            onChange={set('note')}
            placeholder="необязательно"
            maxLength={300}
          />
        </Field>

        <Button type="submit" disabled={!valid || saving}>
          {saving ? 'Сохраняю…' : 'Сохранить'}
        </Button>

        {!isNew ? (
          <Button variant="danger" onClick={remove}>
            Удалить отклик
          </Button>
        ) : null}
      </form>
    </Screen>
  );
}

function FormSkeleton() {
  return (
    <div className="mx-auto w-full max-w-md px-4 pt-4">
      <Skeleton className="mb-4 h-9 w-44" />
      <div className="space-y-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-[4.5rem]" />
        ))}
      </div>
    </div>
  );
}
