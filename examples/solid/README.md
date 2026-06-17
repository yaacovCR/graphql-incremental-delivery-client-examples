# Solid Example

This example uses Solid context, signals for streamed snapshots, and resources
for deferred fragments.

## Shape

- `ProductPage.tsx` creates a `SolidIncrementalClient`, connects it to the
  subsequent `AsyncIterable`, and provides it through context.
- Stream snapshots are stored in Solid signals.
- Deferred fragments are backed by promises and exposed through
  `createResource`.
- Components render streamed batches with `<For>` and product details inside
  `<Suspense>`.
- Product details use `@defer`; the `moreStuff` list uses `@stream`.

## Incremental Delivery Fit

Solid is the browser-side example where both pieces map to Solid's reactive
primitives: stream snapshots live in signals, and deferred product details are
exposed through `createResource`.

That lets the components stay idiomatic Solid: nested `<For>` blocks render the
streamed batches, and Suspense handles the resource-backed deferred fragment.
`connectSubsequentResults` runs from `ProductPage`, so `onCleanup` ties the
async iterator lifetime to the component owner.
