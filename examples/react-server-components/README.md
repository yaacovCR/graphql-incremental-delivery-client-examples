# React Server Components Example

This example models a React Server Components boundary. The server component
starts the fake GraphQL execution, keeps the GraphQL incremental stream on the
server, and uses Suspense to stream rendered Server Component chunks.

## Shape

- `page.tsx` runs `fakeExecuteIncrementally(ProductPageOperation)` on the server.
- `incremental.ts` contains the server-side incremental store. It consumes the
  GraphQL `AsyncIterable` and resolves pending stream batches or deferred
  fragments as payloads arrive.
- `MoreStuffBatches` suspends until the next server reveal group exists,
  renders the GraphQL `@stream` payload batches in that group, then recursively
  renders another suspended `MoreStuffBatches`.
- `ProductDetails` suspends until the separate `productDetails` `@defer`
  fragment completes.
- No raw GraphQL incremental payload crosses into a Client Component.

## Incremental Delivery Fit

This example is the only one that does not expose raw incremental payloads to a
browser-side bridge. The server consumes the GraphQL `AsyncIterable`, and React
Suspense streams rendered Server Component output.

`@defer` maps directly to an async Server Component read. `@stream` is modeled
as batches, not individual items: the store preserves GraphQL payload batches,
and the Server Component renders one or more payload batches per Suspense
reveal.

## Friction Points

- A recursive Suspense shape can create too many nested boundaries if it reveals
  every small `@stream` payload separately. This example resolves that by
  buffering payload batches into geometric reveal groups: the first reveal uses
  the first payload batch size, then each subsequent reveal target doubles. That
  keeps boundary growth logarithmic for finite streamed lists while preserving
  the original GraphQL payload batches inside each reveal.
