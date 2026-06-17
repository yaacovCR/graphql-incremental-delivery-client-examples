import { getContext, setContext } from "svelte";
import { readonly, writable, type Readable, type Writable } from "svelte/store";
import type { FormattedInitialIncrementalExecutionResult } from "graphql/execution";

import {
  completeDeferred,
  createDeferredSnapshot,
  mergeDeferredData,
} from "../common/deferred.ts";
import {
  createPendingIndex,
  getPendingPath,
  getRequiredPendingId,
  registerPendingResults,
} from "../common/pending.ts";
import {
  appendStreamItems,
  completeStream,
  createInitialStreamSnapshots,
  createStreamSnapshot,
  isStreamPayload,
} from "../common/stream.ts";
import type {
  DeferredSnapshot,
  PendingIndex,
  ResponsePath,
  StreamSnapshot,
} from "../common/types.ts";
import type { FormattedSubsequentIncrementalExecutionResult } from "graphql/execution";

type SubsequentResult = FormattedSubsequentIncrementalExecutionResult<object>;

type DeferredStore<TData = unknown> = Readable<DeferredSnapshot<TData>>;
type StreamStore<TItem = unknown> = Readable<StreamSnapshot<TItem>>;
type WritableDeferredStore<TData = unknown> = Writable<DeferredSnapshot<TData>>;
type WritableStreamStore<TItem = unknown> = Writable<StreamSnapshot<TItem>>;

const IncrementalClientKey = Symbol("SvelteIncrementalClient");

export function setIncrementalClient<TData>(
  client: SvelteIncrementalClient<TData>,
): void {
  setContext(IncrementalClientKey, client);
}

export function useDeferredFragment<TData>(
  label: string,
  path?: ResponsePath,
): DeferredStore<TData> {
  return getIncrementalClient().deferred<TData>(label, path);
}

export function useStream<TItem>(
  label: string,
  path?: ResponsePath,
): StreamStore<TItem> {
  return getIncrementalClient().stream<TItem>(label, path);
}

function getIncrementalClient(): SvelteIncrementalClient {
  const client = getContext<SvelteIncrementalClient>(IncrementalClientKey);
  if (client == null) {
    throw new Error("Missing SvelteIncrementalClient context.");
  }
  return client;
}

export class SvelteIncrementalClient<TInitialData = unknown> {
  private readonly deferredStores = new Map<string, WritableDeferredStore>();
  private readonly pending: PendingIndex;
  private readonly streamStores = new Map<string, WritableStreamStore>();

  constructor(
    initialResult: FormattedInitialIncrementalExecutionResult<TInitialData>,
  ) {
    this.pending = createPendingIndex(initialResult.pending);

    for (const { id, snapshot } of createInitialStreamSnapshots(
      initialResult,
    )) {
      this.streamStores.set(id, writable(snapshot));
    }
  }

  apply(result: SubsequentResult): void {
    registerPendingResults(this.pending, result.pending);

    for (const payload of result.incremental ?? []) {
      if (isStreamPayload(payload)) {
        const path = getPendingPath(this.pending, payload.id);
        if (path === undefined) {
          continue;
        }
        this.streamForId(payload.id).update((snapshot) =>
          appendStreamItems(snapshot, path, payload.items, payload.errors),
        );
      } else {
        this.deferredForId(payload.id).update((snapshot) =>
          mergeDeferredData(
            snapshot,
            payload.data,
            payload.subPath,
            payload.errors,
          ),
        );
      }
    }

    for (const completed of result.completed ?? []) {
      const stream = this.streamStores.get(completed.id);
      if (stream != null) {
        stream.update((snapshot) => completeStream(snapshot, completed.errors));
        continue;
      }

      this.deferredForId(completed.id).update((snapshot) =>
        completeDeferred(snapshot, completed.errors),
      );
    }
  }

  deferred<TData>(label: string, path?: ResponsePath): DeferredStore<TData> {
    return readonly(
      this.deferredForId(getRequiredPendingId(this.pending, label, path)),
    ) as DeferredStore<TData>;
  }

  stream<TItem>(label: string, path?: ResponsePath): StreamStore<TItem> {
    return readonly(
      this.streamForId(getRequiredPendingId(this.pending, label, path)),
    ) as StreamStore<TItem>;
  }

  private deferredForId(id: string): WritableDeferredStore {
    let store = this.deferredStores.get(id);
    if (store == null) {
      store = writable(createDeferredSnapshot());
      this.deferredStores.set(id, store);
    }
    return store;
  }

  private streamForId(id: string): WritableStreamStore {
    let store = this.streamStores.get(id);
    if (store == null) {
      store = writable(createStreamSnapshot());
      this.streamStores.set(id, store);
    }
    return store;
  }
}
