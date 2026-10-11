import { useState, type RefObject } from 'react';
import { addDays, formatDay, fromKey, startOfWeek, weekDays, yearOf } from '../dates';
import { applyFilters, byPriority, newId, useStore, type Filters } from '../store';
import type { Task } from '../types';
import { useUI } from '../ui';
import { AddTaskPanel, FilterBar, LayoutToggle, QuickAdd, type Layout } from './Controls';
import { HeatmapPanel } from './Heatmap';
import { TagMark } from './Marks';
import { TaskBoard, TaskList, TaskRow } from './TaskViews';

interface ViewProps {
  today: string;
  filters: Filters;
  setFilters: (f: Filters) => void;
  layout: Layout;
  setLayout: (l: Layout) => void;
  quickAddRef: RefObject<HTMLInputElement>;
}

/** One coloured segment per task, in status order, so the day's shape reads at a glance. */
function ProgressStrip({ tasks }: { tasks: Task[] }) {
  const done = tasks.filter((t) => t.status === 'done').length;
  const doing = tasks.filter((t) => t.status === 'doing').length;
  if (tasks.length === 0) return null;
  const order = { done: 0, doing: 1, todo: 2 };
  return (
    <div className="progress">
      <div className="strip" aria-hidden="true">
        {[...tasks]
          .sort((a, b) => order[a.status] - order[b.status])
          .map((t) => (
            <span key={t.id} className={`seg seg-${t.status}`} />
          ))}
      </div>
      <p className="progress-text">
        {done} of {tasks.length} done{doing > 0 ? `, ${doing} in progress` : ''}
      </p>
    </div>
  );
}

export function DayView({ day, ...p }: ViewProps & { day: 'today' | 'tomorrow' }) {
  const { state, dispatch } = useStore();
  const date = day === 'today' ? p.today : addDays(p.today, 1);
  const dayTasks = state.tasks.filter((t) => t.date === date);
  const visible = applyFilters(dayTasks, p.filters);
  const carried =
    day === 'today'
      ? applyFilters(state.tasks.filter((t) => t.date < p.today && t.status !== 'done'), p.filters).sort(
          (a, b) => a.date.localeCompare(b.date) || byPriority(a, b),
        )
      : [];

  return (
    <article className={`page ${day === 'today' ? 'page-home' : ''}`}>
      <header className="day-head">
        <h1>
          <span className="weekday">{formatDay(date, { weekday: 'long' })}</span>
          <span className="fulldate">{formatDay(date, { day: 'numeric', month: 'long', year: 'numeric' })}</span>
        </h1>
        <ProgressStrip tasks={dayTasks} />
      </header>

      <div className={day === 'today' ? 'home-grid' : ''}>
        <div className="home-main">
          <AddTaskPanel ref={p.quickAddRef} defaultDate={date} today={p.today} />

          <section className="day-tasks" aria-labelledby="day-tasks-head">
            <div className="section-head">
              <h2 id="day-tasks-head">
                {day === 'today' ? 'Today’s tasks' : 'Tomorrow’s tasks'} <span className="count">{dayTasks.length}</span>
              </h2>
              <div className="toolbar-right">
                <FilterBar filters={p.filters} onChange={p.setFilters} />
                <LayoutToggle layout={p.layout} onChange={p.setLayout} />
              </div>
            </div>

            {p.layout === 'list' ? (
              <TaskList tasks={visible} filtered={p.filters.tags.length > 0 || p.filters.priority !== 'all'} />
            ) : (
              <TaskBoard tasks={visible} />
            )}
          </section>

          {carried.length > 0 && (
            <section className="carried" aria-labelledby="carried-head">
              <div className="carried-head">
                <h2 id="carried-head">
                  Unfinished from earlier days <span className="count">{carried.length}</span>
                </h2>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => carried.forEach((t) => dispatch({ type: 'updateTask', id: t.id, patch: { date: p.today } }))}
                >
                  Move all to today
                </button>
              </div>
              <ul className="task-lines">
                {carried.map((t) => (
                  <TaskRow key={t.id} task={t} showDate />
                ))}
              </ul>
            </section>
          )}
        </div>

        {day === 'today' && (
          <aside className="home-side" aria-label="Progress">
            <HeatmapPanel tasks={state.tasks} today={p.today} />
          </aside>
        )}
      </div>
    </article>
  );
}

export function WeekView(p: ViewProps) {
  const { state } = useStore();
  const [offset, setOffset] = useState(0);
  const days = weekDays(addDays(startOfWeek(p.today), offset * 7));
  const weekTasks = state.tasks.filter((t) => t.date >= days[0] && t.date <= days[6]);
  const visible = applyFilters(weekTasks, p.filters);
  const sameMonth = days[0].slice(0, 7) === days[6].slice(0, 7);
  const range = sameMonth
    ? `${formatDay(days[0], { day: 'numeric', month: 'long' })}–${fromKey(days[6]).getDate()}`
    : `${formatDay(days[0], { day: 'numeric', month: 'short' })} – ${formatDay(days[6], { day: 'numeric', month: 'short' })}`;

  return (
    <article className="page page-wide">
      <header className="day-head">
        <h1>
          <span className="weekday">{offset === 0 ? 'This week' : offset === 1 ? 'Next week' : offset === -1 ? 'Last week' : 'Week'}</span>
          <span className="fulldate">{range}</span>
        </h1>
        <ProgressStrip tasks={weekTasks} />
      </header>

      <div className="toolbar">
        <FilterBar filters={p.filters} onChange={p.setFilters} />
        <div className="toolbar-right">
          <div className="segmented" role="group" aria-label="Change week">
            <button type="button" onClick={() => setOffset(offset - 1)} aria-label="Previous week">
              ‹
            </button>
            <button type="button" onClick={() => setOffset(0)} aria-pressed={offset === 0}>
              This week
            </button>
            <button type="button" onClick={() => setOffset(offset + 1)} aria-label="Next week">
              ›
            </button>
          </div>
          <LayoutToggle layout={p.layout} onChange={p.setLayout} labels={{ list: 'By day', board: 'By status' }} />
        </div>
      </div>

      {p.layout === 'board' ? (
        <TaskBoard tasks={visible} />
      ) : (
        <div className="week">
          {days.map((d) => {
            const list = visible.filter((t) => t.date === d).sort(byPriority);
            const isToday = d === p.today;
            return (
              <section key={d} className={`week-day ${isToday ? 'is-today' : ''} ${d < p.today ? 'is-past' : ''}`} aria-label={formatDay(d, { weekday: 'long', day: 'numeric', month: 'long' })}>
                <h2 className="week-day-head">
                  <span className="wd">{formatDay(d, { weekday: 'short' })}</span>
                  <span className="dn">{fromKey(d).getDate()}</span>
                </h2>
                <ul className="task-lines">
                  {list.map((t) => (
                    <TaskRow key={t.id} task={t} compact />
                  ))}
                </ul>
                <QuickAdd date={d} placeholder="Add" />
              </section>
            );
          })}
        </div>
      )}
    </article>
  );
}

export function GoalsView({ today }: { today: string }) {
  const { state, dispatch } = useStore();
  const { openGoal } = useUI();
  const [year, setYear] = useState(yearOf(today));
  const [draft, setDraft] = useState('');
  const goals = state.goals.filter((g) => g.year === year).sort((a, b) => Number(a.done) - Number(b.done) || a.createdAt - b.createdAt);
  const reached = goals.filter((g) => g.done).length;

  return (
    <article className="page">
      <header className="day-head">
        <h1>
          <span className="weekday">{year} goals</span>
          <span className="fulldate">
            {goals.length === 0 ? 'Decide what this year is for' : `${reached} of ${goals.length} reached`}
          </span>
        </h1>
        <div className="segmented" role="group" aria-label="Change year">
          <button type="button" onClick={() => setYear(year - 1)} aria-label="Previous year">
            ‹
          </button>
          <button type="button" onClick={() => setYear(yearOf(today))} aria-pressed={year === yearOf(today)}>
            This year
          </button>
          <button type="button" onClick={() => setYear(year + 1)} aria-label="Next year">
            ›
          </button>
        </div>
      </header>

      <form
        className="quick-add"
        onSubmit={(e) => {
          e.preventDefault();
          const title = draft.trim();
          if (!title) return;
          dispatch({ type: 'addGoal', goal: { id: newId(), title, year, tags: [], notes: '', done: false, createdAt: Date.now() } });
          setDraft('');
        }}
      >
        <span className="quick-plus" aria-hidden="true">+</span>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Add a goal for ${year}`} aria-label={`Add a goal for ${year}`} />
      </form>

      {goals.length === 0 ? (
        <p className="empty">No goals for {year} yet. Add one, then link day-to-day tasks to it to see progress here.</p>
      ) : (
        <ul className="goals">
          {goals.map((g) => {
            const linked = state.tasks.filter((t) => t.goalId === g.id);
            const done = linked.filter((t) => t.status === 'done').length;
            const pct = g.done ? 100 : linked.length ? Math.round((done / linked.length) * 100) : 0;
            return (
              <li key={g.id} className={`goal ${g.done ? 'is-done' : ''}`}>
                <input
                  type="checkbox"
                  className="goal-check"
                  checked={g.done}
                  onChange={(e) => dispatch({ type: 'updateGoal', id: g.id, patch: { done: e.target.checked } })}
                  aria-label={`Mark “${g.title}” as reached`}
                />
                <button type="button" className="goal-open" onClick={() => openGoal(g.id)}>
                  <span className="goal-title">{g.title}</span>
                  <span className="task-meta">
                    {g.tags.map((t) => (
                      <TagMark key={t} tag={t} />
                    ))}
                    <span className="goal-count">
                      {linked.length === 0 ? 'No linked tasks' : `${done} of ${linked.length} tasks done`}
                    </span>
                  </span>
                </button>
                <div className="meter" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Linked tasks done">
                  <span style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
