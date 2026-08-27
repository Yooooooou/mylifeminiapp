import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { api } from '../lib/api';
import { todayIso } from '../lib/format';
import { Screen } from '../components/Screen';
import { Button, Field, NumberInput, Select, TextInput } from '../components/ui';
import { useToast } from '../components/Toast';

const SOURCES = [
  { value: 'Nedelka', label: 'Nedelka' },
  { value: 'Прочее', label: 'Прочее' },
];

export function Income() {
  const navigate = useNavigate();
  const toast = useToast();

  const [amount, setAmount] = useState('');
  const [source, setSource] = useState('Nedelka');
  const [date, setDate] = useState(todayIso());
  const [saving, setSaving] = useState(false);

  const parsed = Number(amount.replace(/\s/g, '').replace(',', '.'));
  const valid = Number.isFinite(parsed) && parsed > 0;

  async function submit(event) {
    event.preventDefault();
    if (!valid || saving) return;

    setSaving(true);
    try {
      await api.addIncome({ amount: parsed, source, date });
      toast('Доход записан');
      navigate('/');
    } catch (error) {
      toast(error.message, 'error');
      setSaving(false);
    }
  }

  return (
    <Screen title="Доход" subtitle="Добавится в неделю по дате">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Сумма, ₸">
          <NumberInput
            autoFocus
            value={amount}
            placeholder="0"
            onChange={(event) => setAmount(event.target.value)}
          />
        </Field>

        <Field label="Источник">
          <Select
            value={source}
            options={SOURCES}
            onChange={(event) => setSource(event.target.value)}
          />
        </Field>

        <Field label="Дата">
          <TextInput
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </Field>

        <Button type="submit" disabled={!valid || saving}>
          {saving ? 'Сохраняю…' : 'Сохранить'}
        </Button>
      </form>
    </Screen>
  );
}
