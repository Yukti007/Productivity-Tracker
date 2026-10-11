import { useEffect, useRef, type ReactNode } from 'react';
import { yearOf } from '../dates';
import { useStore } from '../store';
import { PRIORITIES, STATUSES, TAGS, type Tag, type Task } from '../types';
import { useUI } from '../ui';
import { PriorityMark, StatusGlyph } from './Marks';

/** A modal side sheet built on <dialog>, so focus trapping and Escape come for free. */
function Sheet({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    if (!dialog.open) dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-label={label}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet-body">
        <button type="button" className="sheet-close" onClick={onClose} aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M4 4l10 10M14 4L4 14" />
          </svg>
        </button>
        {children}
      </div>
    </dialog>
  );
}

/**
 * Single-line title that wraps and grows instead of scrolling. A hidden copy of the
 * text shares the grid cell and sets the height, so no measuring is needed.
 */
function TitleField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="title-grow" data-value={value || label}>
      <textarea
        className="editor-title"
        value={value}
        rows={1}
        onChange={(e) => onChange(e.target.value.replace(/\n/g, ' '))}
        onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
        aria-label={label}
        placeholder={label}
      />
    </div>
  );
}

function TagPicker({ value, onChange }: { value: Tag[]; onChange: (tags: Tag[]) => void }) {
  return (
    <div className="chips">
      {TAGS.map((t) => {
        const on = value.includes(t.id);
        return (
          <button
            key={t.id}
            type="button"
            className={`chip chip-${t.id} ${on ? 'on' : ''}`}
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== t.id) : [...value, t.id])}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export function TaskEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const { deleteTask } = useUI();
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return null;

  const update = (patch: Partial<Task>) => dispatch({ type: 'updateTask', id, patch });
  const goals = state.goals.filter((g) => g.year === yearOf(task.date));

  return (
    <Sheet label="Edit task" onClose={onClose}>
      <div className="editor-title-row">
        <StatusGlyph status={task.status} size={24} onChange={(status) => update({ status })} />
        <TitleField value={task.title} onChange={(title) => update({ title })} label="Task name" />
      </div>

      <dl className="props">
        <dt>Status</dt>
        <dd>
          <div className="segmented">
            {STATUSES.map((s) => (
              <button key={s.id} type="button" aria-pressed={task.status === s.id} onClick={() => update({ status: s.id })}>
                {s.label}
              </button>
            ))}
          </div>
        </dd>

        <dt>Priority</dt>
        <dd>
          <div className="segmented">
            {PRIORITIES.map((p) => (
              <button key={p.id} type="button" aria-pressed={task.priority === p.id} onClick={() => update({ priority: p.id })}>
                <PriorityMark priority={p.id} /> {p.label}
              </button>
            ))}
          </div>
        </dd>

        <dt>Tags</dt>
        <dd>
          <TagPicker value={task.tags} onChange={(tags) => update({ tags })} />
        </dd>

        <dt>
          <label htmlFor="task-date">Day</label>
        </dt>
        <dd>
          <input id="task-date" type="date" value={task.date} onChange={(e) => e.target.value && update({ date: e.target.value })} />
        </dd>

        <dt>
          <label htmlFor="task-goal">Goal</label>
        </dt>
        <dd>
          <select id="task-goal" value={task.goalId ?? ''} onChange={(e) => update({ goalId: e.target.value || null })}>
            <option value="">No goal</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
          {goals.length === 0 && <p className="hint">Add goals for {yearOf(task.date)} to link tasks to them.</p>}
        </dd>
      </dl>

      <label className="notes-label" htmlFor="task-notes">
        Notes
      </label>
      <textarea
        id="task-notes"
        className="notes"
        rows={5}
        value={task.notes}
        onChange={(e) => update({ notes: e.target.value })}
        placeholder="Add details, links or next steps"
      />

      <div className="sheet-actions">
        <button
          type="button"
          className="danger-btn"
          onClick={() => {
            deleteTask(task);
            onClose();
          }}
        >
          Delete task
        </button>
        <button type="button" className="primary-btn" onClick={onClose}>
          Done editing
        </button>
      </div>
    </Sheet>
  );
}

export function GoalEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const goal = state.goals.find((g) => g.id === id);
  if (!goal) return null;
  const linked = state.tasks.filter((t) => t.goalId === id);

  return (
    <Sheet label="Edit goal" onClose={onClose}>
      <div className="editor-title-row">
        <input
          type="checkbox"
          className="goal-check"
          checked={goal.done}
          onChange={(e) => dispatch({ type: 'updateGoal', id, patch: { done: e.target.checked } })}
          aria-label="Goal reached"
        />
        <TitleField value={goal.title} onChange={(title) => dispatch({ type: 'updateGoal', id, patch: { title } })} label="Goal name" />
      </div>

      <dl className="props">
        <dt>
          <label htmlFor="goal-year">Year</label>
        </dt>
        <dd>
          <input
            id="goal-year"
            type="number"
            min={2000}
            max={2100}
            value={goal.year}
            onChange={(e) => {
              const year = Number(e.target.value);
              if (year >= 2000 && year <= 2100) dispatch({ type: 'updateGoal', id, patch: { year } });
            }}
          />
        </dd>
        <dt>Tags</dt>
        <dd>
          <TagPicker value={goal.tags} onChange={(tags) => dispatch({ type: 'updateGoal', id, patch: { tags } })} />
        </dd>
        <dt>Linked tasks</dt>
        <dd>
          {linked.length === 0
            ? 'None yet. Link a task from its editor.'
            : `${linked.filter((t) => t.status === 'done').length} of ${linked.length} done`}
        </dd>
      </dl>

      <label className="notes-label" htmlFor="goal-notes">
        Why it matters
      </label>
      <textarea
        id="goal-notes"
        className="notes"
        rows={5}
        value={goal.notes}
        onChange={(e) => dispatch({ type: 'updateGoal', id, patch: { notes: e.target.value } })}
        placeholder="What will be different when you reach this?"
      />

      <div className="sheet-actions">
        <button
          type="button"
          className="danger-btn"
          onClick={() => {
            if (window.confirm(`Delete the goal “${goal.title}”? Linked tasks stay, but lose their goal.`)) {
              dispatch({ type: 'deleteGoal', id });
              onClose();
            }
          }}
        >
          Delete goal
        </button>
        <button type="button" className="primary-btn" onClick={onClose}>
          Done editing
        </button>
      </div>
    </Sheet>
  );
}
