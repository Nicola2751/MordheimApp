import { useSyncExternalStore } from 'react';
import { seedState } from './engine.ts';
import type { AppState } from './types.ts';

const KEY = 'mordheim.cronache.v1';

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as AppState;
      if (s && s.campaign && Array.isArray(s.bands)) return s;
    }
  } catch {
    /* dati illeggibili: si riparte dall'esempio */
  }
  return seedState();
}

let state: AppState = load();
const listeners = new Set<() => void>();
const localListeners = new Set<(s: AppState) => void>();

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* spazio finito o storage bloccato */
  }
}

export const getState = (): AppState => state;

export function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Chiamata dopo ogni modifica fatta da questo dispositivo (non per quelle arrivate dal server). */
export function onLocalChange(l: (s: AppState) => void): () => void {
  localListeners.add(l);
  return () => localListeners.delete(l);
}

function commit(next: AppState, local: boolean): void {
  state = next;
  persist();
  listeners.forEach((l) => l());
  if (local) localListeners.forEach((l) => l(state));
}

/** Modifica lo stato su una copia e pubblica il risultato. */
export function update(fn: (draft: AppState) => void): void {
  const draft = structuredClone(state);
  fn(draft);
  draft.t = Date.now();
  commit(draft, true);
}

/** Sostituisce lo stato con uno arrivato dal server o da un import. */
export function replaceState(next: AppState, opts: { local?: boolean } = {}): void {
  commit({ ...next, t: opts.local ? Date.now() : next.t }, Boolean(opts.local));
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getState);
}
