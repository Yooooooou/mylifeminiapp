/** Page chrome: a title row, the native Back button, and consistent padding. */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { bindBackButton } from '../lib/telegram';

export function Screen({ title, subtitle, back = true, children, action }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!back) return undefined;
    return bindBackButton(() => navigate('/'));
  }, [back, navigate]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-24 pt-4">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-text">{title}</h1>
          {subtitle ? <p className="mt-0.5 text-sm text-hint">{subtitle}</p> : null}
        </div>
        {action}
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
