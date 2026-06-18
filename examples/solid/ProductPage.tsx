/* @jsxImportSource solid-js */
import { For, Suspense } from "solid-js";
import type { ProductPageExecution } from "../common/executeProductPageIncrementally.ts";
import {
  IncrementalClientContext,
  SolidIncrementalClient,
  useDeferredFragment,
  useStream,
} from "./incremental";

export function ProductPage(props: ProductPageExecution) {
  const client = new SolidIncrementalClient(props.initialResult);
  client.connectSubsequentResults(props.subsequentResults);

  return (
    <IncrementalClientContext.Provider value={client}>
      <h1>{props.initialResult.data.stuff.name}</h1>
      <Suspense fallback={<p>Loading product details...</p>}>
        <ProductDetails />
      </Suspense>
      <MoreStuffList />
    </IncrementalClientContext.Provider>
  );
}

function MoreStuffList() {
  const stream = useStream<{ id: string; name: string }>("moreStuff");

  return (
    <ul>
      <For each={stream().batches}>
        {(batch) => (
          <For each={batch}>{(entry) => <li>{entry.item.name}</li>}</For>
        )}
      </For>
    </ul>
  );
}

function ProductDetails() {
  const details = useDeferredFragment<{ description: string }>(
    "productDetails",
    ["stuff"],
  );

  return <p>{details()?.description}</p>;
}
