import { useEffect, useState } from 'react';

const pad = (n: number) => String(n).padStart(2, '0');

export const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const fromKey = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (key: string, n: number) => {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
};

/** Weeks start on Monday. */
export const startOfWeek = (key: string) => {
  const d = fromKey(key);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toKey(d);
};

export const weekDays = (key: string) => {
  const start = startOfWeek(key);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
};

export const yearOf = (key: string) => Number(key.slice(0, 4));

export const formatDay = (key: string, opts: Intl.DateTimeFormatOptions) =>
  fromKey(key).toLocaleDateString(undefined, opts);

/** Today's key, refreshed when the day rolls over or the tab regains focus. */
export function useToday() {
  const [today, setToday] = useState(() => toKey(new Date()));
  useEffect(() => {
    const check = () => setToday(toKey(new Date()));
    const timer = window.setInterval(check, 60_000);
    window.addEventListener('focus', check);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', check);
    };
  }, []);
  return today;
}
