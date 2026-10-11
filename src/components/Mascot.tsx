import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Task } from '../types';

/**
 * Pip, the Daybook mascot. Hops when a task is added, cheers when one is done,
 * throws a party when today is cleared, and gets sad when something goes overdue.
 */

type Reaction = 'jump' | 'celebrate' | 'party' | 'sad' | 'pet';
type Face = 'happy' | 'joy' | 'sad' | 'worried';

const DURATION: Record<Reaction, number> = { jump: 750, celebrate: 1400, party: 2000, sad: 2600, pet: 650 };
const BUBBLE_MS = 3800;
const SAD_SEEN_KEY = 'daybook.pip.sadSeen';

const CONFETTI = ['#6b54b5', '#c8466f', '#c9821f', '#4f9a6c', '#8fa2f0', '#f2b5cd', '#9a7fd8', '#fbd36b', '#6b54b5', '#4f9a6c', '#c8466f', '#8fa2f0'];

const short = (s: string) => (s.length > 32 ? `${s.slice(0, 30).trimEnd()}…` : s);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function Mascot({ tasks, today }: { tasks: Task[]; today: string }) {
  const [reaction, setReaction] = useState<{ kind: Reaction; id: number } | null>(null);
  const [bubble, setBubble] = useState<{ text: string; id: number } | null>(null);
  const prevTasks = useRef<Task[] | null>(null);
  const prevOverdue = useRef<number | null>(null);
  const seq = useRef(0);

  const overdue = tasks.filter((t) => t.date < today && t.status !== 'done');
  const todays = tasks.filter((t) => t.date === today);
  const leftToday = todays.filter((t) => t.status !== 'done').length;

  const react = (kind: Reaction, text?: string) => {
    seq.current += 1;
    setReaction({ kind, id: seq.current });
    if (text) setBubble({ text, id: seq.current });
  };

  // Work out what just happened by comparing with the previous task list.
  useEffect(() => {
    const before = prevTasks.current;
    const beforeOverdue = prevOverdue.current;
    prevTasks.current = tasks;
    prevOverdue.current = overdue.length;

    if (!before) {
      // First load: be sad once a day if something slipped, not on every refresh.
      let seen: string | null = null;
      try {
        seen = localStorage.getItem(SAD_SEEN_KEY);
      } catch {
        // Storage unavailable; just react.
      }
      if (overdue.length > 0 && seen !== today) {
        react('sad', `${plural(overdue.length, 'task')} slipped past ${overdue.length === 1 ? 'its' : 'their'} day.`);
        try {
          localStorage.setItem(SAD_SEEN_KEY, today);
        } catch {
          // Not remembering is fine.
        }
      }
      return;
    }

    const prevById = new Map(before.map((t) => [t.id, t]));
    const completed = tasks.filter((t) => t.status === 'done' && prevById.get(t.id) && prevById.get(t.id)!.status !== 'done');
    const added = tasks.filter((t) => !prevById.has(t.id));

    if (completed.length > 0) {
      if (todays.length > 0 && leftToday === 0) react('party', 'That’s everything for today. Brilliant!');
      else if (leftToday > 0) react('celebrate', `Nice one! ${plural(leftToday, 'task')} left today.`);
      else react('celebrate', `Done: “${short(completed[0].title)}”.`);
    } else if (added.length > 0) {
      react('jump', added.length === 1 ? `Got it: “${short(added[0].title)}”.` : `Added ${plural(added.length, 'task')}.`);
    } else if (beforeOverdue !== null && overdue.length > beforeOverdue) {
      const newest = overdue[overdue.length - 1];
      react('sad', `Oh no, “${short(newest.title)}” is overdue.`);
    }
    // `react` only touches state setters, so it is safe to leave out of the dependencies.
  }, [tasks, today]);

  useEffect(() => {
    if (!reaction) return;
    const t = window.setTimeout(() => setReaction(null), DURATION[reaction.kind]);
    return () => window.clearTimeout(t);
  }, [reaction]);

  useEffect(() => {
    if (!bubble) return;
    const t = window.setTimeout(() => setBubble(null), BUBBLE_MS);
    return () => window.clearTimeout(t);
  }, [bubble]);

  const summary = () => {
    if (todays.length === 0) return 'Nothing planned today yet. Add a task and I’ll cheer you on.';
    const done = todays.length - leftToday;
    const base = leftToday === 0 ? `All ${todays.length} done today.` : `${done} of ${todays.length} done today.`;
    return overdue.length ? `${base} ${plural(overdue.length, 'task')} overdue.` : base;
  };

  const kind = reaction?.kind;
  const face: Face =
    kind === 'sad' ? 'sad' : kind === 'jump' || kind === 'celebrate' || kind === 'party' ? 'joy' : overdue.length > 0 ? 'worried' : 'happy';

  return (
    <div className={`pip ${kind ? `react-${kind}` : ''} face-${face}`}>
      {bubble && (
        <p key={bubble.id} className="pip-bubble" role="status">
          {bubble.text}
        </p>
      )}
      <button
        type="button"
        className="pip-btn"
        onClick={() => react('pet', summary())}
        aria-label="Pip, your Daybook buddy. Show today’s summary"
      >
        {(kind === 'celebrate' || kind === 'party') && (
          <span key={reaction!.id} className="pip-confetti" aria-hidden="true">
            {CONFETTI.slice(0, kind === 'party' ? 12 : 8).map((c, i, arr) => {
              const angle = (i / arr.length) * Math.PI * 2 - Math.PI / 2;
              const dist = kind === 'party' ? 62 : 46;
              return (
                <i
                  key={i}
                  style={
                    {
                      '--c': c,
                      '--dx': `${Math.cos(angle) * dist}px`,
                      '--dy': `${Math.sin(angle) * dist - 10}px`,
                      '--rot': `${(i % 2 ? 1 : -1) * (180 + i * 40)}deg`,
                    } as CSSProperties
                  }
                />
              );
            })}
          </span>
        )}
        <PipArt key={reaction?.id ?? 0} face={face} />
      </button>
    </div>
  );
}

function PipArt({ face }: { face: Face }) {
  return (
    <svg className="pip-svg" viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <linearGradient id="pip-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#cdbcf6" />
          <stop offset="1" stopColor="#9277dc" />
        </linearGradient>
      </defs>

      <ellipse className="pip-shadow" cx="60" cy="113" rx="26" ry="4.5" />

      <g className="pip-body">
        <ellipse className="pip-foot" cx="46" cy="106" rx="9" ry="5" />
        <ellipse className="pip-foot" cx="74" cy="106" rx="9" ry="5" />

        <g className="pip-arm-l">
          <ellipse className="pip-arm" cx="23" cy="76" rx="6.5" ry="10" transform="rotate(20 23 76)" />
        </g>
        <g className="pip-arm-r">
          <ellipse className="pip-arm" cx="97" cy="76" rx="6.5" ry="10" transform="rotate(-20 97 76)" />
        </g>

        <path d="M60 22C88 22 100 46 100 72c0 24-16 36-40 36S20 96 20 72c0-26 12-50 40-50z" fill="url(#pip-body)" />
        <ellipse cx="60" cy="86" rx="23" ry="16" fill="#f1eafd" opacity="0.9" />

        <g className="pip-sprout">
          <path d="M60 24c0-7 1-12 3-16" className="pip-stem" />
          <path d="M61 13c-9-8-19-5-17 1 6 4 13 3 17-1z" fill="#6fb38a" />
          <path d="M62 10c8-10 20-7 17 0-5 5-13 4-17 0z" fill="#88c7a0" />
        </g>

        <ellipse cx="36" cy="71" rx="6" ry="3.5" fill="#f4a9c3" opacity="0.75" />
        <ellipse cx="84" cy="71" rx="6" ry="3.5" fill="#f4a9c3" opacity="0.75" />

        {face === 'joy' ? (
          <g className="pip-ink-line">
            <path d="M41 61q6-7 12 0" />
            <path d="M67 61q6-7 12 0" />
          </g>
        ) : (
          <g className="pip-eyes">
            <ellipse cx="47" cy="60" rx="5" ry="6.5" fill="#3a2d52" />
            <ellipse cx="73" cy="60" rx="5" ry="6.5" fill="#3a2d52" />
            <circle cx="48.8" cy="57.6" r="1.8" fill="#fff" />
            <circle cx="74.8" cy="57.6" r="1.8" fill="#fff" />
          </g>
        )}

        {(face === 'sad' || face === 'worried') && (
          <g className="pip-ink-line pip-brows">
            <path d="M40 52l11-4" />
            <path d="M80 52l-11-4" />
          </g>
        )}

        {face === 'happy' && <path className="pip-ink-line" d="M53 70q7 7 14 0" />}
        {face === 'joy' && (
          <>
            <path d="M50 68h20q-1 13-10 13t-10-13z" fill="#3a2d52" />
            <ellipse cx="60" cy="77.5" rx="5" ry="2.6" fill="#f28fb0" />
          </>
        )}
        {face === 'worried' && <path className="pip-ink-line" d="M54 74q6-3 12 0" />}
        {face === 'sad' && (
          <>
            <path className="pip-ink-line" d="M53 76q7-7 14 0" />
            <path className="pip-tear" d="M42 67c-3 5-3 8 0 8s3-3 0-8z" />
          </>
        )}
      </g>
    </svg>
  );
}
