import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { Screen } from '../components/Screen';
import { Button, Card, ErrorState, Scale, Skeleton, Toggle } from '../components/ui';
import { useToast } from '../components/Toast';

export function Habits() {
  const navigate = useNavigate();
  const toast = useToast();

  const load = useCallback(() => api.habitsToday(), []);
  const { data, loading, error, reload } = useAsync(load);

  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  // Today's row may already exist — the screen then opens as an edit of it
  // rather than creating a duplicate.
  useEffect(() => {
    if (!data) return;
    setForm({
      meditation: data.meditation,
      workout: data.workout,
      work_done: data.work_done,
      mood: data.mood,
    });
  }, [data]);

  if (loading || !form) return <HabitsSkeleton />;
  if (error) {
    return (
      <Screen title="Чек-ин">
        <ErrorState message={error} onRetry={reload} />
      </Screen>
    );
  }

  const editing = Boolean(data?.id);
  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));

  async function submit() {
    if (saving) return;
    setSaving(true);
    try {
      await api.saveHabits(form);
      toast(editing ? 'Чек-ин обновлён' : 'Чек-ин сохранён');
      navigate('/');
    } catch (err) {
      toast(err.message, 'error');
      setSaving(false);
    }
  }

  return (
    <Screen
      title="Чек-ин"
      subtitle={editing ? 'Сегодня уже заполнен — можно поправить' : 'Сегодня'}
    >
      <Card className="divide-y divide-border">
        <Toggle
          label="Медитация"
          hint="Сегодня медитировал"
          value={form.meditation}
          onChange={set('meditation')}
        />
        <Toggle
          label="Тренировка"
          hint="Была тренировка"
          value={form.workout}
          onChange={set('workout')}
        />
        <Toggle
          label="Работа сделана"
          hint="Сделал то, что планировал на сегодня по работе"
          value={form.work_done}
          onChange={set('work_done')}
        />
        <Scale label="Настроение" value={form.mood} onChange={set('mood')} />
      </Card>

      <Button className="mt-4" onClick={submit} disabled={saving}>
        {saving ? 'Сохраняю…' : 'Сохранить'}
      </Button>
    </Screen>
  );
}

function HabitsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-md px-4 pt-4">
      <Skeleton className="mb-4 h-9 w-40" />
      <Skeleton className="h-64" />
      <Skeleton className="mt-4 h-12" />
    </div>
  );
}
