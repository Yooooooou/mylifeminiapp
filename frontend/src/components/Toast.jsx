/** Lightweight toast: the short visual confirmation after a save. */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { notifySuccess } from '../lib/telegram';

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);

  // `undo` turns a saved record into something reversible, which is why the
  // add flows no longer ask "are you sure?" before writing.
  const show = useCallback((message, tone = 'success', undo = null) => {
    setToast({ message, tone, undo, key: Date.now() });
    if (tone === 'success') notifySuccess();
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), toast.undo ? 5000 : 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <div
          role="status"
          className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-4"
        >
          <div
            className={`rounded-full px-4 py-2.5 text-sm font-medium shadow-lg ${
              toast.tone === 'error'
                ? 'bg-danger text-white'
                : 'bg-accent text-accent-text'
            }`}
          >
            {toast.message}
            {toast.undo ? (
              <button
                type="button"
                onClick={() => {
                  setToast(null);
                  toast.undo();
                }}
                className="ml-3 font-semibold underline underline-offset-2"
              >
                Отменить
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
