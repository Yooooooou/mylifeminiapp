/**
 * Four sections and one add button. Four rather than five because Тело and
 * Привычки answer the same question — "am I moving?" — and belong together
 * under Прогресс.
 *
 * The add button is a single entry point: four separate quick actions used a
 * third of the home screen to save one tap.
 */

import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { Icon } from '../lib/icons';
import { haptic } from '../lib/telegram';
import { Sheet } from './ui';

const TABS = [
  { to: '/', icon: 'today', label: 'Сегодня' },
  { to: '/money', icon: 'money', label: 'Деньги' },
  { to: '/career', icon: 'career', label: 'Карьера' },
  { to: '/progress', icon: 'progress', label: 'Прогресс' },
];

const ADD_ACTIONS = [
  { to: '/income', icon: 'money', label: 'Доход', tone: 'text-info' },
  { to: '/weight', icon: 'weight', label: 'Вес', tone: 'text-success' },
  { to: '/jobs/new', icon: 'career', label: 'Отклик', tone: 'text-stage' },
  { to: '/habits', icon: 'check', label: 'Чек-ин', tone: 'text-warning' },
  { to: '/debts/new', icon: 'debt', label: 'Долг', tone: 'text-hint' },
];

export function TabBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [adding, setAdding] = useState(false);

  const go = (to) => {
    haptic();
    setAdding(false);
    navigate(to);
  };

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-md grid-cols-5 items-center px-2">
          {TABS.slice(0, 2).map((tab) => (
            <Tab key={tab.to} tab={tab} active={pathname === tab.to} onClick={go} />
          ))}

          <div className="flex justify-center">
            <button
              type="button"
              aria-label="Добавить запись"
              onClick={() => {
                haptic();
                setAdding(true);
              }}
              className="-mt-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-text shadow-lg transition-transform active:scale-95"
            >
              <Icon.plus size={24} />
            </button>
          </div>

          {TABS.slice(2).map((tab) => (
            <Tab key={tab.to} tab={tab} active={pathname === tab.to} onClick={go} />
          ))}
        </div>
      </nav>

      <Sheet open={adding} onClose={() => setAdding(false)} title="Что добавить?">
        <div className="flex flex-col gap-1">
          {ADD_ACTIONS.map((action) => {
            const Glyph = Icon[action.icon];
            return (
              <button
                key={action.to}
                type="button"
                onClick={() => go(action.to)}
                className="flex min-h-[56px] items-center gap-3.5 rounded-xl2 px-3 text-left transition-colors active:bg-surface"
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl2 bg-surface ${action.tone}`}
                >
                  <Glyph size={20} />
                </span>
                <span className="text-card text-text">{action.label}</span>
              </button>
            );
          })}
        </div>
      </Sheet>
    </>
  );
}

function Tab({ tab, active, onClick }) {
  const Glyph = Icon[tab.icon];
  return (
    <button
      type="button"
      aria-current={active ? 'page' : undefined}
      onClick={() => onClick(tab.to)}
      className={`flex min-h-[56px] flex-col items-center justify-center gap-1 transition-colors ${
        active ? 'text-accent' : 'text-hint'
      }`}
    >
      <Glyph size={21} />
      <span className="text-[0.6875rem] leading-none">{tab.label}</span>
    </button>
  );
}
