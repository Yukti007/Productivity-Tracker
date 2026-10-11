import { createContext, useContext } from 'react';
import type { Task } from './types';

export interface UI {
  openTask: (id: string) => void;
  openGoal: (id: string) => void;
  deleteTask: (task: Task) => void;
}

export const UIContext = createContext<UI | null>(null);

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used inside UIContext');
  return ctx;
}
