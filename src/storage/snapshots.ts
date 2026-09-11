import type { EngineState, Snapshot, TelemetryScores } from '../types';

const STORAGE_KEY = 'engender_snapshots';
const MAX_SNAPSHOTS = 20;

export function loadSnapshots(): Snapshot[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') ?? []; }
  catch { return []; }
}

export function saveSnapshot(
  state: EngineState,
  scores: TelemetryScores,
  fingerprint: string,
  label?: string,
  parentId?: string | null,
  repairWarnings?: string[],
): Snapshot {
  const id = `snap_${Date.now()}_${fingerprint}`;
  const snap: Snapshot = {
    id,
    label: label ?? `${state.genre.toUpperCase()} • ${fingerprint}`,
    timestamp: Date.now(), state, scores, fingerprint,
    ...(parentId !== undefined ? { parentId } : {}),
    ...(repairWarnings !== undefined ? { repairWarnings } : {}),
  };
  const updated = [snap, ...loadSnapshots()].slice(0, MAX_SNAPSHOTS);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); }
  catch { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated.slice(0, 10))); }
  return snap;
}

export function deleteSnapshot(id: string): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(loadSnapshots().filter(s => s.id !== id)));
}

export function clearSnapshots(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function loadSnapshotById(id: string): Snapshot | null {
  return loadSnapshots().find(s => s.id === id) ?? null;
}

export function duplicateSnapshot(id: string): Snapshot | null {
  const snap = loadSnapshots().find(s => s.id === id);
  if (!snap) return null;
  return saveSnapshot(snap.state, snap.scores, snap.fingerprint, `${snap.label} (copy)`, snap.id, snap.repairWarnings);
}

export function branchFromSnapshot(id: string, newState: EngineState, scores: TelemetryScores, fingerprint: string): Snapshot | null {
  const parent = loadSnapshots().find(s => s.id === id);
  if (!parent) return null;
  const label = `${parent.label} ▸ branch`;
  return saveSnapshot(newState, scores, fingerprint, label, id);
}
