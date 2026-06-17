import { inject, provide, readonly, shallowRef, type InjectionKey } from "vue";
import type { ShallowRef } from "vue";
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

type DeferredRef<TData = unknown> = Readonly<
  ShallowRef<DeferredSnapshot<TData>>
>;
type StreamRef<TItem = unknown> = Readonly<ShallowRef<StreamSnapshot<TItem>>>;
type WritableDeferredRef<TData = unknown> = ShallowRef<DeferredSnapshot<TData>>;
type WritableStreamRef<TItem = unknown> = ShallowRef<StreamSnapshot<TItem>>;

const IncrementalClientKey: InjectionKey<VueIncrementalClient> = Symbol(
  "VueIncrementalClient",
);

export function provideIncrementalClient<TData>(
  client: VueIncrementalClient<TData>,
): void {
  provide(IncrementalClientKey, client);
}

export function useDeferredFragment<TData>(
  label: string,
  path?: ResponsePath,
): DeferredRef<TData> {
  return useIncrementalClient().deferred<TData>(label, path);
}

export function useStream<TItem>(
  label: string,
  path?: ResponsePath,
): StreamRef<TItem> {
  return useIncrementalClient().stream<TItem>(label, path);
}

function useIncrementalClient(): VueIncrementalClient {
  const client = inject(IncrementalClientKey);
  if (client == null) {
    throw new Error("Missing VueIncrementalClient provider.");
  }
  return client;
}

export class VueIncrementalClient<TInitialData = unknown> {
  private readonly deferredRefs = new Map<string, WritableDeferredRef>();
  private readonly pending: PendingIndex;
  private readonly streamRefs = new Map<string, WritableStreamRef>();

  constructor(
    initialResult: FormattedInitialIncrementalExecutionResult<TInitialData>,
  ) {
    this.pending = createPendingIndex(initialResult.pending);

    for (const { id, snapshot } of createInitialStreamSnapshots(
      initialResult,
    )) {
      this.streamRefs.set(id, shallowRef(snapshot));
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
        const stream = this.streamForId(payload.id);
        stream.value = appendStreamItems(
          stream.value,
          path,
          payload.items,
          payload.errors,
        );
      } else {
        const deferred = this.deferredForId(payload.id);
        deferred.value = mergeDeferredData(
          deferred.value,
          payload.data,
          payload.subPath,
          payload.errors,
        );
      }
    }

    for (const completed of result.completed ?? []) {
      const stream = this.streamRefs.get(completed.id);
      if (stream != null) {
        stream.value = completeStream(stream.value, completed.errors);
        continue;
      }

      const deferred = this.deferredForId(completed.id);
      deferred.value = completeDeferred(deferred.value, completed.errors);
    }
  }

  deferred<TData>(label: string, path?: ResponsePath): DeferredRef<TData> {
    return readonly(
      this.deferredForId(getRequiredPendingId(this.pending, label, path)),
    ) as DeferredRef<TData>;
  }

  stream<TItem>(label: string, path?: ResponsePath): StreamRef<TItem> {
    return readonly(
      this.streamForId(getRequiredPendingId(this.pending, label, path)),
    ) as StreamRef<TItem>;
  }

  private deferredForId(id: string): WritableDeferredRef {
    let ref = this.deferredRefs.get(id);
    if (ref == null) {
      ref = shallowRef(createDeferredSnapshot());
      this.deferredRefs.set(id, ref);
    }
    return ref;
  }

  private streamForId(id: string): WritableStreamRef {
    let ref = this.streamRefs.get(id);
    if (ref == null) {
      ref = shallowRef(createStreamSnapshot());
      this.streamRefs.set(id, ref);
    }
    return ref;
  }
}
