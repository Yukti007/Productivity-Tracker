import { PRIORITIES, TAGS, nextStatus, statusLabel, type Priority, type Status, type Tag } from '../types';

/** Bullet-journal status glyph: empty, half, full. Clicking moves it to the next status. */
export function StatusGlyph({
  status,
  onChange,
  size = 20,
}: {
  status: Status;
  onChange: (s: Status) => void;
  size?: number;
}) {
  return (
    <button
      type="button"
      className={`glyph glyph-${status}`}
      onClick={(e) => {
        e.stopPropagation();
        onChange(nextStatus[status]);
      }}
      aria-label={`${statusLabel(status)}. Mark as ${statusLabel(nextStatus[status]).toLowerCase()}`}
      title={`${statusLabel(status)} — click for ${statusLabel(nextStatus[status]).toLowerCase()}`}
    >
      <StatusIcon status={status} size={size} />
    </button>
  );
}

/** The glyph on its own, for labelling status sections. */
export function StatusIcon({ status, size = 20 }: { status: Status; size?: number }) {
  return (
    <svg className={`glyph-${status}`} width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="7.25" className="glyph-ring" />
      {status === 'doing' && <path d="M10 2.75a7.25 7.25 0 0 1 0 14.5z" className="glyph-fill" />}
      {status === 'done' && (
        <>
          <circle cx="10" cy="10" r="7.25" className="glyph-fill" />
          <path d="M6.6 10.3l2.3 2.3 4.6-4.9" className="glyph-check" />
        </>
      )}
    </svg>
  );
}

/** Three bars, filled by priority weight. */
export function PriorityMark({ priority }: { priority: Priority }) {
  const p = PRIORITIES.find((x) => x.id === priority)!;
  return (
    <span className={`prio prio-${priority}`} role="img" aria-label={`${p.label} priority`} title={`${p.label} priority`}>
      {[1, 2, 3].map((n) => (
        <i key={n} className={n <= p.weight ? 'on' : ''} style={{ height: 4 + n * 3 }} />
      ))}
    </span>
  );
}

/** A tag drawn like a highlighter swipe. */
export function TagMark({ tag }: { tag: Tag }) {
  return <span className={`tag tag-${tag}`}>{TAGS.find((t) => t.id === tag)!.label}</span>;
}
