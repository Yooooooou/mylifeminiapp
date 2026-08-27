import { useCallback, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { confirmAction, haptic } from '../lib/telegram';
import { Screen } from '../components/Screen';
import { ErrorState, Skeleton } from '../components/ui';
import { HistoryFeed } from '../components/HistoryFeed';
import { useToast } from '../components/Toast';

const FILTERS = [
  { value: '', label: 'Все' },
  { value: 'finance', label: 'Финансы' },
  { value: 'body', label: 'Тело' },
  { value: 'jobs', label: 'Работа' },
  { value: 'habits', label: 'Привычки' },
];

/** Which records can be opened for editing, and where that lives. */
const EDIT_ROUTES = {
  jobs: (item) => `/jobs/${item.id}`,
  habits: () => '/habits',
};

export function History() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();

  const type = params.get('type') ?? '';
  const load = useCallback(() => api.history(type || undefined, 200), [type]);
  const { data, loading, error, reload } = useAsync(load, [type]);

  const [selected, setSelected] = useState(null);

  async function remove(item) {
    setSelected(null);
    if (!(await confirmAction('Удалить запись?'))) return;
    try {
      await api.remove(item.type, item.id);
      toast('Удалено');
      reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  function open(item) {
    const route = EDIT_ROUTES[item.type];
    if (route) {
      navigate(route(item));
      return;
    }
    setSelected(item);
  }

  return (
    <Screen title="История">
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => {
              haptic();
              setParams(filter.value ? { type: filter.value } : {});
            }}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              type === filter.value ? 'bg-accent text-accent-text' : 'bg-surface text-hint'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Skeleton className="h-96" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <HistoryFeed items={data} onSelect={open} empty="За этот фильтр записей нет." />
      )}

      {selected ? (
        <ActionSheet
          item={selected}
          onClose={() => setSelected(null)}
          onDelete={() => remove(selected)}
        />
      ) : null}
    </Screen>
  );
}

/** Records without a dedicated edit screen still offer delete. */
function ActionSheet({ item, onClose, onDelete }) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-end bg-black/40 px-4 pb-6"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full space-y-2 rounded-xl2 bg-bg p-3"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="px-2 py-1 text-sm text-hint">
          {item.kind}: {item.title}
        </p>
        <button
          type="button"
          onClick={onDelete}
          className="w-full rounded-xl2 bg-surface px-4 py-3 text-base font-medium text-danger"
        >
          Удалить запись
        </button>
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl2 bg-surface px-4 py-3 text-base text-text"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}
