import { describe, expect, it } from 'vitest';

import { delta, humanDate, kg, money, percent, plural } from '../lib/format';

describe('money', () => {
  it('groups thousands and appends the tenge sign', () => {
    // The group separator is locale/ICU dependent, so compare on the digits.
    expect(money(150000).replace(/\s/g, ' ')).toBe('150 000 ₸');
  });

  it('rounds to whole tenge', () => {
    expect(money(1499.6).replace(/\s/g, ' ')).toBe('1 500 ₸');
  });

  it('renders a negative remainder with a minus sign', () => {
    expect(money(-5000)).toContain('−');
  });

  it('falls back for missing values', () => {
    expect(money(null)).toBe('—');
    expect(money(undefined)).toBe('—');
  });
});

describe('kg', () => {
  it('uses one decimal and a comma', () => {
    expect(kg(83.25)).toBe('83,3 кг');
    expect(kg(84)).toBe('84,0 кг');
  });

  it('falls back for a missing weight', () => {
    expect(kg(null)).toBe('—');
  });
});

describe('delta', () => {
  it('signs the change explicitly', () => {
    expect(delta(-1.3)).toBe('−1,3');
    expect(delta(0.5)).toBe('+0,5');
  });

  it('returns nothing when there is no change to show', () => {
    expect(delta(0)).toBeNull();
    expect(delta(null)).toBeNull();
  });
});

describe('percent', () => {
  it('drops a trailing zero decimal', () => {
    expect(percent(25)).toBe('25%');
    expect(percent(12.5)).toBe('12,5%');
  });
});

describe('plural', () => {
  const forms = ['день', 'дня', 'дней'];

  it('picks the right Russian form', () => {
    expect(plural(1, forms)).toBe('день');
    expect(plural(2, forms)).toBe('дня');
    expect(plural(5, forms)).toBe('дней');
    expect(plural(11, forms)).toBe('дней');
    expect(plural(21, forms)).toBe('день');
    expect(plural(0, forms)).toBe('дней');
  });
});

describe('humanDate', () => {
  it('names today and yesterday', () => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    expect(humanDate(iso(today))).toBe('сегодня');
    expect(humanDate(iso(yesterday))).toBe('вчера');
  });

  it('shows the year only for other years', () => {
    expect(humanDate('2019-03-12')).toBe('12 марта 2019');
  });

  it('passes through anything unparseable', () => {
    expect(humanDate('')).toBe('');
  });
});

function iso(date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}
