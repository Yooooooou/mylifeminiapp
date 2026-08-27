/** Data loading with the three states every screen has to render. */

import { useCallback, useEffect, useRef, useState } from 'react';

export function useAsync(loader, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const alive = useRef(true);

  const run = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await loader();
      if (alive.current) setState({ data, loading: false, error: null });
    } catch (error) {
      if (alive.current) {
        setState({ data: null, loading: false, error: error.message ?? 'Ошибка' });
      }
    }
    // `loader` is recreated on every render by callers, so the caller-supplied
    // deps decide when a reload happens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    alive.current = true;
    run();
    return () => {
      alive.current = false;
    };
  }, [run]);

  return { ...state, reload: run };
}
