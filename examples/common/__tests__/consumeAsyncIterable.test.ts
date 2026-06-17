import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { consumeAsyncIterable } from "../consumeAsyncIterable.ts";

describe("consumeAsyncIterable", () => {
  it("closes the iterator and ignores late values", async () => {
    const values: Array<number> = [];
    let returned = false;
    let finishNext: (() => void) | undefined;

    const stop = consumeAsyncIterable(
      {
        [Symbol.asyncIterator](): AsyncIterator<number> {
          return {
            async next() {
              await new Promise<void>((resolve) => {
                finishNext = resolve;
              });
              return { done: false, value: 1 };
            },
            return() {
              returned = true;
              finishNext?.();
              return Promise.resolve({ done: true, value: undefined });
            },
          };
        },
      },
      (value) => values.push(value),
    );

    stop();
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(returned, true);
    assert.deepEqual(values, []);
  });
});
