import {
  GraphQLDeferDirective,
  GraphQLID,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLStreamDirective,
  GraphQLString,
  parse,
  specifiedDirectives,
  validate,
} from "graphql";
import type {
  FormattedExperimentalIncrementalExecutionResults,
  FormattedSubsequentIncrementalExecutionResult,
} from "graphql/execution";
import { experimentalExecuteIncrementally } from "graphql/execution";

import {
  type GraphQLOperationRequest,
  type MoreStuff,
  type ProductDetailsData,
  type ProductPageData,
} from "./ProductPageOperation.ts";

interface ProductPageContext {
  delayMs: number;
  signal: AbortSignal;
}

interface StuffSource {
  description: string;
  name: string;
}

interface ExecuteProductPageIncrementallyOptions {
  delayMs?: number;
}

export type ProductPageSubsequentResult =
  FormattedSubsequentIncrementalExecutionResult<ProductDetailsData, MoreStuff>;

export type ProductPageExecution =
  FormattedExperimentalIncrementalExecutionResults<
    ProductPageData,
    ProductDetailsData,
    MoreStuff
  >;

const productPageData: {
  moreStuff: ReadonlyArray<MoreStuff>;
  stuff: StuffSource;
} = {
  moreStuff: [
    { id: "a", name: "First streamed item" },
    { id: "b", name: "Second streamed item" },
  ],
  stuff: {
    description: "Deferred product details.",
    name: "Initial product data",
  },
};

const MoreStuffType = new GraphQLObjectType<MoreStuff, ProductPageContext>({
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
    name: { type: new GraphQLNonNull(GraphQLString) },
  },
  name: "MoreStuff",
});

const StuffType = new GraphQLObjectType<StuffSource, ProductPageContext>({
  fields: {
    description: {
      resolve: async (source, _args, context) => {
        await waitForDeliveryDelay(context.delayMs, context.signal);
        return source.description;
      },
      type: new GraphQLNonNull(GraphQLString),
    },
    name: { type: new GraphQLNonNull(GraphQLString) },
  },
  name: "Stuff",
});

const QueryType = new GraphQLObjectType<unknown, ProductPageContext>({
  fields: {
    moreStuff: {
      resolve: (_source, _args, context) =>
        createMoreStuffStream(productPageData.moreStuff, context),
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(MoreStuffType)),
      ),
    },
    stuff: {
      resolve: () => productPageData.stuff,
      type: new GraphQLNonNull(StuffType),
    },
  },
  name: "Query",
});

const productPageSchema = new GraphQLSchema({
  directives: [
    ...specifiedDirectives,
    GraphQLDeferDirective,
    GraphQLStreamDirective,
  ],
  query: QueryType,
});

export async function executeProductPageIncrementally(
  operation: GraphQLOperationRequest,
  options: ExecuteProductPageIncrementallyOptions = {},
): Promise<ProductPageExecution> {
  const document = parse(operation.query);
  const validationErrors = validate(productPageSchema, document);
  if (validationErrors.length > 0) {
    throw new AggregateError(validationErrors, "GraphQL validation failed.");
  }

  const abortController = new AbortController();
  const result = await experimentalExecuteIncrementally({
    abortSignal: abortController.signal,
    contextValue: {
      delayMs: options.delayMs ?? 0,
      signal: abortController.signal,
    } satisfies ProductPageContext,
    document,
    enableEarlyExecution: true,
    operationName: operation.operationName,
    schema: productPageSchema,
    variableValues: operation.variables,
  });

  if (!("initialResult" in result)) {
    throw new AggregateError(
      result.errors ?? [],
      "ProductPage operation did not produce incremental results.",
    );
  }

  return {
    initialResult: result.initialResult,
    subsequentResults: withAbortOnClose(
      result.subsequentResults,
      abortController,
    ),
  } as unknown as ProductPageExecution;
}

async function* createMoreStuffStream(
  items: ReadonlyArray<MoreStuff>,
  context: ProductPageContext,
): AsyncIterable<MoreStuff> {
  for (const item of items) {
    await waitForDeliveryDelay(context.delayMs, context.signal);
    yield item;
  }
}

function withAbortOnClose<T>(
  source: AsyncIterable<T>,
  abortController: AbortController,
): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator](): AsyncIterator<T> {
      const iterator = source[Symbol.asyncIterator]();
      let closed = false;
      let closeReason: Error | undefined;

      return {
        next: async () => {
          if (closed) {
            return { done: true, value: undefined };
          }

          try {
            const result = await iterator.next();
            return closed ? { done: true, value: undefined } : result;
          } catch (error) {
            if (closed && error === closeReason) {
              return { done: true, value: undefined };
            }
            throw error;
          }
        },
        return: async () => {
          closed = true;
          closeReason = new Error("Incremental execution closed.");
          abortController.abort(closeReason);
          try {
            await iterator.return?.();
          } catch (error) {
            if (error !== closeReason) {
              throw error;
            }
          }
          return { done: true, value: undefined };
        },
        throw: async (error) => {
          closed = true;
          abortController.abort(error);
          if (iterator.throw != null) {
            return iterator.throw(error);
          }
          throw error;
        },
      };
    },
  };
}

async function waitForDeliveryDelay(
  delayMs: number,
  signal: AbortSignal,
): Promise<void> {
  if (signal.aborted) {
    throw abortReason(signal);
  }

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);

    signal.addEventListener("abort", onAbort, { once: true });

    function onAbort(): void {
      clearTimeout(timeout);
      reject(abortReason(signal));
    }
  });
}

function abortReason(signal: AbortSignal): Error {
  return signal.reason instanceof Error
    ? signal.reason
    : new Error("Incremental execution aborted.");
}
