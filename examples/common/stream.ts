import type { GraphQLFormattedError } from "graphql";
import type {
  FormattedInitialIncrementalExecutionResult,
  FormattedIncrementalResult,
  FormattedIncrementalStreamResult,
} from "graphql/execution";

import { getAtPath } from "./path.ts";
import type {
  InitialStreamSnapshot,
  ResponsePath,
  StreamBatch,
  StreamSnapshot,
} from "./types.ts";

export function initialStreamBatch<TData, TItem>(
  initialResult: FormattedInitialIncrementalExecutionResult<TData>,
  path: ResponsePath,
): StreamBatch<TItem> {
  const value = getAtPath(initialResult.data, path);
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item, index) => ({
    item: item as TItem,
    path: [...path, index],
  }));
}

export function createInitialStreamSnapshot<TData, TItem>(
  initialResult: FormattedInitialIncrementalExecutionResult<TData>,
  path: ResponsePath,
): StreamSnapshot<TItem> | undefined {
  const initialBatch = initialStreamBatch<TData, TItem>(initialResult, path);
  if (
    initialBatch.length === 0 &&
    !Array.isArray(getAtPath(initialResult.data, path))
  ) {
    return undefined;
  }

  return createStreamSnapshot(initialBatch);
}

export function createInitialStreamSnapshots<TData, TItem>(
  initialResult: FormattedInitialIncrementalExecutionResult<TData>,
): ReadonlyArray<InitialStreamSnapshot<TItem>> {
  const snapshots: Array<InitialStreamSnapshot<TItem>> = [];

  for (const pending of initialResult.pending) {
    const snapshot = createInitialStreamSnapshot<TData, TItem>(
      initialResult,
      pending.path,
    );
    if (snapshot !== undefined) {
      snapshots.push({
        id: pending.id,
        path: pending.path,
        snapshot,
      });
    }
  }

  return snapshots;
}

export function appendStreamItems<TItem>(
  snapshot: StreamSnapshot<TItem>,
  path: ResponsePath,
  items: ReadonlyArray<TItem>,
  errors?: ReadonlyArray<GraphQLFormattedError>,
): StreamSnapshot<TItem> {
  const batch: StreamBatch<TItem> = items.map((item, index) => ({
    item,
    path: [...path, snapshot.itemCount + index],
  }));

  return {
    batches:
      batch.length === 0 ? snapshot.batches : [...snapshot.batches, batch],
    done: snapshot.done,
    errors:
      errors === undefined ? snapshot.errors : [...snapshot.errors, ...errors],
    itemCount: snapshot.itemCount + items.length,
  };
}

export function completeStream<TItem>(
  snapshot: StreamSnapshot<TItem>,
  errors?: ReadonlyArray<GraphQLFormattedError>,
): StreamSnapshot<TItem> {
  return {
    batches: snapshot.batches,
    done: true,
    errors:
      errors === undefined ? snapshot.errors : [...snapshot.errors, ...errors],
    itemCount: snapshot.itemCount,
  };
}

export function createStreamSnapshot<TItem>(
  initialBatch: StreamBatch<TItem> = [],
): StreamSnapshot<TItem> {
  return {
    batches: initialBatch.length === 0 ? [] : [initialBatch],
    done: false,
    errors: [],
    itemCount: initialBatch.length,
  };
}

export function isStreamPayload<TItem>(
  payload: FormattedIncrementalResult<unknown, TItem>,
): payload is FormattedIncrementalStreamResult<TItem> {
  return "items" in payload;
}
