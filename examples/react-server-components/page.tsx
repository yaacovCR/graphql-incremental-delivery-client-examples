import { Fragment, Suspense } from "react";

import { executeProductPageIncrementally } from "../common/executeProductPageIncrementally.ts";
import type { MoreStuff } from "../common/ProductPageOperation.ts";
import { ProductPageOperation } from "../common/ProductPageOperation.ts";
import { ReactServerIncrementalStore } from "./incremental";

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
      <h1>{execution.initialResult.data.stuff.name}</h1>
      <Suspense fallback={<p>Loading product details...</p>}>
        <ProductDetails incremental={incremental} />
      </Suspense>
      <MoreStuffList incremental={incremental} />
    </>
  );
}

function MoreStuffList(props: { incremental: ReactServerIncrementalStore }) {
  return (
    <section>
      <ul>
        <Suspense fallback={<li>Loading more...</li>}>
          <MoreStuffBatches incremental={props.incremental} />
        </Suspense>
      </ul>
    </section>
  );
}

async function MoreStuffBatches(props: {
  incremental: ReactServerIncrementalStore;
}) {
  const batches =
    await props.incremental.nextStreamBatches<MoreStuff>("moreStuff");
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
        <MoreStuffBatches incremental={props.incremental} />
      </Suspense>
    </>
  );
}

async function ProductDetails(props: {
  incremental: ReactServerIncrementalStore;
}) {
  const details = await props.incremental.deferredFragment<{
    description: string;
  }>("productDetails", ["stuff"]);

  return <p>{details.description}</p>;
}
