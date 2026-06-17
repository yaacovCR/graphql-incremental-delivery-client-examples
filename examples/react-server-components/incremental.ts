import type { GraphQLFormattedError } from "graphql";
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
  StreamBatch,
  StreamSnapshot,
} from "../common/types.ts";

type SubsequentResult = FormattedSubsequentIncrementalExecutionResult<object>;

type DeferredRecord<TData = unknown> = {
  promise: Promise<TData>;
  reject: (error: unknown) => void;
  resolve: (value: TData) => void;
  snapshot: DeferredSnapshot<TData>;
};

type StreamWaiter<TItem = unknown> = {
  reject: (error: unknown) => void;
  resolve: (batches: ReadonlyArray<StreamBatch<TItem>> | undefined) => void;
};

type StreamRecord<TItem = unknown> = {
  nextBatchIndex: number;
  nextRevealItemCount: number | undefined;
  path: ResponsePath;
  snapshot: StreamSnapshot<TItem>;
  waiters: Array<StreamWaiter<TItem>>;
};

const revealItemGrowthFactor = 2;

export class ReactServerIncrementalStore<TInitialData = unknown> {
  private readonly deferred = new Map<string, DeferredRecord>();
  private readonly pending: PendingIndex;
  private readonly streams = new Map<string, StreamRecord>();

  constructor(
    initialResult: FormattedInitialIncrementalExecutionResult<TInitialData>,
    subsequentResults: AsyncIterable<SubsequentResult>,
  ) {
    this.pending = createPendingIndex(initialResult.pending);

    for (const { id, path, snapshot } of createInitialStreamSnapshots<
      TInitialData,
      unknown
    >(initialResult)) {
      this.streams.set(id, {
        nextBatchIndex: 0,
        nextRevealItemCount: undefined,
        path,
        snapshot,
        waiters: [],
      });
    }

    consumeAsyncIterable(
      subsequentResults,
      (result) => this.apply(result),
      (error) => this.rejectPending(error),
    );
  }

  deferredFragment<TData>(label: string, path?: ResponsePath): Promise<TData> {
    return this.deferredForId(getRequiredPendingId(this.pending, label, path))
      .promise as Promise<TData>;
  }

  nextStreamBatches<TItem>(
    label: string,
    path?: ResponsePath,
  ): Promise<ReadonlyArray<StreamBatch<TItem>> | undefined> {
    return this.nextStreamBatchesForId<TItem>(
      getRequiredPendingId(this.pending, label, path),
    );
  }

  private apply(result: SubsequentResult): void {
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
        this.resolveStreamWaiters(stream);
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
        this.resolveStreamWaiters(stream);
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

  private nextStreamBatchesForId<TItem>(
    id: string,
  ): Promise<ReadonlyArray<StreamBatch<TItem>> | undefined> {
    const stream = this.streamForId(id);

    const batches = takeRevealBatches(stream);
    if (batches !== undefined) {
      return Promise.resolve(batches as ReadonlyArray<StreamBatch<TItem>>);
    }

    if (stream.snapshot.done) {
      if (stream.snapshot.errors.length > 0) {
        return Promise.reject(createGraphQLError(stream.snapshot.errors));
      }
      return Promise.resolve(undefined);
    }

    return new Promise<ReadonlyArray<StreamBatch<TItem>> | undefined>(
      (resolve, reject) => {
        stream.waiters.push({ reject, resolve } as StreamWaiter);
      },
    );
  }

  private rejectPending(error: unknown): void {
    for (const deferred of this.deferred.values()) {
      deferred.reject(error);
    }
    for (const stream of this.streams.values()) {
      for (const waiter of stream.waiters.splice(0)) {
        waiter.reject(error);
      }
    }
  }

  private resolveStreamWaiters(stream: StreamRecord): void {
    while (stream.waiters.length > 0) {
      const batches = takeRevealBatches(stream);
      if (batches === undefined) {
        break;
      }

      const waiter = stream.waiters.shift();
      waiter?.resolve(batches);
    }

    if (stream.snapshot.done) {
      if (stream.snapshot.errors.length > 0) {
        rejectStreamWaiters(stream, stream.snapshot.errors);
        return;
      }

      for (const waiter of stream.waiters.splice(0)) {
        waiter.resolve(undefined);
      }
    }
  }

  private streamForId(id: string): StreamRecord {
    let stream = this.streams.get(id);
    if (stream == null) {
      stream = {
        nextBatchIndex: 0,
        nextRevealItemCount: undefined,
        path: getRequiredPendingPath(this.pending, id),
        snapshot: createStreamSnapshot(),
        waiters: [],
      };
      this.streams.set(id, stream);
    }
    return stream;
  }
}

function takeRevealBatches<TItem>(
  stream: StreamRecord<TItem>,
): ReadonlyArray<StreamBatch<TItem>> | undefined {
  const targetItemCount =
    stream.nextRevealItemCount ?? firstRevealItemCount(stream);
  if (targetItemCount === undefined) {
    return undefined;
  }

  let itemCount = 0;
  let endBatchIndex = stream.nextBatchIndex;

  while (
    endBatchIndex < stream.snapshot.batches.length &&
    itemCount < targetItemCount
  ) {
    itemCount += stream.snapshot.batches[endBatchIndex]?.length ?? 0;
    endBatchIndex += 1;
  }

  if (endBatchIndex === stream.nextBatchIndex) {
    return undefined;
  }
  if (itemCount < targetItemCount && !stream.snapshot.done) {
    return undefined;
  }

  const batches = stream.snapshot.batches.slice(
    stream.nextBatchIndex,
    endBatchIndex,
  );
  stream.nextBatchIndex = endBatchIndex;
  stream.nextRevealItemCount = targetItemCount * revealItemGrowthFactor;
  return batches;
}

function firstRevealItemCount<TItem>(
  stream: StreamRecord<TItem>,
): number | undefined {
  const firstBatch = stream.snapshot.batches[stream.nextBatchIndex];
  return firstBatch === undefined ? undefined : Math.max(firstBatch.length, 1);
}

function rejectStreamWaiters(
  stream: StreamRecord,
  errors: ReadonlyArray<GraphQLFormattedError>,
): void {
  for (const waiter of stream.waiters.splice(0)) {
    waiter.reject(createGraphQLError(errors));
  }
}
