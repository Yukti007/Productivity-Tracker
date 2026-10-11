import { useMemo, useState } from 'react';
import { addDays, formatDay, fromKey, startOfWeek, toKey, yearOf } from '../dates';
import type { Task } from '../types';

type Mode = 'daily' | 'weekly' | 'monthly';
const MODES: { id: Mode; label: string }[] = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
];
const DAILY_WEEKS = 17;
const MODE_KEY = 'daybook.heatmap';

function readMode(): Mode {
  try {
    const m = localStorage.getItem(MODE_KEY);
    return m === 'weekly' || m === 'monthly' ? m : 'daily';
  } catch {
    return 'daily';
  }
}

/** Shade 0–4, relative to the busiest cell in view. */
const level = (n: number, max: number) => (n === 0 || max === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4)));
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function HeatmapPanel({ tasks, today }: { tasks: Task[]; today: string }) {
  const [mode, setModeState] = useState<Mode>(readMode);
  const setMode = (m: Mode) => {
    setModeState(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      // Remembering the mode is a convenience only.
    }
  };

  const doneByDay = useMemo(() => {
    const m = new Map<string, number>();
    tasks.forEach((t) => t.status === 'done' && m.set(t.date, (m.get(t.date) ?? 0) + 1));
    return m;
  }, [tasks]);

  return (
    <section className="heat-panel" aria-labelledby="heat-head">
      <div className="heat-top">
        <h2 id="heat-head">Tasks done</h2>
        <div className="segmented" role="group" aria-label="Heat map period">
          {MODES.map((m) => (
            <button key={m.id} type="button" aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'daily' && <Daily done={doneByDay} today={today} />}
      {mode === 'weekly' && <Weekly done={doneByDay} today={today} />}
      {mode === 'monthly' && <Monthly done={doneByDay} today={today} />}

      <div className="legend" aria-hidden="true">
        Less
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} className={`cell l${l}`} />
        ))}
        More
      </div>
    </section>
  );
}

function Daily({ done, today }: { done: Map<string, number>; today: string }) {
  const first = addDays(startOfWeek(today), -(DAILY_WEEKS - 1) * 7);
  const weeks = Array.from({ length: DAILY_WEEKS }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(first, w * 7 + d)));
  const days = weeks.flat().filter((d) => d <= today);
  const counts = days.map((d) => done.get(d) ?? 0);
  const max = Math.max(0, ...counts);
  const total = counts.reduce((a, b) => a + b, 0);

  // Streak counts back from today, or from yesterday if nothing is done yet today.
  let streak = 0;
  let cursor = (done.get(today) ?? 0) > 0 ? today : addDays(today, -1);
  while ((done.get(cursor) ?? 0) > 0) {
    streak++;
    cursor = addDays(cursor, -1);
  }

  return (
    <figure className="heat-figure">
      <div className="daily">
        <div className="daily-rows" aria-hidden="true">
          {['Mon', '', 'Wed', '', 'Fri', '', 'Sun'].map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div>
          <div className="daily-months" aria-hidden="true">
            {weeks.map((w, i) => {
              const firstOfMonth = w.find((d) => d.endsWith('-01'));
              return <span key={i}>{firstOfMonth ? formatDay(firstOfMonth, { month: 'short' }) : ''}</span>;
            })}
          </div>
          <div className="daily-grid" role="img" aria-label={`${plural(total, 'task')} done in the last ${DAILY_WEEKS} weeks`}>
            {weeks.map((w, i) => (
              <div key={i} className="daily-week">
                {w.map((d) => {
                  const n = done.get(d) ?? 0;
                  const future = d > today;
                  return (
                    <span
                      key={d}
                      className={`cell ${future ? 'lf' : `l${level(n, max)}`} ${d === today ? 'is-now' : ''}`}
                      title={future ? undefined : `${formatDay(d, { weekday: 'short', day: 'numeric', month: 'short' })}: ${plural(n, 'task')} done`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <figcaption>
        <strong>{plural(total, 'task')}</strong> done in the last {DAILY_WEEKS} weeks.
        <br />
        {streak > 0 ? `You’re on a ${streak}-day streak.` : 'Finish a task today to start a streak.'}
      </figcaption>
    </figure>
  );
}

function Weekly({ done, today }: { done: Map<string, number>; today: string }) {
  const year = yearOf(today);
  const thisWeek = startOfWeek(today);
  // Every Monday in the year, grouped by the month it falls in.
  const months = Array.from({ length: 12 }, (_, m) => {
    const weeks: { start: string; n: number }[] = [];
    let d = startOfWeek(toKey(new Date(year, m, 1)));
    if (fromKey(d).getMonth() !== m) d = addDays(d, 7);
    while (fromKey(d).getMonth() === m && yearOf(d) === year) {
      let n = 0;
      for (let i = 0; i < 7; i++) n += done.get(addDays(d, i)) ?? 0;
      weeks.push({ start: d, n });
      d = addDays(d, 7);
    }
    return { m, weeks };
  });
  const all = months.flatMap((x) => x.weeks);
  const max = Math.max(0, ...all.map((w) => w.n));
  const total = all.reduce((a, w) => a + w.n, 0);
  const best = all.reduce<{ start: string; n: number } | null>((b, w) => (w.n > (b?.n ?? 0) ? w : b), null);

  return (
    <figure className="heat-figure">
      <div className="weekly" role="img" aria-label={`${plural(total, 'task')} done in ${year}, by week`}>
        {months.map(({ m, weeks }) => (
          <div key={m} className="weekly-row">
            <span className="weekly-label">{new Date(year, m, 1).toLocaleDateString(undefined, { month: 'short' })}</span>
            {weeks.map((w) => (
              <span
                key={w.start}
                className={`cell ${w.start > today ? 'lf' : `l${level(w.n, max)}`} ${w.start === thisWeek ? 'is-now' : ''}`}
                title={`Week of ${formatDay(w.start, { day: 'numeric', month: 'short' })}: ${plural(w.n, 'task')} done`}
              />
            ))}
          </div>
        ))}
      </div>
      <figcaption>
        <strong>{plural(total, 'task')}</strong> done in {year}.
        {best && (
          <>
            <br />
            Best week: {formatDay(best.start, { day: 'numeric', month: 'short' })}, with {best.n}.
          </>
        )}
      </figcaption>
    </figure>
  );
}

function Monthly({ done, today }: { done: Map<string, number>; today: string }) {
  const year = yearOf(today);
  const thisMonth = fromKey(today).getMonth();
  const months = Array.from({ length: 12 }, (_, m) => {
    const prefix = `${year}-${String(m + 1).padStart(2, '0')}`;
    let n = 0;
    done.forEach((count, day) => day.startsWith(prefix) && (n += count));
    return { m, n, name: new Date(year, m, 1).toLocaleDateString(undefined, { month: 'short' }) };
  });
  const max = Math.max(0, ...months.map((x) => x.n));
  const total = months.reduce((a, x) => a + x.n, 0);
  const best = months.reduce<(typeof months)[number] | null>((b, x) => (x.n > (b?.n ?? 0) ? x : b), null);

  return (
    <figure className="heat-figure">
      <div className="monthly" role="img" aria-label={`${plural(total, 'task')} done in ${year}, by month`}>
        {months.map((x) => (
          <span key={x.m} className={`month-tile ${x.m > thisMonth ? 'lf' : `l${level(x.n, max)}`} ${x.m === thisMonth ? 'is-now' : ''}`}>
            <span className="month-name">{x.name}</span>
            <span className="month-count">{x.m > thisMonth ? '' : x.n}</span>
          </span>
        ))}
      </div>
      <figcaption>
        <strong>{plural(total, 'task')}</strong> done in {year}.
        {best && (
          <>
            <br />
            Best month: {new Date(year, best.m, 1).toLocaleDateString(undefined, { month: 'long' })}, with {best.n}.
          </>
        )}
      </figcaption>
    </figure>
  );
}
