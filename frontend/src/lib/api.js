/**
 * API client. Every request carries the signed Telegram initData; the backend
 * refuses anything else, so there is no other auth path to maintain.
 */

import { initData, initDataDiagnosis } from './telegram';

const BASE = import.meta.env.VITE_API_BASE ?? '';

/** Fail before the round trip when there is nothing to authenticate with. */
function assertSigned() {
  if (initData()) return;
  throw new ApiError(initDataDiagnosis() ?? 'Нет подписи Telegram.', 401);
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request(path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(`${BASE}/api${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Init-Data': initData(),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Нет связи с сервером. Проверь интернет.', 0);
  }

  if (response.status === 204) return null;

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    if (response.status === 403) {
      // The backend distinguishes a wrong account from a bad signature, and
      // names the caller's Telegram id in the first case. Swallowing that
      // detail left the screen saying "denied" with no way to tell which.
      throw new ApiError(
        detailOf(payload) ?? 'Доступ только для владельца трекера.',
        403,
      );
    }
    throw new ApiError(detailOf(payload) ?? 'Не удалось выполнить запрос.', response.status);
  }

  return payload;
}

/** FastAPI returns `detail` as a string, or as a list for validation errors. */
function detailOf(payload) {
  const detail = payload?.detail;
  if (!detail) return null;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const first = detail[0];
    return first?.msg ? `${first.msg}` : null;
  }
  return null;
}

export const api = {
  dashboard: () => request('/dashboard'),

  debts: () => request('/finance/debts'),
  createDebt: (body) => request('/finance/debts', { method: 'POST', body }),
  updateDebt: (id, body) => request(`/finance/debts/${id}`, { method: 'PATCH', body }),
  deleteDebt: (id) => request(`/finance/debts/${id}`, { method: 'DELETE' }),

  cashflow: () => request('/finance/cashflow'),
  addIncome: (body) => request('/finance/cashflow', { method: 'POST', body }),

  body: () => request('/body'),
  addWeight: (body) => request('/body', { method: 'POST', body }),
  updateWeight: (id, body) => request(`/body/${id}`, { method: 'PATCH', body }),
  deleteWeight: (id) => request(`/body/${id}`, { method: 'DELETE' }),

  jobs: () => request('/jobs'),
  createJob: (body) => request('/jobs', { method: 'POST', body }),
  updateJob: (id, body) => request(`/jobs/${id}`, { method: 'PATCH', body }),
  deleteJob: (id) => request(`/jobs/${id}`, { method: 'DELETE' }),

  habitsToday: () => request('/habits/today'),
  saveHabits: (body) => request('/habits', { method: 'POST', body }),

  history: (type, limit = 100) => {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    params.set('limit', String(limit));
    return request(`/history?${params}`);
  },

  remove: (type, id) => {
    const paths = {
      body: `/body/${id}`,
      jobs: `/jobs/${id}`,
      habits: `/habits/${id}`,
      finance: `/finance/debts/${id}`,
    };
    return request(paths[type], { method: 'DELETE' });
  },
};
