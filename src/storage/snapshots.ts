import type { EngineState, Snapshot, TelemetryScores } from '../types';

const STORAGE_KEY = 'engender_snapshots';
const MAX_SNAPSHOTS = 20;

export function loadSnapshots(): Snapshot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Snapshot[];
  } catch {
    return [];
  }
}

export function saveSnapshot(
  state: EngineState,
  scores: TelemetryScores,
  fingerprint: string,
  label?: string,
): Snapshot {
  const snapshots = loadSnapshots();
  const id = `snap_${Date.now()}_${fingerprint}`;
  const snap: Snapshot = {
    id,
    label: label ?? `${state.genre.toUpperCase()} • ${fingerprint}`,
    timestamp: Date.now(),
    state,
    scores,
    fingerprint,
  };

  const updated = [snap, ...snapshots].slice(0, MAX_SNAPSHOTS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Storage full — remove oldest
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated.slice(0, 10)));
  }
  return snap;
}

export function deleteSnapshot(id: string): void {
  const updated = loadSnapshots().filter(s => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function clearSnapshots(): void {
  localStorage.removeItem(STORAGE_KEY);
}
