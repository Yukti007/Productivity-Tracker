import { useState, type DragEvent } from 'react';
import { formatDay } from '../dates';
import { byPriority, useStore } from '../store';
import { STATUSES, type Status, type Task } from '../types';
import { useUI } from '../ui';
import { PriorityMark, StatusGlyph, StatusIcon, TagMark } from './Marks';

export function TaskRow({ task, showDate = false, compact = false }: { task: Task; showDate?: boolean; compact?: boolean }) {
  const { dispatch, state } = useStore();
  const { openTask } = useUI();
  const goal = task.goalId ? state.goals.find((g) => g.id === task.goalId) : undefined;

  return (
    <li className={`task-row ${compact ? 'compact' : ''} is-${task.status}`}>
      <StatusGlyph
        status={task.status}
        size={compact ? 17 : 20}
        onChange={(status) => dispatch({ type: 'updateTask', id: task.id, patch: { status } })}
      />
      <button type="button" className="task-open" onClick={() => openTask(task.id)}>
        <span className="task-title">{task.title}</span>
        {!compact && (task.tags.length > 0 || showDate || goal) && (
          <span className="task-meta">
            {task.tags.map((tag) => (
              <TagMark key={tag} tag={tag} />
            ))}
            {showDate && <span className="task-date">from {formatDay(task.date, { weekday: 'short', day: 'numeric', month: 'short' })}</span>}
            {goal && <span className="task-goal">{goal.title}</span>}
          </span>
        )}
      </button>
      <PriorityMark priority={task.priority} />
    </li>
  );
}

const SECTION_EMPTY: Record<Status, string> = {
  todo: 'Nothing left to start. Add a task above.',
  doing: 'Nothing in progress. Click a task’s circle to start it.',
  done: 'Nothing finished yet. Click the circle again when a task is done.',
};

/** Three separate sections, always shown: Not started, In progress, Done. */
export function TaskList({ tasks, filtered = false }: { tasks: Task[]; filtered?: boolean }) {
  return (
    <div className="status-sections">
      {STATUSES.map(({ id, label }) => {
        const group = tasks.filter((t) => t.status === id).sort(byPriority);
        return (
          <section key={id} className={`status-section section-${id}`} aria-labelledby={`section-${id}`}>
            <h3 className="section-title" id={`section-${id}`}>
              <StatusIcon status={id} size={18} />
              {label}
              <span className="section-count">{group.length}</span>
            </h3>
            {group.length > 0 ? (
              <ul className="task-lines">
                {group.map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </ul>
            ) : (
              <p className="section-empty">{filtered ? 'No tasks here match the filters.' : SECTION_EMPTY[id]}</p>
            )}
          </section>
        );
      })}
    </div>
  );
}

/** Kanban-style columns; drag a slip to change its status. */
export function TaskBoard({ tasks }: { tasks: Task[] }) {
  const { dispatch } = useStore();
  const { openTask } = useUI();
  const [over, setOver] = useState<Status | null>(null);

  const onDrop = (e: DragEvent, status: Status) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/task-id');
    if (id) dispatch({ type: 'updateTask', id, patch: { status } });
    setOver(null);
  };

  return (
    <div className="board">
      {STATUSES.map(({ id, label }) => {
        const col = tasks.filter((t) => t.status === id).sort(byPriority);
        return (
          <section
            key={id}
            className={`board-col col-${id} ${over === id ? 'is-over' : ''}`}
            aria-label={label}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(id);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null);
            }}
            onDrop={(e) => onDrop(e, id)}
          >
            <h3 className="group-head">
              {label} <span className="count">{col.length}</span>
            </h3>
            <ul className="slips">
              {col.map((t) => (
                <li
                  key={t.id}
                  className={`slip is-${t.status}`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/task-id', t.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                >
                  <div className="slip-top">
                    <StatusGlyph
                      status={t.status}
                      size={18}
                      onChange={(status) => dispatch({ type: 'updateTask', id: t.id, patch: { status } })}
                    />
                    <button type="button" className="task-open" onClick={() => openTask(t.id)}>
                      <span className="task-title">{t.title}</span>
                    </button>
                  </div>
                  <div className="slip-foot">
                    <span className="task-meta">
                      {t.tags.map((tag) => (
                        <TagMark key={tag} tag={tag} />
                      ))}
                    </span>
                    <PriorityMark priority={t.priority} />
                  </div>
                </li>
              ))}
              {col.length === 0 && <li className="slip-empty">Drop a task here</li>}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
