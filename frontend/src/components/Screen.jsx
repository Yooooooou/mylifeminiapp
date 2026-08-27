/**
 * Page chrome. Telegram already spends a chunk of vertical space on its own
 * header, so the top padding here is deliberately tight — the content starts
 * almost immediately.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { bindBackButton } from '../lib/telegram';

export function Screen({ title, subtitle, back = true, children, action }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!back) return undefined;
    return bindBackButton(() => navigate(-1));
  }, [back, navigate]);

  return (
    <div
      className={`mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pt-3 ${
        back ? 'pb-10' : 'pb-24'
      }`}
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-title font-semibold text-text">{title}</h1>
          {subtitle ? <p className="mt-0.5 text-secondary text-hint">{subtitle}</p> : null}
        </div>
        {action}
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
