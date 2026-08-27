import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../lib/api';
import { ToastProvider } from '../components/Toast';
import { Dashboard } from '../screens/Dashboard';
import { Habits } from '../screens/Habits';
import { Weight } from '../screens/Weight';

vi.mock('../lib/api', () => ({
  api: {
    dashboard: vi.fn(),
    habitsToday: vi.fn(),
    saveHabits: vi.fn(),
    addWeight: vi.fn(),
  },
  ApiError: class extends Error {},
}));

const DASHBOARD = {
  debt_total: 220000,
  debt_initial: 420000,
  weight: { current: 83.2, delta: -1.3, recorded_on: '2025-09-08' },
  funnel: { applications: 4, interviews: 2, offers: 1, rejections: 1, conversion: 25 },
  streak: 3,
  week: {
    period: '01.09.2025 – 07.09.2025',
    income: 150000,
    mandatory: 60000,
    to_debt: 40000,
    remainder: 50000,
  },
  habits_today: { id: null, date: '2025-09-09' },
  recent: [
    { id: 3, type: 'body', kind: 'Вес', date: '2025-09-08', title: '83,2 кг', value: null },
    { id: 2, type: 'jobs', kind: 'Отклик', date: '2025-09-05', title: 'Kaspi', value: 'Analyst · Отклик' },
  ],
};

/** A metric card, addressed by its label, so feed rows can't be mistaken for it. */
function metricCard(label) {
  return screen.getByText(label).closest('div');
}

function renderAt(path, element) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={path} element={element} />
          <Route path="/" element={<div>дашборд</div>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Dashboard', () => {
  it('shows a skeleton before the data arrives, never a blank screen', () => {
    api.dashboard.mockReturnValue(new Promise(() => {}));
    const { container } = renderAt('/', <Dashboard />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders every headline metric', async () => {
    api.dashboard.mockResolvedValue(DASHBOARD);
    renderAt('/', <Dashboard />);

    await screen.findByText('Долг сейчас');
    expect(metricCard('Долг сейчас')).toHaveTextContent(/220\u00a0?\s?000/);
    expect(within(metricCard('Вес сейчас')).getByText('83,2 кг')).toBeInTheDocument();
    expect(within(metricCard('Отклик → оффер')).getByText('25%')).toBeInTheDocument();
    expect(within(metricCard('Чек-ины подряд')).getByText('3 дня')).toBeInTheDocument();
    expect(metricCard('Остаток за неделю')).toHaveTextContent(/50\u00a0?\s?000/);
  });

  it('flags that today has no check-in yet', async () => {
    api.dashboard.mockResolvedValue(DASHBOARD);
    renderAt('/', <Dashboard />);
    expect(await screen.findByText('сегодня ещё нет')).toBeInTheDocument();
  });

  it('lists the recent changes', async () => {
    api.dashboard.mockResolvedValue(DASHBOARD);
    renderAt('/', <Dashboard />);
    expect(await screen.findByText('Kaspi')).toBeInTheDocument();
  });

  it('offers a retry when loading fails', async () => {
    api.dashboard.mockRejectedValue(new Error('Google Sheets недоступен'));
    renderAt('/', <Dashboard />);

    expect(await screen.findByText('Google Sheets недоступен')).toBeInTheDocument();

    api.dashboard.mockResolvedValue(DASHBOARD);
    await userEvent.click(screen.getByText('Повторить'));
    expect(await screen.findByText('Долг сейчас')).toBeInTheDocument();
  });
});

describe('Weight form', () => {
  it('keeps saving disabled until the weight is in range', async () => {
    renderAt('/weight', <Weight />);
    const save = screen.getByRole('button', { name: 'Сохранить' });
    expect(save).toBeDisabled();

    const input = screen.getByPlaceholderText('0,0');
    await userEvent.type(input, '25');
    expect(save).toBeDisabled();
    expect(screen.getByText(/между 40 и 200/)).toBeInTheDocument();

    await userEvent.clear(input);
    await userEvent.type(input, '83,4');
    expect(save).toBeEnabled();
  });

  it('accepts a comma decimal and sends a number', async () => {
    api.addWeight.mockResolvedValue({ ok: true, id: 5 });
    renderAt('/weight', <Weight />);

    await userEvent.type(screen.getByPlaceholderText('0,0'), '83,4');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(api.addWeight).toHaveBeenCalled());
    expect(api.addWeight.mock.calls[0][0].weight).toBe(83.4);
  });

  it('uses a numeric keypad on the phone', () => {
    renderAt('/weight', <Weight />);
    expect(screen.getByPlaceholderText('0,0')).toHaveAttribute('inputmode', 'decimal');
  });
});

describe('Habits check-in', () => {
  it('opens as an edit when today is already recorded', async () => {
    api.habitsToday.mockResolvedValue({
      id: 7,
      date: '2025-09-09',
      spending_ok: true,
      workout: false,
      work_done: true,
      mood: 4,
    });

    renderAt('/habits', <Habits />);

    expect(await screen.findByText(/уже заполнен/)).toBeInTheDocument();
    const workout = screen.getByText('Тренировка').closest('div');
    expect(within(workout).getByText('Нет')).toHaveAttribute('aria-pressed', 'true');
  });

  it('sends false, not null, when an answer is "нет"', async () => {
    api.habitsToday.mockResolvedValue({ id: null, date: '2025-09-09' });
    api.saveHabits.mockResolvedValue({ ok: true, id: 4 });

    renderAt('/habits', <Habits />);
    await screen.findByText('Тренировка');

    const workout = screen.getByText('Тренировка').closest('div');
    await userEvent.click(within(workout).getByText('Нет'));
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(api.saveHabits).toHaveBeenCalled());
    expect(api.saveHabits.mock.calls[0][0].workout).toBe(false);
  });

  it('lets a mood be picked on the 1-5 scale', async () => {
    api.habitsToday.mockResolvedValue({ id: null, date: '2025-09-09' });
    api.saveHabits.mockResolvedValue({ ok: true, id: 4 });

    renderAt('/habits', <Habits />);
    await screen.findByText('Настроение');

    await userEvent.click(screen.getByLabelText('Настроение: 5'));
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(api.saveHabits).toHaveBeenCalled());
    expect(api.saveHabits.mock.calls[0][0].mood).toBe(5);
  });

  it('shows a toast after saving', async () => {
    api.habitsToday.mockResolvedValue({ id: null, date: '2025-09-09' });
    api.saveHabits.mockResolvedValue({ ok: true, id: 4 });

    renderAt('/habits', <Habits />);
    await screen.findByText('Настроение');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Чек-ин сохранён');
  });
});
