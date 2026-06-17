import type { GraphQLFormattedError } from "graphql";

import { mergeValue } from "./mergeValue.ts";
import { getAtPath, setAtPath } from "./path.ts";
import type { DeferredSnapshot, ResponsePath } from "./types.ts";

export function createDeferredSnapshot<
  TData = unknown,
>(): DeferredSnapshot<TData> {
  return {
    done: false,
    errors: [],
  };
}

export function mergeDeferredData<TData>(
  snapshot: DeferredSnapshot<TData>,
  data: unknown,
  subPath?: ResponsePath,
  errors?: ReadonlyArray<GraphQLFormattedError>,
): DeferredSnapshot<TData> {
  const nextData =
    subPath === undefined
      ? mergeValue(snapshot.data, data)
      : setAtPath(
          snapshot.data,
          subPath,
          mergeValue(getAtPath(snapshot.data, subPath), data),
        );

  return {
    data: nextData as TData,
    done: snapshot.done,
    errors:
      errors === undefined ? snapshot.errors : [...snapshot.errors, ...errors],
  };
}

export function completeDeferred<TData>(
  snapshot: DeferredSnapshot<TData>,
  errors?: ReadonlyArray<GraphQLFormattedError>,
): DeferredSnapshot<TData> {
  const completed = {
    done: true,
    errors:
      errors === undefined ? snapshot.errors : [...snapshot.errors, ...errors],
  };

  return snapshot.data === undefined
    ? completed
    : {
        ...completed,
        data: snapshot.data,
      };
}
