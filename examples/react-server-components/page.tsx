import { Fragment, Suspense } from "react";

import { executeProductPageIncrementally } from "../common/executeProductPageIncrementally.ts";
import type { Recommendation } from "../common/ProductPageOperation.ts";
import { ProductPageOperation } from "../common/ProductPageOperation.ts";
import { ReactServerIncrementalStore } from "./incremental";
import { ProductSummaryCard } from "./ProductSummary.client";

export default async function ProductPage() {
  const execution = await executeProductPageIncrementally(
    ProductPageOperation,
    {
      delayMs: 250,
    },
  );
  const incremental = new ReactServerIncrementalStore(
    execution.initialResult,
    execution.subsequentResults,
  );

  return (
    <>
      <h1>{execution.initialResult.data.product.name}</h1>
      <ProductSummaryCard
        summary={execution.initialResult.data.product.summary}
      />
      <Suspense fallback={<p>Loading product details...</p>}>
        <ProductDetails incremental={incremental} />
      </Suspense>
      <RecommendationsList incremental={incremental} />
    </>
  );
}

function RecommendationsList(props: {
  incremental: ReactServerIncrementalStore;
}) {
  return (
    <section>
      <ul>
        <Suspense fallback={<li>Loading more...</li>}>
          <RecommendationBatches incremental={props.incremental} />
        </Suspense>
      </ul>
    </section>
  );
}

async function RecommendationBatches(props: {
  incremental: ReactServerIncrementalStore;
}) {
  const batches =
    await props.incremental.nextStreamBatches<Recommendation>(
      "recommendations",
    );
  if (batches == null) {
    return null;
  }

  return (
    <>
      {batches.map((batch, batchIndex) => (
        <Fragment key={batchIndex}>
          {batch.map((entry) => (
            <li key={entry.item.id}>{entry.item.name}</li>
          ))}
        </Fragment>
      ))}
      <Suspense fallback={<li>Loading more...</li>}>
        <RecommendationBatches incremental={props.incremental} />
      </Suspense>
    </>
  );
}

async function ProductDetails(props: {
  incremental: ReactServerIncrementalStore;
}) {
  const details = await props.incremental.deferredFragment<{
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
