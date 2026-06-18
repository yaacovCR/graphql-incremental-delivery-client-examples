import { createElement } from "react";
import {
  registerClientReference,
  renderToReadableStream,
} from "react-server-dom-webpack/server.node";

import { executeProductPageIncrementally } from "../../common/executeProductPageIncrementally.ts";
import { ProductPageOperation } from "../../common/ProductPageOperation.ts";
import type { ProductSummary } from "../../common/ProductPageOperation.ts";

const moduleId = new URL("../ProductSummary.client.tsx", import.meta.url).href;
const ProductSummaryCard = registerClientReference<
  (props: { summary: ProductSummary }) => null
>(() => null, moduleId, "ProductSummaryCard");

const execution = await executeProductPageIncrementally(ProductPageOperation);
const summary = execution.initialResult.data.product.summary;
const messages: Array<string> = [];

const stream = await renderToReadableStream(
  createElement(ProductSummaryCard, { summary }),
  {
    [moduleId]: {
      chunks: [],
      id: moduleId,
      name: "*",
    },
  },
  {
    onError(error) {
      messages.push(error instanceof Error ? error.message : String(error));
      return "ERR";
    },
  },
);

const decoder = new TextDecoder();
let serialized = "";
const reader = stream.getReader();
while (true) {
  const result = await reader.read();
  if (result.done) {
    break;
  }
  serialized += decoder.decode(result.value, { stream: true });
  // Keep reading so React serializes every referenced prop.
}
serialized += decoder.decode();

console.log(
  JSON.stringify({
    messages,
    serializedIncludesNullPrototypeMarker: serialized.includes("$p"),
    summaryPrototypeIsNull: Object.getPrototypeOf(summary) === null,
  }),
);
