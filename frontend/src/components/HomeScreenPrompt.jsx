/**
 * Offers the home-screen icon, and only when there is something to offer:
 * the client must support it, it must not already be installed, and a refusal
 * is remembered so the row does not keep asking.
 */

import { useEffect, useState } from 'react';

import { addToHomeScreen, homeScreenStatus, onHomeScreenAdded } from '../lib/telegram';
import { Icon } from '../lib/icons';
import { Card } from './ui';

const DISMISSED = 'home-screen-dismissed';

function dismissed() {
  try {
    return window.localStorage.getItem(DISMISSED) === '1';
  } catch {
    return false;
  }
}

export function HomeScreenPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let alive = true;
    if (dismissed()) return undefined;

    homeScreenStatus().then((status) => {
      // 'unsupported' covers the clients that cannot do this at all, iOS among
      // them; 'added' means the icon is already there.
      if (alive) setShow(status === 'missing');
    });

    const off = onHomeScreenAdded(() => setShow(false));
    return () => {
      alive = false;
      off();
    };
  }, []);

  if (!show) return null;

  function hide() {
    try {
      window.localStorage.setItem(DISMISSED, '1');
    } catch {
      /* remembering is a courtesy, not a requirement */
    }
    setShow(false);
  }

  return (
    <Card className="mt-3 flex items-center gap-3">
      <span className="text-hint">
        <Icon.plus size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-body text-text">Иконка на главный экран</p>
        <p className="mt-0.5 text-secondary text-hint">Открывать трекер одним касанием</p>
      </div>
      <button
        type="button"
        onClick={addToHomeScreen}
        className="shrink-0 rounded-full bg-elevated px-3.5 py-2 text-secondary font-semibold text-link"
      >
        Добавить
      </button>
      <button
        type="button"
        onClick={hide}
        aria-label="Скрыть предложение"
        className="shrink-0 text-hint"
      >
        <Icon.close size={16} />
      </button>
    </Card>
  );
}
