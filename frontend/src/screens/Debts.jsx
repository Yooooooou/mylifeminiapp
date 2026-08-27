import { useCallback, useState } from 'react';

import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { money, percent } from '../lib/format';
import { confirmAction } from '../lib/telegram';
import { Screen } from '../components/Screen';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  NumberInput,
  Progress,
  Skeleton,
  TextInput,
} from '../components/ui';
import { useToast } from '../components/Toast';

const num = (text) => {
  const parsed = Number(String(text).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

export function Debts() {
  const toast = useToast();
  const load = useCallback(() => api.debts(), []);
  const { data, loading, error, reload } = useAsync(load);

  const [editing, setEditing] = useState(null); // debt being edited
  const [creating, setCreating] = useState(false);

  if (loading) {
    return (
      <Screen title="Долги">
        <div className="space-y-2">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen title="Долги">
        <ErrorState message={error} onRetry={reload} />
      </Screen>
    );
  }

  if (creating) {
    return (
      <DebtForm
        onCancel={() => setCreating(false)}
        onSaved={() => {
          setCreating(false);
          reload();
        }}
      />
    );
  }

  if (editing) {
    return (
      <RemainingForm
        debt={editing}
        onCancel={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          reload();
        }}
        onDeleted={() => {
          setEditing(null);
          reload();
        }}
      />
    );
  }

  const total = data.reduce((sum, debt) => sum + (debt.remaining ?? 0), 0);

  return (
    <Screen
      title="Долги"
      subtitle={data.length ? `всего ${money(total)}` : undefined}
      action={
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="rounded-full bg-accent px-3.5 py-2 text-sm font-medium text-accent-text"
        >
          + Новый
        </button>
      }
    >
      {data.length === 0 ? (
        <EmptyState
          title="Долгов нет."
          action={<Button onClick={() => setCreating(true)}>Добавить долг</Button>}
        />
      ) : (
        <ul className="space-y-2">
          {data.map((debt) => {
            const paid =
              debt.total && debt.remaining !== null
                ? Math.max(0, Math.min(1, 1 - debt.remaining / debt.total))
                : 0;
            return (
              <li key={debt.id}>
                <Card onClick={() => setEditing(debt)}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-[15px] font-medium text-text">{debt.name}</p>
                    <p className="shrink-0 text-[15px] font-semibold tabular-nums text-text">
                      {money(debt.remaining)}
                    </p>
                  </div>
                  <div className="mt-2">
                    <Progress value={paid} />
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-hint">
                    <span>из {money(debt.total)}</span>
                    <span>
                      {debt.rate ? `${percent(debt.rate)} · ` : ''}
                      мин. {money(debt.min_payment)}
                    </span>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </Screen>
  );
}

/** The common case: knock the remaining balance down after a payment. */
function RemainingForm({ debt, onCancel, onSaved, onDeleted }) {
  const toast = useToast();
  const [value, setValue] = useState(String(debt.remaining ?? ''));
  const [saving, setSaving] = useState(false);

  const parsed = num(value);
  const valid = parsed !== null && parsed >= 0;

  async function submit(event) {
    event.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    try {
      await api.updateDebt(debt.id, { remaining: parsed });
      toast('Обновлено');
      onSaved();
    } catch (error) {
      toast(error.message, 'error');
      setSaving(false);
    }
  }

  async function remove() {
    if (!(await confirmAction('Удалить запись?'))) return;
    try {
      await api.deleteDebt(debt.id);
      toast('Удалено');
      onDeleted();
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  return (
    <Screen title={debt.name} subtitle={`изначально ${money(debt.total)}`}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Осталось сейчас, ₸">
          <NumberInput
            autoFocus
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </Field>
        <Button type="submit" disabled={!valid || saving}>
          {saving ? 'Сохраняю…' : 'Сохранить'}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Отмена
        </Button>
        <Button variant="danger" onClick={remove}>
          Удалить долг
        </Button>
      </form>
    </Screen>
  );
}

function DebtForm({ onCancel, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', total: '', rate: '', min_payment: '' });
  const [saving, setSaving] = useState(false);

  const total = num(form.total);
  const valid = form.name.trim().length > 0 && total !== null && total >= 0;
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  async function submit(event) {
    event.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    try {
      await api.createDebt({
        name: form.name.trim(),
        total,
        rate: num(form.rate),
        min_payment: num(form.min_payment),
      });
      toast('Долг добавлен');
      onSaved();
    } catch (error) {
      toast(error.message, 'error');
      setSaving(false);
    }
  }

  return (
    <Screen title="Новый долг">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Название">
          <TextInput autoFocus value={form.name} onChange={set('name')} maxLength={120} />
        </Field>
        <Field label="Сумма, ₸">
          <NumberInput value={form.total} onChange={set('total')} placeholder="0" />
        </Field>
        <Field label="Ставка, %">
          <NumberInput decimal value={form.rate} onChange={set('rate')} placeholder="0" />
        </Field>
        <Field label="Мин. платёж, ₸">
          <NumberInput value={form.min_payment} onChange={set('min_payment')} placeholder="0" />
        </Field>
        <Button type="submit" disabled={!valid || saving}>
          {saving ? 'Сохраняю…' : 'Сохранить'}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Отмена
        </Button>
      </form>
    </Screen>
  );
}
