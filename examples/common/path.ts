import type { ResponsePath } from "./types.ts";
import { isPlainObject } from "./isPlainObject.ts";

export function getAtPath(value: unknown, path: ResponsePath): unknown {
  let current = value;
  for (const segment of path) {
    if (current == null || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string | number, unknown>)[segment];
  }
  return current;
}

export function setAtPath(
  value: unknown,
  path: ResponsePath,
  data: unknown,
): unknown {
  if (path.length === 0) {
    return data;
  }

  const head = path[0] as string | number;
  const container = cloneContainer(value, head);
  const record = container as Record<string | number, unknown>;
  record[head] = setAtPath(record[head], path.slice(1), data);
  return container;
}

function cloneContainer(value: unknown, nextSegment: string | number): unknown {
  if (Array.isArray(value)) {
    return value.slice();
  }
  if (isPlainObject(value)) {
    return { ...value };
  }
  return typeof nextSegment === "number" ? [] : {};
}
