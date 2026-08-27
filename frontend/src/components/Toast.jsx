/** Lightweight toast: the short visual confirmation after a save. */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { notifySuccess } from '../lib/telegram';

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);

  const show = useCallback((message, tone = 'success') => {
    setToast({ message, tone, key: Date.now() });
    if (tone === 'success') notifySuccess();
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <div
          role="status"
          className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4"
        >
          <div
            className={`rounded-full px-4 py-2.5 text-sm font-medium shadow-lg ${
              toast.tone === 'error'
                ? 'bg-danger text-white'
                : 'bg-accent text-accent-text'
            }`}
          >
            {toast.tone === 'success' ? '✓ ' : ''}
            {toast.message}
          </div>
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
