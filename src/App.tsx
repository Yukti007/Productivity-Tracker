import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addDays, startOfWeek, useToday, yearOf } from './dates';
import { useStore, type Filters } from './store';
import type { Task } from './types';
import { UIContext, type UI } from './ui';
import type { Layout } from './components/Controls';
import { GoalEditor, TaskEditor } from './components/Editors';
import { DayView, GoalsView, WeekView } from './components/Views';

type Route = 'today' | 'tomorrow' | 'week' | 'goals';
const ROUTES: Route[] = ['today', 'tomorrow', 'week', 'goals'];

function useRoute(): [Route, (r: Route) => void] {
  const read = () => {
    const r = window.location.hash.replace('#/', '') as Route;
    return ROUTES.includes(r) ? r : 'today';
  };
  const [route, setRoute] = useState<Route>(read);
  useEffect(() => {
    const onHash = () => setRoute(read());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return [route, (r) => (window.location.hash = `#/${r}`)];
}

function usePersistedLayout(): [Layout, (l: Layout) => void] {
  const [layout, setLayout] = useState<Layout>(() => {
    try {
      return localStorage.getItem('daybook.layout') === 'board' ? 'board' : 'list';
    } catch {
      return 'list';
    }
  });
  return [
    layout,
    (l) => {
      setLayout(l);
      try {
        localStorage.setItem('daybook.layout', l);
      } catch {
        // Layout preference is a convenience; ignore storage failures.
      }
    },
  ];
}

export default function App() {
  const { state, dispatch } = useStore();
  const today = useToday();
  const [route, go] = useRoute();
  const [layout, setLayout] = usePersistedLayout();
  const [filters, setFilters] = useState<Filters>({ tags: [], priority: 'all' });
  const [editing, setEditing] = useState<{ kind: 'task' | 'goal'; id: string } | null>(null);
  const [deleted, setDeleted] = useState<Task | null>(null);
  const quickAddRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!deleted) return;
    const timer = window.setTimeout(() => setDeleted(null), 6000);
    return () => window.clearTimeout(timer);
  }, [deleted]);

  // Press N anywhere to jump to the add-task field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key.toLowerCase() !== 'n' || e.metaKey || e.ctrlKey || e.altKey || editing) return;
      if (el.closest('input, textarea, select, [contenteditable]')) return;
      if (quickAddRef.current) {
        e.preventDefault();
        quickAddRef.current.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing]);

  const ui = useMemo<UI>(
    () => ({
      openTask: (id) => setEditing({ kind: 'task', id }),
      openGoal: (id) => setEditing({ kind: 'goal', id }),
      deleteTask: (task) => {
        dispatch({ type: 'deleteTask', id: task.id });
        setDeleted(task);
      },
    }),
    [dispatch],
  );
  const closeEditor = useCallback(() => setEditing(null), []);

  const tomorrow = addDays(today, 1);
  const weekStart = startOfWeek(today);
  const weekEnd = addDays(weekStart, 6);
  const open = (t: Task) => t.status !== 'done';
  const counts: Record<Route, string> = {
    today: String(state.tasks.filter((t) => open(t) && t.date <= today).length),
    tomorrow: String(state.tasks.filter((t) => open(t) && t.date === tomorrow).length),
    week: String(state.tasks.filter((t) => open(t) && t.date >= weekStart && t.date <= weekEnd).length),
    goals: (() => {
      const g = state.goals.filter((x) => x.year === yearOf(today));
      return g.length ? `${g.filter((x) => x.done).length}/${g.length}` : '';
    })(),
  };
  const labels: Record<Route, string> = { today: 'Today', tomorrow: 'Tomorrow', week: 'This week', goals: 'Year goals' };

  const viewProps = { today, filters, setFilters, layout, setLayout, quickAddRef };

  return (
    <UIContext.Provider value={ui}>
      <div className="app">
        <nav className="nav" aria-label="Views">
          <a className="brand" href="#/today">
            <svg width="22" height="22" viewBox="0 0 20 20" aria-hidden="true">
              <circle cx="10" cy="10" r="7.25" className="glyph-ring" />
              <path d="M10 2.75a7.25 7.25 0 0 1 0 14.5z" className="glyph-fill" />
            </svg>
            Daybook
          </a>
          <ul>
            {ROUTES.map((r) => (
              <li key={r}>
                <a
                  href={`#/${r}`}
                  aria-current={route === r ? 'page' : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    go(r);
                  }}
                >
                  <span>{labels[r]}</span>
                  {counts[r] && counts[r] !== '0' && <span className="nav-count">{counts[r]}</span>}
                </a>
              </li>
            ))}
          </ul>
          <p className="nav-tip">
            Press <kbd>N</kbd> to add a task
          </p>
        </nav>

        <main className="main">
          {route === 'today' && <DayView day="today" {...viewProps} />}
          {route === 'tomorrow' && <DayView day="tomorrow" {...viewProps} />}
          {route === 'week' && <WeekView {...viewProps} />}
          {route === 'goals' && <GoalsView today={today} />}
        </main>
      </div>

      {editing?.kind === 'task' && <TaskEditor key={editing.id} id={editing.id} onClose={closeEditor} />}
      {editing?.kind === 'goal' && <GoalEditor key={editing.id} id={editing.id} onClose={closeEditor} />}

      <div className="toast-region" role="status" aria-live="polite">
        {deleted && (
          <div className="toast">
            <span>Deleted “{deleted.title}”</span>
            <button
              type="button"
              onClick={() => {
                dispatch({ type: 'restoreTask', task: deleted });
                setDeleted(null);
              }}
            >
              Undo
            </button>
          </div>
        )}
      </div>
    </UIContext.Provider>
  );
}
