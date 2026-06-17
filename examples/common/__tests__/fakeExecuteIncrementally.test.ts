import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { fakeExecuteIncrementally } from "../fakeExecuteIncrementally.ts";
import { ProductPageOperation } from "../ProductPageOperation.ts";

describe("fakeExecuteIncrementally", () => {
  it("returns the hardcoded ProductPage incremental execution", async () => {
    const execution = await fakeExecuteIncrementally(ProductPageOperation);
    const subsequentResults = [];

    for await (const result of execution.subsequentResults) {
      subsequentResults.push(result);
    }

    assert.equal(
      execution.initialResult.data.stuff.name,
      "Initial product data",
    );
    assert.deepEqual(
      execution.initialResult.pending.map((pending) => pending.label),
      ["productDetails", "moreStuff"],
    );
    assert.equal(subsequentResults.length, 3);
    assert.equal(subsequentResults.at(-1)?.hasNext, false);
  });

  it("closes the subsequent async iterable without waiting for pending delay", async () => {
    const execution = await fakeExecuteIncrementally(ProductPageOperation, {
      delayMs: 100,
    });
    const iterator = execution.subsequentResults[Symbol.asyncIterator]();
    const pending = iterator.next();

    await iterator.return?.();

    await assert.doesNotReject(timeout(pending, 50));
    assert.deepEqual(await pending, { done: true, value: undefined });
  });

  it("fails for any unexpected operation document", async () => {
    await assert.rejects(
      fakeExecuteIncrementally({
        operationName: "OtherQuery",
        query: "query OtherQuery { stuff { name } }",
      }),
      /Expected GraphQL operationName/,
    );
  });
});

async function timeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Timed out.")), ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}
