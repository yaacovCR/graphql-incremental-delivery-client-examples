import type {
  FormattedInitialIncrementalExecutionResult,
  FormattedSubsequentIncrementalExecutionResult,
} from "graphql/execution";

import {
  type GraphQLOperationRequest,
  type MoreStuff,
  type ProductDetailsData,
  type ProductPageData,
  ProductPageOperation,
} from "./ProductPageOperation.ts";

export type ProductPageSubsequentResult =
  FormattedSubsequentIncrementalExecutionResult<ProductDetailsData, MoreStuff>;

export interface ProductPageExecution {
  initialResult: FormattedInitialIncrementalExecutionResult<ProductPageData>;
  subsequentResults: AsyncIterable<ProductPageSubsequentResult>;
}

interface FakeExecuteIncrementallyOptions {
  delayMs?: number;
}

export function fakeExecuteIncrementally(
  operation: GraphQLOperationRequest,
  options: FakeExecuteIncrementallyOptions = {},
): Promise<ProductPageExecution> {
  try {
    assertExpectedOperation(operation);
  } catch (error) {
    return Promise.reject(
      error instanceof Error ? error : new Error(String(error)),
    );
  }

  const delayMs = options.delayMs ?? 0;
  const payloads = createSubsequentPayloads();

  return Promise.resolve({
    initialResult: createInitialResult(),
    subsequentResults: createSubsequentResults(payloads, delayMs),
  });
}

function assertExpectedOperation(operation: GraphQLOperationRequest): void {
  if (operation.operationName !== ProductPageOperation.operationName) {
    throw new Error('Expected GraphQL operationName "ProductPage".');
  }

  if (
    normalizeGraphQL(operation.query) !==
    normalizeGraphQL(ProductPageOperation.query)
  ) {
    throw new Error("Unexpected GraphQL operation document.");
  }

  if (
    operation.variables !== undefined &&
    Object.keys(operation.variables).length > 0
  ) {
    throw new Error(
      "The fake ProductPage operation does not accept variables.",
    );
  }
}

function createInitialResult(): FormattedInitialIncrementalExecutionResult<ProductPageData> {
  return {
    data: {
      moreStuff: [],
      stuff: { name: "Initial product data" },
    },
    hasNext: true,
    pending: [
      { id: "defer:productDetails", label: "productDetails", path: ["stuff"] },
      { id: "stream:moreStuff", label: "moreStuff", path: ["moreStuff"] },
    ],
  };
}

function createSubsequentResults(
  payloads: ReadonlyArray<ProductPageSubsequentResult>,
  delayMs: number,
): AsyncIterable<ProductPageSubsequentResult> {
  return {
    [Symbol.asyncIterator](): AsyncIterator<ProductPageSubsequentResult> {
      let closed = false;
      let index = 0;
      let finishPendingDelay: (() => void) | undefined;

      return {
        async next(): Promise<IteratorResult<ProductPageSubsequentResult>> {
          if (closed || index >= payloads.length) {
            return { done: true, value: undefined };
          }

          const payload = payloads[index];
          index += 1;
          await waitForIteratorDelay(delayMs, (finish) => {
            finishPendingDelay = finish;
          });
          finishPendingDelay = undefined;

          if (closed || payload === undefined) {
            return { done: true, value: undefined };
          }
          return { done: false, value: payload };
        },
        return(): Promise<IteratorResult<ProductPageSubsequentResult>> {
          closed = true;
          finishPendingDelay?.();
          return Promise.resolve({ done: true, value: undefined });
        },
      };
    },
  };
}

async function waitForIteratorDelay(
  delayMs: number,
  onPending: (finish: () => void) => void,
): Promise<void> {
  if (delayMs === 0) {
    return;
  }

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, delayMs);
    onPending(() => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

function createSubsequentPayloads(): ReadonlyArray<ProductPageSubsequentResult> {
  return [
    {
      hasNext: true,
      incremental: [
        {
          data: { description: "Deferred product details." },
          id: "defer:productDetails",
        },
      ],
      completed: [{ id: "defer:productDetails" }],
    },
    {
      hasNext: true,
      incremental: [
        {
          id: "stream:moreStuff",
          items: [{ id: "a", name: "First streamed item" }],
        },
      ],
    },
    {
      hasNext: false,
      incremental: [
        {
          id: "stream:moreStuff",
          items: [{ id: "b", name: "Second streamed item" }],
        },
      ],
      completed: [{ id: "stream:moreStuff" }],
    },
  ];
}

function normalizeGraphQL(query: string): string {
  return query.replace(/\s+/g, " ").trim();
}
