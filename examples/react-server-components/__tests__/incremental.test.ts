import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  executeProductPageIncrementally,
  type ProductPageSubsequentResult,
} from "../../common/executeProductPageIncrementally.ts";
import { ProductPageOperation } from "../../common/ProductPageOperation.ts";
import { ReactServerIncrementalStore } from "../incremental.ts";

const streamId = "stream:recommendations";

describe("ReactServerIncrementalStore", () => {
  it("reads queued stream batches in growing reveal groups", async () => {
    const execution =
      await executeProductPageIncrementally(ProductPageOperation);
    const store = new ReactServerIncrementalStore(
      execution.initialResult,
      execution.subsequentResults,
    );

    const first = await store.nextStreamBatches<{ id: string; name: string }>(
      "recommendations",
    );
    const second = await store.nextStreamBatches<{ id: string; name: string }>(
      "recommendations",
    );
    const done = await store.nextStreamBatches("recommendations");

    assert.deepEqual(itemIds(first), ["filters"]);
    assert.deepEqual(itemIds(second), ["scale"]);
    assert.equal(done, undefined);
  });

  it("preserves multiple stream items from one payload as one batch", async () => {
    const store = createStreamStore(streamResults(["a", "b"]));

    const batches = await store.nextStreamBatches<{ id: string; name: string }>(
      "recommendations",
    );
    const done = await store.nextStreamBatches("recommendations");

    assert.equal(batches?.length, 1);
    assert.deepEqual(itemIds(batches), ["a", "b"]);
    assert.deepEqual(
      batches?.flatMap((batch) => batch.map((entry) => entry.path)),
      [
        ["recommendations", 0],
        ["recommendations", 1],
      ],
    );
    assert.equal(done, undefined);
  });

  it("coalesces one-item payloads into growing reveal groups", async () => {
    const store = createStreamStore(
      streamResults(["a"], ["b"], ["c"], ["d"], ["e"], ["f"], ["g"]),
    );

    const first = await store.nextStreamBatches<{ id: string; name: string }>(
      "recommendations",
    );
    const second = await store.nextStreamBatches<{ id: string; name: string }>(
      "recommendations",
    );
    const third = await store.nextStreamBatches<{ id: string; name: string }>(
      "recommendations",
    );
    const done = await store.nextStreamBatches("recommendations");

    assert.deepEqual(itemIds(first), ["a"]);
    assert.deepEqual(itemIds(second), ["b", "c"]);
    assert.deepEqual(itemIds(third), ["d", "e", "f", "g"]);
    assert.equal(done, undefined);
  });

  it("starts reveal growth from the first stream payload batch size", async () => {
    const store = createStreamStore(
      streamResults(["a", "b", "c"], ["d"], ["e"], ["f"], ["g"], ["h"], ["i"]),
    );

    const first = await store.nextStreamBatches<{ id: string; name: string }>(
      "recommendations",
    );
    const second = await store.nextStreamBatches<{ id: string; name: string }>(
      "recommendations",
    );
    const done = await store.nextStreamBatches("recommendations");

    assert.deepEqual(itemIds(first), ["a", "b", "c"]);
    assert.deepEqual(itemIds(second), ["d", "e", "f", "g", "h", "i"]);
    assert.equal(done, undefined);
  });

  it("returns queued stream batches before surfacing completion errors", async () => {
    const store = createStreamStore(streamErrorResult());

    const batches = await store.nextStreamBatches<{ id: string; name: string }>(
      "recommendations",
    );

    assert.deepEqual(itemIds(batches), ["a"]);
    await assert.rejects(
      () => store.nextStreamBatches("recommendations"),
      /failed/,
    );
  });

  it("resolves deferred fragments by label and response path", async () => {
    const execution =
      await executeProductPageIncrementally(ProductPageOperation);
    const store = new ReactServerIncrementalStore(
      execution.initialResult,
      execution.subsequentResults,
    );

    const details = await store.deferredFragment<{ description: string }>(
      "productDetails",
      ["product"],
    );

    assert.equal(
      details.description,
      "A countertop brewer with staged water delivery for repeatable pour-over style batches.",
    );
  });
});

function createStreamStore(
  subsequentResults: AsyncIterable<ProductPageSubsequentResult>,
): ReactServerIncrementalStore {
  return new ReactServerIncrementalStore(
    {
      data: { recommendations: [] },
      hasNext: true,
      pending: [
        {
          id: streamId,
          label: "recommendations",
          path: ["recommendations"],
        },
      ],
    },
    subsequentResults,
  );
}

async function* streamResults(
  ...batches: Array<ReadonlyArray<string>>
): AsyncIterable<ProductPageSubsequentResult> {
  for (const batch of batches) {
    await Promise.resolve();
    yield {
      hasNext: true,
      incremental: [
        {
          id: streamId,
          items: batch.map((id) => ({
            id,
            name: id.toUpperCase(),
            reason: `${id.toUpperCase()} reason`,
          })),
        },
      ],
    };
  }

  yield {
    completed: [{ id: streamId }],
    hasNext: false,
  };
}

async function* streamErrorResult(): AsyncIterable<ProductPageSubsequentResult> {
  await Promise.resolve();
  yield {
    completed: [
      {
        errors: [{ message: "Stream failed after this batch." }],
        id: streamId,
      },
    ],
    hasNext: false,
    incremental: [
      {
        id: streamId,
        items: [{ id: "a", name: "A", reason: "A reason" }],
      },
    ],
  };
}

function itemIds(
  batches: ReadonlyArray<ReadonlyArray<{ item: { id: string } }>> | undefined,
): Array<string> | undefined {
  return batches?.flatMap((batch) => batch.map((entry) => entry.item.id));
}
