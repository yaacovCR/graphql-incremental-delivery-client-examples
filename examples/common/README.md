# Common Example Helpers

This folder contains the shared GraphQL incremental delivery helpers used by
the framework examples. It intentionally stops at protocol-level utilities and
does not define a framework store abstraction.

## Files

- `ProductPageOperation.ts` defines the example GraphQL operation, the operation
  request shape, and the TypeScript data types used by the examples.
- `executeProductPageIncrementally.ts` is the GraphQL execution boundary. It
  parses and validates the operation, then calls GraphQL.js
  `experimentalExecuteIncrementally` against a small local ProductPage schema.
- `consumeAsyncIterable.ts` consumes an async iterable and returns a cleanup
  function that closes the underlying iterator.
- `createGraphQLError.ts` converts GraphQL formatted errors into an
  `AggregateError` for promise-based framework integrations.
- `types.ts` contains shared snapshot and response path types.
- `pending.ts` indexes GraphQL incremental `pending` entries and resolves
  between runtime ids, labels, and response paths.
- `stream.ts` builds and updates immutable, batch-preserving stream snapshots,
  including the initial stream snapshot from the initial execution result.
- `deferred.ts` builds and updates immutable deferred fragment snapshots.
- `path.ts` reads and writes nested response data by GraphQL response path.
- `mergeValue.ts` merges plain object payloads without mutating previous
  snapshots.
- `isPlainObject.ts` is the small structural predicate used by merge and path
  helpers.
- `__tests__/` contains colocated tests for the execution boundary and shared
  incremental payload helpers.

## Design Boundary

The shared helpers know about GraphQL incremental result shapes:

```text
label + path -> current operation runtime id
runtime id -> local stream/defer snapshot
```

The framework examples own everything reactive:

- React owns promises, Suspense, and `useSyncExternalStore`.
- Vue owns `shallowRef`.
- Svelte owns stores.
- Solid owns signals and resources.

That split keeps the repeated GraphQL protocol logic in one place while letting
each bridge use the framework's normal primitives.

Stream snapshots intentionally store `batches` as arrays of GraphQL payload
batches. Appending a payload creates one new inner batch and one new outer
`batches` array, so renderers can preserve payload boundaries without copying a
flat list of every streamed item on each update.
