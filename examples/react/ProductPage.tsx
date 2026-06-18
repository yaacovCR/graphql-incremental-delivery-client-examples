"use client";

import { Fragment, Suspense, use } from "react";

import { executeProductPageIncrementally } from "../common/executeProductPageIncrementally.ts";
import {
  type Recommendation,
  ProductPageOperation,
} from "../common/ProductPageOperation.ts";
import {
  IncrementalProvider,
  useDeferredFragment,
  useStream,
} from "./incremental";

const executionPromise = executeProductPageIncrementally(ProductPageOperation, {
  delayMs: 250,
});

export function ProductPage() {
  return (
    <Suspense fallback={<p>Loading page...</p>}>
      <ProductPageContent />
    </Suspense>
  );
}

function ProductPageContent() {
  const execution = use(executionPromise);

  return (
    <IncrementalProvider
      initialResult={execution.initialResult}
      subsequentResults={execution.subsequentResults}
    >
      <h1>{execution.initialResult.data.product.name}</h1>
      <Suspense fallback={<p>Loading product details...</p>}>
        <ProductDetails />
      </Suspense>
      <RecommendationsList />
    </IncrementalProvider>
  );
}

function RecommendationsList() {
  const stream = useStream<Recommendation>("recommendations");

  return (
    <section>
      <ul>
        {stream.batches.map((batch, batchIndex) => (
          <Fragment key={batchIndex}>
            {batch.map((entry) => (
              <li key={entry.item.id}>{entry.item.name}</li>
            ))}
          </Fragment>
        ))}
      </ul>
      {!stream.done && <p>Loading more...</p>}
    </section>
  );
}

function ProductDetails() {
  const details = useDeferredFragment<{
    description: string;
    specifications: Array<{ label: string; value: string }>;
  }>("productDetails", ["product"]);

  return (
    <section>
      <p>{details.description}</p>
      <dl>
        {details.specifications.map((specification) => (
          <Fragment key={specification.label}>
            <dt>{specification.label}</dt>
            <dd>{specification.value}</dd>
          </Fragment>
        ))}
      </dl>
    </section>
  );
}
