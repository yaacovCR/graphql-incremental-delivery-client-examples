import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { executeProductPageIncrementally } from "../executeProductPageIncrementally.ts";
import { ProductPageOperation } from "../ProductPageOperation.ts";

describe("executeProductPageIncrementally", () => {
  it("returns the real ProductPage incremental execution", async () => {
    const execution =
      await executeProductPageIncrementally(ProductPageOperation);
    const subsequentResults = [];

    for await (const result of execution.subsequentResults) {
      subsequentResults.push(result);
    }

    assert.equal(
      execution.initialResult.data.product.name,
      "Incremental Coffee Brewer",
    );
    assert.deepEqual(
      execution.initialResult.pending.map((pending) => pending.label),
      ["productDetails", "recommendations"],
    );
    assert.equal(subsequentResults.length, 3);
    assert.equal(subsequentResults.at(-1)?.hasNext, false);
  });

  it("does not normalize GraphQL.js null-prototype result objects", async () => {
    const execution =
      await executeProductPageIncrementally(ProductPageOperation);
    const subsequentResults = [];

    for await (const result of execution.subsequentResults) {
      subsequentResults.push(result);
    }

    const deferredPayload = subsequentResults
      .flatMap((result) => result.incremental ?? [])
      .find((payload) => "data" in payload);
    const streamedPayload = subsequentResults
      .flatMap((result) => result.incremental ?? [])
      .find((payload) => "items" in payload);

    assert.equal(Object.getPrototypeOf(execution.initialResult.data), null);
    assert.equal(
      Object.getPrototypeOf(execution.initialResult.data.product),
      null,
    );
    assert.equal(
      Object.getPrototypeOf(execution.initialResult.data.product.summary),
      null,
    );
    assert.ok(deferredPayload != null && "data" in deferredPayload);
    assert.equal(Object.getPrototypeOf(deferredPayload.data), null);
    assert.ok(streamedPayload != null && "items" in streamedPayload);
    assert.equal(Object.getPrototypeOf(streamedPayload.items[0]), null);
  });

  it("closes the subsequent async iterable without waiting for pending delay", async () => {
    const execution = await executeProductPageIncrementally(
      ProductPageOperation,
      {
        delayMs: 100,
      },
    );
    const iterator = execution.subsequentResults[Symbol.asyncIterator]();
    const pending = iterator.next();

    await iterator.return?.();

    await assert.doesNotReject(timeout(pending, 50));
    assert.deepEqual(await pending, { done: true, value: undefined });
  });

  it("fails for any unexpected operation document", async () => {
    await assert.rejects(
      executeProductPageIncrementally({
        operationName: "OtherQuery",
        query: "query OtherQuery { stuff { name } }",
      }),
      /GraphQL validation failed/,
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
