// lib/devDeltaStore.ts
export type DeltaState = { nextLink?: string; deltaLink?: string };

type Store = Map<string, DeltaState>;

// Persist across Next.js dev HMR by stashing on globalThis
const g = globalThis as any;
// Use a non-underscored global slot to avoid no-underscore-dangle
const MEM_SLOT = "filterlyDeltaMem";
const mem: Store = (g[MEM_SLOT] as Store) || new Map();
g[MEM_SLOT] = mem;

export function loadDeltaState(key: string): DeltaState | null {
  return mem.get(key) ?? null;
}

export function saveDeltaState(key: string, state: DeltaState) {
  mem.set(key, state);
  const dl = state.deltaLink
    ? `delta=${state.deltaLink.slice(0, 50)}…`
    : "delta=∅";
  const nl = state.nextLink ? `next=${state.nextLink.slice(0, 50)}…` : "next=∅";
  console.log("[delta:save]", key, dl, nl);
}

export function resetDeltaState(key?: string) {
  if (key) mem.delete(key);
  else mem.clear();
}
