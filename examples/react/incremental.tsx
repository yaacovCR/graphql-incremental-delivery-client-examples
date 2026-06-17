"use client";

import {
  createContext,
  createElement,
  use,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";
import type {
  FormattedInitialIncrementalExecutionResult,
  FormattedSubsequentIncrementalExecutionResult,
} from "graphql/execution";

import { consumeAsyncIterable } from "../common/consumeAsyncIterable.ts";
import { createGraphQLError } from "../common/createGraphQLError.ts";
import {
  completeDeferred,
  createDeferredSnapshot,
  mergeDeferredData,
} from "../common/deferred.ts";
import {
  createPendingIndex,
  getPendingId,
  getRequiredPendingId,
  getRequiredPendingPath,
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

type SubsequentResult = FormattedSubsequentIncrementalExecutionResult<object>;

type Listener = () => void;

type DeferredRecord<TData = unknown> = {
  promise: Promise<TData>;
  reject: (error: unknown) => void;
  resolve: (value: TData) => void;
  snapshot: DeferredSnapshot<TData>;
};

type StreamRecord<TItem = unknown> = {
  listeners: Set<Listener>;
  path: ResponsePath;
  snapshot: StreamSnapshot<TItem>;
};

const IncrementalContext = createContext<ReactIncrementalStore | null>(null);

export function IncrementalProvider<TData>(props: {
  children: ReactNode;
  initialResult: FormattedInitialIncrementalExecutionResult<TData>;
  subsequentResults: AsyncIterable<SubsequentResult>;
}) {
  const store = useMemo(
    () => new ReactIncrementalStore(props.initialResult),
    [props.initialResult],
  );

  useEffect(() => {
    if (!props.initialResult.hasNext) {
      return;
    }

    return consumeAsyncIterable(props.subsequentResults, (result) =>
      store.apply(result),
    );
  }, [props.initialResult.hasNext, props.subsequentResults, store]);

  return createElement(
    IncrementalContext.Provider,
    { value: store },
    props.children,
  );
}

export function useDeferredFragment<TData>(
  label: string,
  path?: ResponsePath,
): TData {
  const store = useIncrementalStore();
  return use(store.deferredPromise<TData>(label, path));
}

export function useStream<TItem>(
  label: string,
  path?: ResponsePath,
): StreamSnapshot<TItem> {
  const store = useIncrementalStore();
  const subscribe = useCallback(
    (listener: Listener) => store.subscribeStream(label, path, listener),
    [label, path, store],
  );
  const getSnapshot = useCallback(
    () => store.streamSnapshot<TItem>(label, path),
    [label, path, store],
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function useIncrementalStore(): ReactIncrementalStore {
  const store = useContext(IncrementalContext);
  if (store == null) {
    throw new Error("Missing IncrementalProvider.");
  }
  return store;
}

class ReactIncrementalStore<TInitialData = unknown> {
  private readonly deferred = new Map<string, DeferredRecord>();
  private readonly pending: PendingIndex;
  private readonly streams = new Map<string, StreamRecord>();

  constructor(
    initialResult: FormattedInitialIncrementalExecutionResult<TInitialData>,
  ) {
    this.pending = createPendingIndex(initialResult.pending);

    for (const { id, path, snapshot } of createInitialStreamSnapshots<
      TInitialData,
      unknown
    >(initialResult)) {
      this.streams.set(id, {
        listeners: new Set(),
        path,
        snapshot,
      });
    }
  }

  apply(result: SubsequentResult): void {
    registerPendingResults(this.pending, result.pending);

    for (const payload of result.incremental ?? []) {
      if (isStreamPayload(payload)) {
        const stream = this.streamForId(payload.id);
        stream.snapshot = appendStreamItems(
          stream.snapshot,
          stream.path,
          payload.items,
          payload.errors,
        );
        this.publish(stream);
      } else {
        const deferred = this.deferredForId(payload.id);
        deferred.snapshot = mergeDeferredData(
          deferred.snapshot,
          payload.data,
          payload.subPath,
          payload.errors,
        );
      }
    }

    for (const completed of result.completed ?? []) {
      const stream = this.streams.get(completed.id);
      if (stream != null) {
        stream.snapshot = completeStream(stream.snapshot, completed.errors);
        this.publish(stream);
        continue;
      }

      const deferred = this.deferredForId(completed.id);
      deferred.snapshot = completeDeferred(deferred.snapshot, completed.errors);
      if (deferred.snapshot.errors.length > 0) {
        deferred.reject(createGraphQLError(deferred.snapshot.errors));
      } else {
        deferred.resolve(deferred.snapshot.data);
      }
    }
  }

  deferredPromise<TData>(label: string, path?: ResponsePath): Promise<TData> {
    return this.deferredForId(getRequiredPendingId(this.pending, label, path))
      .promise as Promise<TData>;
  }

  streamSnapshot<TItem>(
    label: string,
    path?: ResponsePath,
  ): StreamSnapshot<TItem> {
    const id = getPendingId(this.pending, label, path);
    if (id == null) {
      return emptyStreamSnapshot as StreamSnapshot<TItem>;
    }
    return this.streamForId(id).snapshot as StreamSnapshot<TItem>;
  }

  subscribeStream(
    label: string,
    path: ResponsePath | undefined,
    listener: Listener,
  ): () => void {
    const id = getPendingId(this.pending, label, path);
    if (id == null) {
      return () => {};
    }

    const stream = this.streamForId(id);
    stream.listeners.add(listener);
    return () => stream.listeners.delete(listener);
  }

  private deferredForId(id: string): DeferredRecord {
    let record = this.deferred.get(id);
    if (record == null) {
      const { promise, resolve, reject } = Promise.withResolvers<unknown>();
      record = {
        promise,
        reject,
        resolve,
        snapshot: createDeferredSnapshot(),
      };
      this.deferred.set(id, record);
    }
    return record;
  }

  private streamForId(id: string): StreamRecord {
    let stream = this.streams.get(id);
    if (stream == null) {
      stream = {
        listeners: new Set(),
        path: getRequiredPendingPath(this.pending, id),
        snapshot: createStreamSnapshot(),
      };
      this.streams.set(id, stream);
    }
    return stream;
  }

  private publish(stream: StreamRecord): void {
    for (const listener of stream.listeners) {
      listener();
    }
  }
}

const emptyStreamSnapshot: StreamSnapshot = {
  batches: [],
  done: true,
  errors: [],
  itemCount: 0,
};
