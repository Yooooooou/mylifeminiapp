/**
 * A debt is opened from Деньги at /debts/:id, and /debts/new adds one.
 *
 * The detail screen leads with a payment, not with the remaining balance:
 * paying is the thing that actually happens, and asking for the new balance
 * made the person do the subtraction the app is already able to do. Setting
 * the balance outright stays available for corrections.
 */

import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { Screen } from '../components/Screen';
import { useToast } from '../components/Toast';
import {
  Button,
  Card,
  ErrorState,
  Field,
  NumberInput,
  Progress,
  Skeleton,
  Stat,
  TextInput,
} from '../components/ui';
import { api } from '../lib/api';
import { money, percent } from '../lib/format';
import { confirmAction } from '../lib/telegram';
import { useAsync } from '../lib/useAsync';

const num = (text) => {
  const parsed = Number(String(text).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

/** Route component for /debts/new. */
export function NewDebt() {
  const navigate = useNavigate();
  return <DebtForm onDone={() => navigate('/money')} />;
}

export function Debts() {
  const { id } = useParams();
  const navigate = useNavigate();
  const load = useCallback(() => api.debts(), []);
  const { data, loading, error, reload } = useAsync(load);

  const debt = useMemo(
    () => (data && id ? data.find((item) => String(item.id) === id) : null),
    [data, id],
  );

  if (loading) {
    return (
      <Screen title="Долг">
        <Skeleton rows={3} />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen title="Долг">
        <ErrorState message={error} onRetry={reload} />
      </Screen>
    );
  }

  if (!debt) {
    return (
      <Screen title="Долг">
        <ErrorState message="Такого долга больше нет." onRetry={() => navigate('/money')} />
      </Screen>
    );
  }

  return <DebtDetail debt={debt} onChanged={reload} onGone={() => navigate('/money')} />;
}

function DebtDetail({ debt, onChanged, onGone }) {
  const toast = useToast();
  const [mode, setMode] = useState('payment'); // 'payment' | 'balance'
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const initial = debt.total ?? 0;
  const remaining = debt.remaining ?? 0;
  const repaid = Math.max(0, initial - remaining);
  const share = initial > 0 ? Math.round((repaid / initial) * 100) : 0;

  const parsed = num(value);
  const payment = mode === 'payment';

  // A payment cannot exceed what is left, and a corrected balance cannot
  // exceed the original amount — both would leave the sheet inconsistent.
  const valid =
    parsed !== null &&
    parsed > 0 &&
    (payment ? parsed <= remaining : parsed <= Math.max(initial, remaining));

  const nextRemaining = payment ? Math.max(0, remaining - (parsed ?? 0)) : (parsed ?? remaining);

  async function submit(event) {
    event.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    try {
      await api.updateDebt(debt.id, { remaining: nextRemaining });
      const previous = remaining;
      toast(
        payment ? `Платёж ${money(parsed)} учтён` : 'Остаток обновлён',
        'success',
        // Undo restores the balance that was there a moment ago.
        () => api.updateDebt(debt.id, { remaining: previous }).then(onChanged).catch(() => {}),
      );
      setValue('');
      onChanged();
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!(await confirmAction('Удалить долг целиком?'))) return;
    try {
      await api.deleteDebt(debt.id);
      toast('Долг удалён');
      onGone();
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  return (
    <Screen title={debt.name}>
      <Card>
        <Stat label="Осталось" value={money(remaining)} size="lg" />
        <p className="mt-1 text-secondary text-hint">
          Погашено {money(repaid)} из {money(initial)} · {share}%
        </p>
        <Progress value={repaid} max={initial} tone="success" />
        {debt.min_payment || debt.rate ? (
          <p className="mt-3 flex flex-wrap gap-x-4 border-t border-border pt-3 text-secondary text-hint">
            {debt.min_payment ? <span>Мин. платёж {money(debt.min_payment)}</span> : null}
            {debt.rate ? <span>Ставка {percent(debt.rate)}</span> : null}
          </p>
        ) : null}
      </Card>

      <form onSubmit={submit} className="mt-5 space-y-4">
        <div className="flex gap-1 rounded-full bg-elevated p-1">
          {[
            ['payment', 'Внести платёж'],
            ['balance', 'Указать остаток'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={mode === key}
              onClick={() => {
                setMode(key);
                setValue('');
              }}
              className={`min-h-[38px] flex-1 rounded-full text-secondary font-medium transition-colors ${
                mode === key ? 'bg-surface text-text' : 'text-hint'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <Field
          label={payment ? 'Сумма платежа, ₸' : 'Осталось сейчас, ₸'}
          hint={
            valid && payment
              ? `После платежа останется ${money(nextRemaining)}`
              : payment
                ? `Можно внести любую сумму до ${money(remaining)}`
                : null
          }
        >
          <NumberInput
            autoFocus
            decimal
            value={value}
            placeholder="0"
            onChange={(event) => setValue(event.target.value)}
          />
        </Field>

        {payment && debt.min_payment ? (
          <div className="flex flex-wrap gap-2">
            {[debt.min_payment, debt.min_payment * 2, remaining]
              .filter((amount, index, all) => amount > 0 && all.indexOf(amount) === index)
              .map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setValue(String(Math.round(amount)))}
                  className="min-h-[38px] rounded-full bg-surface px-3.5 text-secondary text-text"
                >
                  {amount === remaining ? 'Погасить полностью' : money(amount)}
                </button>
              ))}
          </div>
        ) : null}

        <Button type="submit" disabled={!valid || saving}>
          {saving ? 'Сохраняю…' : payment ? 'Внести платёж' : 'Сохранить остаток'}
        </Button>
        <Button variant="danger" onClick={remove}>
          Удалить долг
        </Button>
      </form>
    </Screen>
  );
}

function DebtForm({ onDone }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', total: '', rate: '', min_payment: '' });
  const [saving, setSaving] = useState(false);

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));
  const total = num(form.total);
  const valid = form.name.trim().length > 0 && total !== null && total > 0;

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
        remaining: total,
      });
      toast('Долг добавлен');
      onDone();
    } catch (error) {
      toast(error.message, 'error');
      setSaving(false);
    }
  }

  return (
    <Screen title="Новый долг">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Название">
          <TextInput autoFocus value={form.name} onChange={set('name')} placeholder="Кредит" />
        </Field>
        <Field label="Сумма изначально, ₸">
          <NumberInput value={form.total} onChange={set('total')} placeholder="0" />
        </Field>
        <Field label="Ставка, %" hint="Необязательно">
          <NumberInput decimal value={form.rate} onChange={set('rate')} placeholder="0" />
        </Field>
        <Field label="Минимальный платёж, ₸" hint="Необязательно">
          <NumberInput value={form.min_payment} onChange={set('min_payment')} placeholder="0" />
        </Field>
        <Button type="submit" disabled={!valid || saving}>
          {saving ? 'Сохраняю…' : 'Добавить'}
        </Button>
      </form>
    </Screen>
  );
}
