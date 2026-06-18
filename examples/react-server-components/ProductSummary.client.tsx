"use client";

import type { ProductSummary } from "../common/ProductPageOperation.ts";

export function ProductSummaryCard(props: { summary: ProductSummary }) {
  return (
    <aside>
      <strong>{props.summary.inventoryStatus}</strong>
      <p>
        {props.summary.rating.toFixed(1)} from{" "}
        {props.summary.reviewCount.toLocaleString()} reviews
      </p>
    </aside>
  );
}
