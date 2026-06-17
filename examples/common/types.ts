import type { GraphQLFormattedError } from "graphql";
import type { FormattedInitialIncrementalExecutionResult } from "graphql/execution";

export type ResponsePath = ReadonlyArray<string | number>;

export type PendingResult =
  FormattedInitialIncrementalExecutionResult["pending"][number];

export interface PendingIndex {
  byId: Map<string, PendingResult>;
  idsByLabel: Map<string, Set<string>>;
  idByLabelAndPath: Map<string, string>;
}

export interface DeferredSnapshot<TData = unknown> {
  data?: TData;
  done: boolean;
  errors: ReadonlyArray<GraphQLFormattedError>;
}

export interface StreamEntry<TItem = unknown> {
  item: TItem;
  path: ResponsePath;
}

export type StreamBatch<TItem = unknown> = ReadonlyArray<StreamEntry<TItem>>;

export interface StreamSnapshot<TItem = unknown> {
  batches: ReadonlyArray<StreamBatch<TItem>>;
  done: boolean;
  errors: ReadonlyArray<GraphQLFormattedError>;
  itemCount: number;
}

export interface InitialStreamSnapshot<TItem = unknown> {
  id: string;
  path: ResponsePath;
  snapshot: StreamSnapshot<TItem>;
}
