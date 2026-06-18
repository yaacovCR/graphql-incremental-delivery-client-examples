# GraphQL Incremental Delivery Client Examples

This repository is a set of reference examples for consuming GraphQL.js v17
incremental delivery results in client frameworks.

It is intentionally not a published package. The shared `examples/common/`
folder contains small protocol helpers and a minimal GraphQL.js execution
boundary. Each framework example owns its own reactive bridge so the code uses
that framework's normal way to sync UI with an updating external source.

These examples are rough sketches, not authoritative framework integrations.
They were written with very little expertise in several of the frameworks shown
here, so they may miss idioms, lifecycle details, or established library
patterns that experienced framework users would expect. Suggestions,
corrections, and more idiomatic versions are welcome.

## Examples

- `examples/react-server-components`: React Server Components boundary that
  consumes the GraphQL incremental stream on the server and uses Suspense to
  stream rendered Server Component chunks.
- `examples/react`: Client-only React. It starts GraphQL incremental execution
  in the browser and consumes the subsequent async iterable directly.
- `examples/vue`: Vue 3 Composition API with `provide`/`inject` and
  `shallowRef`, which is Vue's recommended primitive for integrating external
  state systems.
- `examples/svelte`: Svelte 5 components with `$props()` and local Svelte
  stores for stream/defer snapshots.
- `examples/solid`: Solid context, signals for streamed lists, and resources
  for deferred fragments.

All examples send this operation object to `executeProductPageIncrementally`,
which calls GraphQL.js `experimentalExecuteIncrementally`:

```graphql
query ProductPage {
  product {
    id
    name
    summary {
      inventoryStatus
      rating
      reviewCount
    }
    ...ProductDetails @defer(label: "productDetails")
  }
  recommendations @stream(initialCount: 0, label: "recommendations") {
    id
    name
    reason
  }
}

fragment ProductDetails on Product {
  description
  specifications {
    label
    value
  }
}
```

The important mapping is:

```text
label + path -> current operation runtime id
runtime id -> local stream/defer state
```

The label is what component code knows. The runtime `id` comes from the current
GraphQL execution and is only stable within that operation.

## Execution

`examples/common/executeProductPageIncrementally.ts` is the GraphQL execution
boundary for these examples. It parses and validates the operation document,
then calls GraphQL.js `experimentalExecuteIncrementally` against a small local
ProductPage schema. The examples consume the `initialResult` immediately,
render deferred product details when `productDetails` completes, and render
streamed `recommendations` payload batches as they arrive.

The React Server Components example calls this executor directly in the server
component and consumes the same async iterable on the server. The client-only
React, Vue, Svelte, and Solid examples consume the async iterable in their
framework bridges.

The React Server Components example also passes the initial
`product.summary` object into a Client Component. The test suite exercises that
path with `react-server-dom-webpack` and a local dependency patch for React's
null-prototype object serialization support, so the raw GraphQL.js
null-prototype object can cross the Server-to-Client boundary without being
normalized first.

## Scripts

```bash
npm run format
npm run lint
npm run check
npm run test
npm run verify
```

`npm run verify` runs Prettier check, ESLint, TypeScript, and tests.
