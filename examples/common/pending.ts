import type { PendingIndex, PendingResult, ResponsePath } from "./types.ts";

export function createPendingIndex(
  pendingResults?: ReadonlyArray<PendingResult>,
): PendingIndex {
  const index: PendingIndex = {
    byId: new Map(),
    idsByLabel: new Map(),
    idByLabelAndPath: new Map(),
  };

  registerPendingResults(index, pendingResults);
  return index;
}

export function registerPending(
  index: PendingIndex,
  pending: PendingResult,
): void {
  index.byId.set(pending.id, pending);

  if (pending.label == null) {
    return;
  }

  let ids = index.idsByLabel.get(pending.label);
  if (ids == null) {
    ids = new Set();
    index.idsByLabel.set(pending.label, ids);
  }
  ids.add(pending.id);
  index.idByLabelAndPath.set(
    labelPathKey(pending.label, pending.path),
    pending.id,
  );
}

export function registerPendingResults(
  index: PendingIndex,
  pendingResults?: ReadonlyArray<PendingResult>,
): void {
  for (const pending of pendingResults ?? []) {
    registerPending(index, pending);
  }
}

export function getPendingId(
  index: PendingIndex,
  label: string,
  path?: ResponsePath,
): string | undefined {
  if (path !== undefined) {
    return index.idByLabelAndPath.get(labelPathKey(label, path));
  }

  const ids = index.idsByLabel.get(label);
  if (ids == null || ids.size === 0) {
    return undefined;
  }
  if (ids.size > 1) {
    throw new Error(
      `Label "${label}" matched ${String(ids.size)} pending entries. Pass a path to choose one.`,
    );
  }
  return Array.from(ids)[0];
}

export function getRequiredPendingId(
  index: PendingIndex,
  label: string,
  path?: ResponsePath,
): string {
  const id = getPendingId(index, label, path);
  if (id == null) {
    throw new Error(`No pending entry found for label "${label}".`);
  }
  return id;
}

export function getPendingPath(
  index: PendingIndex,
  id: string,
): ResponsePath | undefined {
  return index.byId.get(id)?.path;
}

export function getRequiredPendingPath(
  index: PendingIndex,
  id: string,
): ResponsePath {
  const path = getPendingPath(index, id);
  if (path === undefined) {
    throw new Error(`No pending entry found for id "${id}".`);
  }
  return path;
}

function labelPathKey(label: string, path: ResponsePath): string {
  return `${label}:${JSON.stringify(path)}`;
}
