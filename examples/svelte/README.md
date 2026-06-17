# Svelte Example

This example uses Svelte 5 component props, Svelte context, and readable stores
for incremental snapshots.

## Shape

- `ProductPage.svelte` creates a `SvelteIncrementalClient` and places it in
  context.
- `onMount` consumes the subsequent `AsyncIterable` and applies each result.
  Cleanup closes the async iterator.
- `useStream` and `useDeferredFragment` return Svelte `Readable` stores.
- Components use `$store` syntax to render the latest stream or deferred
  snapshot.
- Product details use `@defer`; the `moreStuff` list uses `@stream`.

## Incremental Delivery Fit

Svelte stores fit the snapshot API directly. The bridge keeps writable stores
internally, exposes readable stores to components, and applies the immutable
reducer logic from `examples/common`.

The stream case is especially direct: the list component renders
`$moreStuff.batches`, while the deferred product details render from their own
store.

## Friction Points

- Like the Vue example, deferred fragments are snapshot-shaped and use explicit
  `done` checks instead of the promise/resource read shown in the React and
  Solid examples.
