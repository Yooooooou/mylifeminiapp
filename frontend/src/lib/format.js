/** Display formatting, kept in one place so screens stay presentational. */

export function money(value, { sign = false } = {}) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const rounded = Math.round(value);
  const text = Math.abs(rounded).toLocaleString('ru-RU');
  const prefix = sign && rounded > 0 ? '+' : rounded < 0 ? '−' : '';
  return `${prefix}${text} ₸`;
}

export function kg(value) {
  if (value === null || value === undefined) return '—';
  return `${value.toFixed(1).replace('.', ',')} кг`;
}

export function delta(value) {
  if (value === null || value === undefined || value === 0) return null;
  const text = Math.abs(value).toFixed(1).replace('.', ',');
  return `${value > 0 ? '+' : '−'}${text}`;
}

export function percent(value) {
  if (value === null || value === undefined) return '—';
  return `${value.toFixed(value % 1 === 0 ? 0 : 1).replace('.', ',')}%`;
}

/** 'дней' vs 'день' vs 'дня' — Russian needs the right plural form. */
export function plural(count, [one, few, many]) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

export function todayIso() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

/** '2025-09-08' -> '8 сентября' (this year) or '8 сен 2024' (any other). */
const MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

export function humanDate(iso) {
  if (!iso) return '';
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;

  const today = new Date();
  const isToday = parsed.toDateString() === today.toDateString();
  if (isToday) return 'сегодня';

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (parsed.toDateString() === yesterday.toDateString()) return 'вчера';

  const label = `${parsed.getDate()} ${MONTHS[parsed.getMonth()]}`;
  return parsed.getFullYear() === today.getFullYear()
    ? label
    : `${label} ${parsed.getFullYear()}`;
}
