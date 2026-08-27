/**
 * Every destination behind the add button, exercised through the real router.
 *
 * "/debts/new" reached a screen that reported the debt did not exist: it
 * matches the literal route, where :id is not a parameter, so the code telling
 * "new" apart from an id never ran. Rendering each target through App is the
 * only way that shows up — the screens themselves are fine in isolation.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../App';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    dashboard: vi.fn(),
    debts: vi.fn(),
    cashflow: vi.fn(),
    jobs: vi.fn(),
    body: vi.fn(),
    habitsToday: vi.fn(),
    createDebt: vi.fn(),
  },
  ApiError: class extends Error {},
}));

const DASHBOARD = {
  debt_total: 0, debt_initial: 0,
  weight: { current: null, delta: null, recorded_on: null },
  funnel: { applications: 0, interviews: 0, offers: 0, rejections: 0, conversion: null },
  streak: 0,
  week: { period: 'нед', income: 0, mandatory: 0, to_debt: 0, remainder: 0 },
  habits_today: { id: null, date: '2026-08-27', complete: false },
  recent: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  api.dashboard.mockResolvedValue(DASHBOARD);
  api.debts.mockResolvedValue([]);
  api.cashflow.mockResolvedValue([]);
  api.jobs.mockResolvedValue([]);
  api.body.mockResolvedValue([]);
  api.habitsToday.mockResolvedValue({ id: null, date: '2026-08-27' });
});

async function openAddSheet() {
  render(<App />);
  await screen.findByText('Главное на сегодня');
  await userEvent.click(screen.getByLabelText('Добавить запись'));
  await screen.findByText('Что добавить?');
}

describe('add button', () => {
  it.each([
    ['Долг', 'Новый долг'],
    ['Доход', 'Сумма, ₸'],
    ['Вес', 'Вес, кг'],
    ['Отклик', 'Компания'],
  ])('opens a working form for %s', async (action, heading) => {
    await openAddSheet();
    await userEvent.click(screen.getByRole('button', { name: action }));

    expect(await screen.findByText(heading)).toBeInTheDocument();
    // The symptom of the broken route was this message, not a blank screen.
    expect(screen.queryByText(/больше нет/)).not.toBeInTheDocument();
  });

  it('saves a debt with the fields the API expects', async () => {
    api.createDebt.mockResolvedValue({ ok: true, id: 10 });
    await openAddSheet();
    await userEvent.click(screen.getByRole('button', { name: 'Долг' }));
    await screen.findByText('Новый долг');

    await userEvent.type(screen.getByPlaceholderText('Кредит'), 'ремонт');
    await userEvent.type(screen.getAllByPlaceholderText('0')[0], '250000');
    await userEvent.click(screen.getByRole('button', { name: 'Добавить' }));

    await waitFor(() => expect(api.createDebt).toHaveBeenCalled());
    const sent = api.createDebt.mock.calls[0][0];
    expect(sent.name).toBe('ремонт');
    expect(sent.total).toBe(250000);
    // A new debt starts fully outstanding.
    expect(sent.remaining).toBe(250000);
  });
});
