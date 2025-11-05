// lib/devDeltaStore.ts
export type DeltaState = { nextLink?: string; deltaLink?: string };

const mem = new Map<string, DeltaState>();

export function loadDeltaState(key: string): DeltaState | null {
  return mem.get(key) ?? null;
}

export function saveDeltaState(key: string, state: DeltaState) {
  mem.set(key, state);
}

export function resetDeltaState(key?: string) {
  if (key) mem.delete(key);
  else mem.clear();
}
