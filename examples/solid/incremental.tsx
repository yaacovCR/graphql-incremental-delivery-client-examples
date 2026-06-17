/* @jsxImportSource solid-js */
import {
  createContext,
  createResource,
  createSignal,
  onCleanup,
  useContext,
} from "solid-js";
import type { Accessor, Resource, Setter } from "solid-js";
import type { FormattedInitialIncrementalExecutionResult } from "graphql/execution";

import { consumeAsyncIterable } from "../common/consumeAsyncIterable.ts";
import { createGraphQLError } from "../common/createGraphQLError.ts";
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

type DeferredSignal<TData = unknown> = {
  promise: Promise<TData>;
  reject: (error: unknown) => void;
  resolve: (value: TData) => void;
  setSnapshot: Setter<DeferredSnapshot<TData>>;
  snapshot: Accessor<DeferredSnapshot<TData>>;
};

type StreamSignal<TItem = unknown> = {
  setSnapshot: Setter<StreamSnapshot<TItem>>;
  snapshot: Accessor<StreamSnapshot<TItem>>;
};

export const IncrementalClientContext = createContext<SolidIncrementalClient>();

export function useDeferredFragment<TData>(
  label: string,
  path?: ResponsePath,
): Resource<TData> {
  const client = useIncrementalClient();
  const [resource] = createResource(() =>
    client.deferredPromise<TData>(label, path),
  );
  return resource;
}

export function useStream<TItem>(
  label: string,
  path?: ResponsePath,
): Accessor<StreamSnapshot<TItem>> {
  const client = useIncrementalClient();
  return client.stream<TItem>(label, path);
}

function useIncrementalClient(): SolidIncrementalClient {
  const client = useContext(IncrementalClientContext);
  if (client == null) {
    throw new Error("Missing IncrementalClientContext provider.");
  }
  return client;
}

export class SolidIncrementalClient<TInitialData = unknown> {
  private readonly deferredSignals = new Map<string, DeferredSignal>();
  private readonly pending: PendingIndex;
  private readonly streamSignals = new Map<string, StreamSignal>();

  constructor(
    initialResult: FormattedInitialIncrementalExecutionResult<TInitialData>,
  ) {
    this.pending = createPendingIndex(initialResult.pending);

    for (const {
      id,
      snapshot: initialSnapshot,
    } of createInitialStreamSnapshots<TInitialData, unknown>(initialResult)) {
      const [snapshot, setSnapshot] =
        createSignal<StreamSnapshot>(initialSnapshot);
      this.streamSignals.set(id, { setSnapshot, snapshot });
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
        stream.setSnapshot((snapshot) =>
          appendStreamItems(snapshot, path, payload.items, payload.errors),
        );
      } else {
        const deferred = this.deferredForId(payload.id);
        deferred.setSnapshot((snapshot) =>
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
      const stream = this.streamSignals.get(completed.id);
      if (stream != null) {
        stream.setSnapshot((snapshot) =>
          completeStream(snapshot, completed.errors),
        );
        continue;
      }

      const deferred = this.deferredForId(completed.id);
      deferred.setSnapshot((snapshot) =>
        completeDeferred(snapshot, completed.errors),
      );
      const snapshot = deferred.snapshot();
      if (snapshot.errors.length > 0) {
        deferred.reject(createGraphQLError(snapshot.errors));
      } else {
        deferred.resolve(snapshot.data);
      }
    }
  }

  connectSubsequentResults(
    subsequentResults: AsyncIterable<SubsequentResult>,
  ): void {
    onCleanup(
      consumeAsyncIterable(subsequentResults, (result) => this.apply(result)),
    );
  }

  deferredPromise<TData>(label: string, path?: ResponsePath): Promise<TData> {
    return this.deferredForId(getRequiredPendingId(this.pending, label, path))
      .promise as Promise<TData>;
  }

  stream<TItem>(
    label: string,
    path?: ResponsePath,
  ): Accessor<StreamSnapshot<TItem>> {
    return this.streamForId(getRequiredPendingId(this.pending, label, path))
      .snapshot as Accessor<StreamSnapshot<TItem>>;
  }

  private deferredForId(id: string): DeferredSignal {
    let signal = this.deferredSignals.get(id);
    if (signal == null) {
      const { promise, resolve, reject } = Promise.withResolvers<unknown>();
      const [snapshot, setSnapshot] = createSignal<DeferredSnapshot>(
        createDeferredSnapshot(),
      );
      signal = { promise, reject, resolve, setSnapshot, snapshot };
      this.deferredSignals.set(id, signal);
    }
    return signal;
  }

  private streamForId(id: string): StreamSignal {
    let signal = this.streamSignals.get(id);
    if (signal == null) {
      const [snapshot, setSnapshot] = createSignal<StreamSnapshot>(
        createStreamSnapshot(),
      );
      signal = { setSnapshot, snapshot };
      this.streamSignals.set(id, signal);
    }
    return signal;
  }
}
