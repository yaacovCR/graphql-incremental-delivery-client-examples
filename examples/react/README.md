# React Client Example

This example starts GraphQL incremental execution from a Client Component and
consumes the subsequent incremental results through an `AsyncIterable`.

## Shape

- `ProductPage.tsx` starts
  `executeProductPageIncrementally(ProductPageOperation)` and reads the initial
  execution promise with React `use()`.
- `IncrementalProvider` creates a `ReactIncrementalStore` and applies each
  subsequent result in an effect. Cleanup closes the async iterator.
- Streamed lists are exposed through `useSyncExternalStore`.
- Deferred fragments are exposed as promises and read with React `use()`, so
  colocated `<Suspense>` boundaries handle loading.
- Product details use `@defer`; the recommendations list uses `@stream`.

## Incremental Delivery Fit

React can read the deferred fragment promise directly with `use()`.
`ProductDetails` does that, so the loading UI is colocated as a Suspense
fallback instead of checking a `done` flag in the component.

For `@stream`, this example uses `useSyncExternalStore`, which is React's
purpose-built API for subscribing to mutable state owned outside React. Each
GraphQL stream payload becomes one store publish, and the component renders
`stream.batches` so GraphQL payload boundaries are preserved instead of
flattened on every update.
