import { createContext, useContext, useEffect, useReducer, type Dispatch, type ReactNode } from 'react';
import { TAGS, priorityWeight, type Goal, type Priority, type Tag, type Task } from './types';

interface State {
  tasks: Task[];
  goals: Goal[];
}

type Action =
  | { type: 'addTask'; task: Task }
  | { type: 'restoreTask'; task: Task }
  | { type: 'updateTask'; id: string; patch: Partial<Task> }
  | { type: 'deleteTask'; id: string }
  | { type: 'addGoal'; goal: Goal }
  | { type: 'updateGoal'; id: string; patch: Partial<Goal> }
  | { type: 'deleteGoal'; id: string };

const STORAGE_KEY = 'daybook.v1';

function load(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.tasks) && Array.isArray(parsed.goals)) return parsed;
    }
  } catch {
    // Unreadable storage: start with an empty daybook.
  }
  return { tasks: [], goals: [] };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'addTask':
    case 'restoreTask':
      return { ...state, tasks: [...state.tasks, action.task] };
    case 'updateTask':
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === action.id ? { ...t, ...action.patch } : t)),
      };
    case 'deleteTask':
      return { ...state, tasks: state.tasks.filter((t) => t.id !== action.id) };
    case 'addGoal':
      return { ...state, goals: [...state.goals, action.goal] };
    case 'updateGoal':
      return {
        ...state,
        goals: state.goals.map((g) => (g.id === action.id ? { ...g, ...action.patch } : g)),
      };
    case 'deleteGoal':
      return {
        goals: state.goals.filter((g) => g.id !== action.id),
        tasks: state.tasks.map((t) => (t.goalId === action.id ? { ...t, goalId: null } : t)),
      };
  }
}

const StoreContext = createContext<{ state: State; dispatch: Dispatch<Action> } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage full or blocked; changes stay in memory for this session.
    }
  }, [state]);
  return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export function makeTask(fields: Partial<Task> & { title: string; date: string }): Task {
  return {
    id: newId(),
    notes: '',
    status: 'todo',
    priority: 'medium',
    tags: [],
    goalId: null,
    createdAt: Date.now(),
    ...fields,
  };
}

/** High priority first, then oldest first. */
export const byPriority = (a: Task, b: Task) =>
  priorityWeight(b.priority) - priorityWeight(a.priority) || a.createdAt - b.createdAt;

const PRIORITY_WORDS: Record<string, Priority> = {
  '!high': 'high', '!h': 'high',
  '!medium': 'medium', '!med': 'medium', '!m': 'medium',
  '!low': 'low', '!l': 'low',
};

/** Pulls `#work`-style tags and `!high`-style priorities out of a quick-add line. */
export function parseQuickAdd(input: string): { title: string; tags: Tag[]; priority?: Priority } {
  const tags = new Set<Tag>();
  let priority: Priority | undefined;
  const words = input.split(/\s+/).filter((word) => {
    const w = word.toLowerCase();
    const tag = TAGS.find((t) => `#${t.id}` === w);
    if (tag) {
      tags.add(tag.id);
      return false;
    }
    if (PRIORITY_WORDS[w]) {
      priority = PRIORITY_WORDS[w];
      return false;
    }
    return true;
  });
  return { title: words.join(' ').trim(), tags: [...tags], priority };
}

export interface Filters {
  tags: Tag[];
  priority: Priority | 'all';
}

export const applyFilters = (tasks: Task[], f: Filters) =>
  tasks.filter(
    (t) =>
      (f.priority === 'all' || t.priority === f.priority) &&
      (f.tags.length === 0 || f.tags.some((tag) => t.tags.includes(tag))),
  );
