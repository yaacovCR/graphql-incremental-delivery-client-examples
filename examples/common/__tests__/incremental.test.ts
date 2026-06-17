import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FormattedInitialIncrementalExecutionResult } from "graphql/execution";

import { completeDeferred, mergeDeferredData } from "../deferred.ts";
import {
  createPendingIndex,
  getPendingId,
  getPendingPath,
  getRequiredPendingId,
  getRequiredPendingPath,
  registerPending,
  registerPendingResults,
} from "../pending.ts";
import {
  appendStreamItems,
  completeStream,
  createInitialStreamSnapshot,
  createInitialStreamSnapshots,
  createStreamSnapshot,
  initialStreamBatch,
} from "../stream.ts";
import type { DeferredSnapshot, StreamSnapshot } from "../types.ts";

describe("incremental payload helpers", () => {
  it("indexes pending entries by label and path", () => {
    const index = createPendingIndex();

    registerPending(index, { id: "0", label: "details", path: ["feed", 0] });
    registerPending(index, { id: "1", label: "details", path: ["feed", 1] });

    assert.equal(getPendingId(index, "details", ["feed", 1]), "1");
    assert.equal(getRequiredPendingId(index, "details", ["feed", 1]), "1");
    assert.deepEqual(getPendingPath(index, "1"), ["feed", 1]);
    assert.deepEqual(getRequiredPendingPath(index, "1"), ["feed", 1]);
    assert.throws(() => getPendingId(index, "details"), /matched 2/);
    assert.throws(
      () => getRequiredPendingId(index, "missing"),
      /No pending entry found/,
    );
    assert.throws(
      () => getRequiredPendingPath(index, "missing"),
      /No pending entry found/,
    );
  });

  it("registers pending result arrays", () => {
    const index = createPendingIndex([
      { id: "0", label: "details", path: ["feed", 0] },
    ]);

    assert.equal(getPendingId(index, "details", ["feed", 0]), "0");

    registerPendingResults(index, [
      { id: "1", label: "details", path: ["feed", 1] },
    ]);

    assert.equal(getPendingId(index, "details", ["feed", 1]), "1");
  });

  it("creates an initial stream batch from initial result data", () => {
    const initialResult: FormattedInitialIncrementalExecutionResult<{
      feed: Array<{ id: string }>;
    }> = {
      data: { feed: [{ id: "a" }] },
      hasNext: true,
      pending: [{ id: "0", label: "feed", path: ["feed"] }],
    };

    assert.deepEqual(initialStreamBatch(initialResult, ["feed"]), [
      { item: { id: "a" }, path: ["feed", 0] },
    ]);
  });

  it("creates initial stream snapshots only for list paths", () => {
    const initialResult: FormattedInitialIncrementalExecutionResult<{
      feed: Array<{ id: string }>;
      item: { id: string };
    }> = {
      data: { feed: [], item: { id: "a" } },
      hasNext: true,
      pending: [
        { id: "0", label: "feed", path: ["feed"] },
        { id: "1", label: "item", path: ["item"] },
      ],
    };

    assert.deepEqual(createInitialStreamSnapshot(initialResult, ["feed"]), {
      batches: [],
      done: false,
      errors: [],
      itemCount: 0,
    });
    assert.equal(
      createInitialStreamSnapshot(initialResult, ["item"]),
      undefined,
    );
    assert.deepEqual(createInitialStreamSnapshots(initialResult), [
      {
        id: "0",
        path: ["feed"],
        snapshot: {
          batches: [],
          done: false,
          errors: [],
          itemCount: 0,
        },
      },
    ]);
  });

  it("appends stream items as a new batch", () => {
    const before: StreamSnapshot<{ id: string }> = createStreamSnapshot([
      { item: { id: "a" }, path: ["feed", 0] },
    ]);

    const after = appendStreamItems(before, ["feed"], [{ id: "b" }]);

    assert.notEqual(after.batches, before.batches);
    assert.deepEqual(after.batches, [
      [{ item: { id: "a" }, path: ["feed", 0] }],
      [{ item: { id: "b" }, path: ["feed", 1] }],
    ]);
    assert.equal(after.itemCount, 2);
  });

  it("merges deferred subPath payloads into deferred snapshots", () => {
    const before: DeferredSnapshot = {
      done: false,
      errors: [],
    };

    const after = mergeDeferredData(before, { id: "2" }, ["friends", 0]);

    assert.deepEqual(after, {
      data: { friends: [{ id: "2" }] },
      done: false,
      errors: [],
    });
  });

  it("marks snapshots complete without mutating previous snapshots", () => {
    const streamBefore: StreamSnapshot = createStreamSnapshot();
    const deferredBefore: DeferredSnapshot = {
      done: false,
      errors: [],
    };

    const streamAfter = completeStream(streamBefore);
    const deferredAfter = completeDeferred(deferredBefore);

    assert.equal(streamBefore.done, false);
    assert.equal(deferredBefore.done, false);
    assert.equal(streamAfter.done, true);
    assert.equal(deferredAfter.done, true);
  });
});
