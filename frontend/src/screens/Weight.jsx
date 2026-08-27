import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { api } from '../lib/api';
import { todayIso } from '../lib/format';
import { Screen } from '../components/Screen';
import { Button, Field, NumberInput, TextInput } from '../components/ui';
import { useToast } from '../components/Toast';

const MIN = 40;
const MAX = 200;

export function Weight() {
  const navigate = useNavigate();
  const toast = useToast();

  const [weight, setWeight] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayIso());
  const [saving, setSaving] = useState(false);

  const parsed = Number(weight.replace(',', '.'));
  const filled = weight.trim() !== '';
  const inRange = Number.isFinite(parsed) && parsed >= MIN && parsed <= MAX;

  async function submit(event) {
    event.preventDefault();
    if (!inRange || saving) return;

    setSaving(true);
    try {
      await api.addWeight({ weight: parsed, note: note || null, date });
      toast('Вес записан');
      navigate('/');
    } catch (error) {
      toast(error.message, 'error');
      setSaving(false);
    }
  }

  return (
    <Screen title="Вес">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Вес, кг" hint={`от ${MIN} до ${MAX}`}>
          <NumberInput
            autoFocus
            decimal
            value={weight}
            placeholder="0,0"
            onChange={(event) => setWeight(event.target.value)}
          />
          {filled && !inRange ? (
            <span className="mt-1 block text-xs text-danger">
              Введи вес между {MIN} и {MAX} кг
            </span>
          ) : null}
        </Field>

        <Field label="Заметка">
          <TextInput
            value={note}
            placeholder="необязательно"
            maxLength={300}
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>

        <Field label="Дата">
          <TextInput
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </Field>

        <Button type="submit" disabled={!inRange || saving}>
          {saving ? 'Сохраняю…' : 'Сохранить'}
        </Button>
      </form>
    </Screen>
  );
}
