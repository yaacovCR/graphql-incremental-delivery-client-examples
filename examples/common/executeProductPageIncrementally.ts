import {
  GraphQLDeferDirective,
  GraphQLFloat,
  GraphQLID,
  GraphQLInt,
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
  type Product,
  type ProductDetailsData,
  type ProductPageData,
  type ProductSpecification,
  type ProductSummary,
  type Recommendation,
} from "./ProductPageOperation.ts";

interface ProductPageContext {
  delayMs: number;
  signal: AbortSignal;
}

interface ExecuteProductPageIncrementallyOptions {
  delayMs?: number;
}

export type ProductPageSubsequentResult =
  FormattedSubsequentIncrementalExecutionResult<
    ProductDetailsData,
    Recommendation
  >;

export type ProductPageExecution =
  FormattedExperimentalIncrementalExecutionResults<
    ProductPageData,
    ProductDetailsData,
    Recommendation
  >;

const productPageData: {
  product: Product & ProductDetailsData;
  recommendations: ReadonlyArray<Recommendation>;
} = {
  product: {
    description:
      "A countertop brewer with staged water delivery for repeatable pour-over style batches.",
    id: "brewer-01",
    name: "Incremental Coffee Brewer",
    specifications: [
      { label: "Brew modes", value: "Classic, bloom, cold brew" },
      { label: "Carafe", value: "1.2L thermal" },
    ],
    summary: {
      inventoryStatus: "Ready to ship",
      rating: 4.8,
      reviewCount: 128,
    },
  },
  recommendations: [
    {
      id: "filters",
      name: "Reusable filter set",
      reason: "Sized for the brewer basket.",
    },
    {
      id: "scale",
      name: "Precision coffee scale",
      reason: "Pairs with bloom timing.",
    },
  ],
};

const ProductSummaryType = new GraphQLObjectType<
  ProductSummary,
  ProductPageContext
>({
  fields: {
    inventoryStatus: { type: new GraphQLNonNull(GraphQLString) },
    rating: { type: new GraphQLNonNull(GraphQLFloat) },
    reviewCount: { type: new GraphQLNonNull(GraphQLInt) },
  },
  name: "ProductSummary",
});

const ProductSpecificationType = new GraphQLObjectType<
  ProductSpecification,
  ProductPageContext
>({
  fields: {
    label: { type: new GraphQLNonNull(GraphQLString) },
    value: { type: new GraphQLNonNull(GraphQLString) },
  },
  name: "ProductSpecification",
});

const ProductType = new GraphQLObjectType<
  Product & ProductDetailsData,
  ProductPageContext
>({
  fields: {
    description: {
      resolve: async (source, _args, context) => {
        await waitForDeliveryDelay(context.delayMs, context.signal);
        return source.description;
      },
      type: new GraphQLNonNull(GraphQLString),
    },
    id: { type: new GraphQLNonNull(GraphQLID) },
    name: { type: new GraphQLNonNull(GraphQLString) },
    specifications: {
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(ProductSpecificationType)),
      ),
    },
    summary: { type: new GraphQLNonNull(ProductSummaryType) },
  },
  name: "Product",
});

const RecommendationType = new GraphQLObjectType<
  Recommendation,
  ProductPageContext
>({
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
    name: { type: new GraphQLNonNull(GraphQLString) },
    reason: { type: new GraphQLNonNull(GraphQLString) },
  },
  name: "Recommendation",
});

const QueryType = new GraphQLObjectType<unknown, ProductPageContext>({
  fields: {
    product: {
      resolve: () => productPageData.product,
      type: new GraphQLNonNull(ProductType),
    },
    recommendations: {
      resolve: (_source, _args, context) =>
        createRecommendationStream(productPageData.recommendations, context),
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(RecommendationType)),
      ),
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

async function* createRecommendationStream(
  items: ReadonlyArray<Recommendation>,
  context: ProductPageContext,
): AsyncIterable<Recommendation> {
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
