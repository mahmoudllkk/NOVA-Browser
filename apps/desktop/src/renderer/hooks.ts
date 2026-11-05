import { useEffect, useState } from 'react';
import { call, on } from './api';
import { DEFAULT_SETTINGS, type Settings } from '../shared/types';

export function useSettings(): Settings {
  const [s, setS] = useState<Settings>(DEFAULT_SETTINGS);
  useEffect(() => {
    call<Settings>('settings.get').then(setS).catch(() => undefined);
    return on('nova:settings', setS);
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = s.theme; }, [s.theme]);
  return s;
}

export function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export const openLink = (e: React.MouseEvent, url: string) => {
  e.preventDefault();
  void call('page.open', url, e.ctrlKey || e.button === 1);
};

export const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
export const fmtDay = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
export const fmtBytes = (n: number) => {
  if (n < 1024) return `${n} B`;
  const u = ['KB', 'MB', 'GB', 'TB'];
  let i = -1;
  do { n /= 1024; i++; } while (n >= 1024 && i < u.length - 1);
  return `${n.toFixed(1)} ${u[i]}`;
};
