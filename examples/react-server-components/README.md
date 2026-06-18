# React Server Components Example

This example models a React Server Components boundary. The server component
starts GraphQL incremental execution, keeps the GraphQL incremental stream on
the server, and uses Suspense to stream rendered Server Component chunks.

## Shape

- `page.tsx` runs `executeProductPageIncrementally(ProductPageOperation)` on
  the server.
- `ProductSummary.client.tsx` is a Client Component that receives
  `initialResult.data.product.summary` as an object prop from the Server
  Component.
- `incremental.ts` contains the server-side incremental store. It consumes the
  GraphQL `AsyncIterable` and resolves pending stream batches or deferred
  fragments as payloads arrive.
- `RecommendationBatches` suspends until the next recommendation reveal group exists,
  renders the GraphQL `@stream` payload batches in that group, then recursively
  renders another suspended `RecommendationBatches`.
- `ProductDetails` suspends until the separate `productDetails` `@defer`
  fragment completes.

## Incremental Delivery Fit

This example is the only one that does not expose raw incremental payloads to a
browser-side bridge. The server consumes the GraphQL `AsyncIterable`, and React
Suspense streams rendered Server Component output.

`@defer` maps directly to an async Server Component read. `@stream` is modeled
as batches, not individual items: the store preserves GraphQL payload batches,
and the Server Component renders one or more payload batches per Suspense
reveal.

## Friction Points

- GraphQL.js execution result objects have null prototypes. Passing
  `product.summary` directly to `ProductSummaryCard` crosses the RSC
  Server-to-Client boundary with one of those objects. The
  `rsc-boundary.test.ts` fixture runs the real React Server Components
  serializer and confirms React rejects that value with the "Classes or null
  prototypes are not supported" error.
- A recursive Suspense shape can create too many nested boundaries if it reveals
  every small `@stream` payload separately. This example resolves that by
  buffering payload batches into geometric reveal groups: the first reveal uses
  the first payload batch size, then each subsequent reveal target doubles. That
  keeps boundary growth logarithmic for finite streamed lists while preserving
  the original GraphQL payload batches inside each reveal.
