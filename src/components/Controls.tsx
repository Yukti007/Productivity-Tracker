import { forwardRef, useState } from 'react';
import { addDays } from '../dates';
import { makeTask, parseQuickAdd, useStore, type Filters } from '../store';
import { PRIORITIES, TAGS, type Priority, type Tag } from '../types';
import { parseSpoken, useVoiceInput } from '../voice';
import { PriorityMark } from './Marks';

/** The main "Add a new task" form: name (typed or spoken), priority, tags and day. */
export const AddTaskPanel = forwardRef<HTMLInputElement, { defaultDate: string; today: string }>(function AddTaskPanel(
  { defaultDate, today },
  ref,
) {
  const { dispatch } = useStore();
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [tags, setTags] = useState<Tag[]>([]);
  const [date, setDate] = useState(defaultDate);
  const [added, setAdded] = useState<string | null>(null);

  const voice = useVoiceInput((text, final) => {
    if (!final) {
      setTitle(text);
      return;
    }
    const spoken = parseSpoken(text);
    setTitle(spoken.title);
    if (spoken.priority) setPriority(spoken.priority);
    if (spoken.tags.length) setTags((prev) => [...new Set([...prev, ...spoken.tags])]);
  });

  const toggleTag = (tag: Tag) => setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));

  const submit = () => {
    // Typed shortcuts like "#work !high" still work and add to the selections below.
    const typed = parseQuickAdd(title);
    if (!typed.title) return;
    dispatch({
      type: 'addTask',
      task: makeTask({
        title: typed.title,
        date,
        priority: typed.priority ?? priority,
        tags: [...new Set([...tags, ...typed.tags])],
      }),
    });
    setAdded(typed.title);
    setTitle('');
    setPriority('medium');
    setTags([]);
  };

  const dayLabel = date === today ? 'Today' : date === addDays(today, 1) ? 'Tomorrow' : null;

  return (
    <section className="add-panel" aria-labelledby="add-panel-head">
      <h2 id="add-panel-head">Add a new task</h2>
      <form
        className="add-row"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          ref={ref}
          className="add-input"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setAdded(null);
          }}
          placeholder={voice.listening ? 'Listening…' : 'What do you need to do?'}
          aria-label="Task name"
          enterKeyHint="done"
        />
        {voice.supported && (
          <button
            type="button"
            className={`mic-btn ${voice.listening ? 'is-listening' : ''}`}
            onClick={voice.listening ? voice.stop : voice.start}
            aria-pressed={voice.listening}
            aria-label={voice.listening ? 'Stop voice input' : 'Add task by voice'}
            title={voice.listening ? 'Stop listening' : 'Speak your task'}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
              <rect x="7" y="2.5" width="6" height="10" rx="3" />
              <path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v2.5" />
            </svg>
          </button>
        )}
        <button type="submit" className="primary-btn" disabled={!title.trim()}>
          Add task
        </button>
      </form>

      <div className="add-options">
        <div className="option">
          <span className="option-label" id="opt-priority">
            Priority
          </span>
          <div className="segmented" role="group" aria-labelledby="opt-priority">
            {PRIORITIES.map((p) => (
              <button key={p.id} type="button" aria-pressed={priority === p.id} onClick={() => setPriority(p.id)}>
                <PriorityMark priority={p.id} /> {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="option">
          <span className="option-label" id="opt-tags">
            Tags
          </span>
          <div className="chips" role="group" aria-labelledby="opt-tags">
            {TAGS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`chip chip-${t.id} ${tags.includes(t.id) ? 'on' : ''}`}
                aria-pressed={tags.includes(t.id)}
                onClick={() => toggleTag(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="option">
          <label className="option-label" htmlFor="opt-date">
            Day
          </label>
          <span className="day-pick">
            <input id="opt-date" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
            {dayLabel && <span className="day-name">{dayLabel}</span>}
          </span>
        </div>
      </div>

      <p className="add-status" role="status" aria-live="polite">
        {voice.error ??
          (voice.listening
            ? 'Listening. Say the task, then “high priority” or “tag family” if you like.'
            : added
              ? `Added “${added}”.`
              : '')}
      </p>
    </section>
  );
});

/** Small inline add used inside each day of the week view. */
export function QuickAdd({ date, placeholder }: { date: string; placeholder: string }) {
  const { dispatch } = useStore();
  const [value, setValue] = useState('');

  return (
    <form
      className="quick-add small"
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = parseQuickAdd(value);
        if (!parsed.title) return;
        dispatch({
          type: 'addTask',
          task: makeTask({ title: parsed.title, date, tags: parsed.tags, priority: parsed.priority ?? 'medium' }),
        });
        setValue('');
      }}
    >
      <span className="quick-plus" aria-hidden="true">+</span>
      <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} aria-label={placeholder} enterKeyHint="done" />
    </form>
  );
}

export function FilterBar({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const active = filters.tags.length > 0 || filters.priority !== 'all';
  return (
    <div className="filters" role="group" aria-label="Filter tasks">
      <label className="select-wrap">
        <span className="sr-only">Tag</span>
        <select value={filters.tags[0] ?? 'all'} onChange={(e) => onChange({ ...filters, tags: e.target.value === 'all' ? [] : [e.target.value as Tag] })}>
          <option value="all">All tags</option>
          {TAGS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <label className="select-wrap">
        <span className="sr-only">Priority</span>
        <select value={filters.priority} onChange={(e) => onChange({ ...filters, priority: e.target.value as Filters['priority'] })}>
          <option value="all">Any priority</option>
          {PRIORITIES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label} priority
            </option>
          ))}
        </select>
      </label>
      {active && (
        <button type="button" className="link-btn" onClick={() => onChange({ tags: [], priority: 'all' })}>
          Clear
        </button>
      )}
    </div>
  );
}

export type Layout = 'list' | 'board';

export function LayoutToggle({
  layout,
  onChange,
  labels = { list: 'List', board: 'Board' },
}: {
  layout: Layout;
  onChange: (l: Layout) => void;
  labels?: Record<Layout, string>;
}) {
  return (
    <div className="segmented" role="group" aria-label="Layout">
      {(['list', 'board'] as const).map((l) => (
        <button key={l} type="button" aria-pressed={layout === l} onClick={() => onChange(l)}>
          {labels[l]}
        </button>
      ))}
    </div>
  );
}
