import { isPlainObject } from "./isPlainObject.ts";

export function mergeValue(target: unknown, source: unknown): unknown {
  if (!isPlainObject(target) || !isPlainObject(source)) {
    return source;
  }

  const merged: Record<string, unknown> = { ...target };
  for (const [key, value] of Object.entries(source)) {
    merged[key] = mergeValue(merged[key], value);
  }
  return merged;
}
