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

const reader = stream.getReader();
while (!(await reader.read()).done) {
  // Keep reading so React serializes every referenced prop.
}

console.log(
  JSON.stringify({
    messages,
    summaryPrototypeIsNull: Object.getPrototypeOf(summary) === null,
  }),
);
