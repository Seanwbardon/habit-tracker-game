// App-wide state: one AppData object, saved on every change.
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { now as clockNow, setDevOffsetDays } from '../domain/clock.ts';
import { archiveEndedSeasons, type AppData } from '../domain/game.ts';
import { loadData, saveData } from '../data/storage.ts';
import { logRewardChanges, rewardSnapshot, type RewardSnapshot } from './rewardLog.ts';

interface Store {
  data: AppData;
  now: Date;
  update: (fn: (d: AppData) => AppData) => void;
  setOffset: (days: number) => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => {
    const d = loadData();
    setDevOffsetDays(d.devOffsetDays);
    return archiveEndedSeasons(d, clockNow());
  });
  // Re-render once a minute so period/season boundaries roll over while open.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => saveData(data), [data]);

  // Dev builds: log how rewards and balances changed after every data or clock change.
  const lastTotals = useRef<RewardSnapshot>(undefined);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const now = clockNow();
    const totals = rewardSnapshot(data, now);
    if (lastTotals.current) logRewardChanges(lastTotals.current, totals, now);
    lastTotals.current = totals;
  }, [data, tick]);

  const store = useMemo<Store>(() => {
    const now = clockNow();
    return {
      data,
      now,
      update: (fn) =>
        setData((d) => {
          const next = fn(d);
          // Keep the clock in sync if the data was replaced (import / wipe).
          if (next.devOffsetDays !== d.devOffsetDays) setDevOffsetDays(next.devOffsetDays);
          return archiveEndedSeasons(next, clockNow());
        }),
      setOffset: (days) => {
        setDevOffsetDays(days);
        setData((d) => archiveEndedSeasons({ ...d, devOffsetDays: days }, clockNow()));
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, tick]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}

export const newId = () => crypto.randomUUID();
