export type Status = 'todo' | 'doing' | 'done';
export type Priority = 'high' | 'medium' | 'low';
export type Tag = 'work' | 'physical' | 'family' | 'personal';

export interface Task {
  id: string;
  title: string;
  notes: string;
  /** Local calendar day, YYYY-MM-DD */
  date: string;
  status: Status;
  priority: Priority;
  tags: Tag[];
  goalId: string | null;
  createdAt: number;
}

export interface Goal {
  id: string;
  title: string;
  year: number;
  tags: Tag[];
  notes: string;
  done: boolean;
  createdAt: number;
}

export const STATUSES: { id: Status; label: string }[] = [
  { id: 'todo', label: 'Not started' },
  { id: 'doing', label: 'In progress' },
  { id: 'done', label: 'Done' },
];

export const PRIORITIES: { id: Priority; label: string; weight: number }[] = [
  { id: 'high', label: 'High', weight: 3 },
  { id: 'medium', label: 'Medium', weight: 2 },
  { id: 'low', label: 'Low', weight: 1 },
];

export const TAGS: { id: Tag; label: string }[] = [
  { id: 'work', label: 'Work' },
  { id: 'physical', label: 'Physical' },
  { id: 'family', label: 'Family' },
  { id: 'personal', label: 'Personal' },
];

export const statusLabel = (s: Status) => STATUSES.find((x) => x.id === s)!.label;
export const priorityWeight = (p: Priority) => PRIORITIES.find((x) => x.id === p)!.weight;

export const nextStatus: Record<Status, Status> = { todo: 'doing', doing: 'done', done: 'todo' };
