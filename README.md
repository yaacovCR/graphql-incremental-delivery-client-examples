# GraphQL Incremental Delivery Client Examples

This repository is a set of reference examples for consuming GraphQL.js v17
incremental delivery results in client frameworks.

It is intentionally not a published package. The shared `examples/common/`
folder contains small protocol helpers and a fake GraphQL server function. Each
framework example owns its own reactive bridge so the code uses that framework's
normal way to sync UI with an updating external source.

These examples are rough sketches, not authoritative framework integrations.
They were written with very little expertise in several of the frameworks shown
here, so they may miss idioms, lifecycle details, or established library
patterns that experienced framework users would expect. Suggestions,
corrections, and more idiomatic versions are welcome.

## Examples

- `examples/react-server-components`: React Server Components boundary that
  consumes the GraphQL incremental stream on the server and uses Suspense to
  stream rendered Server Component chunks.
- `examples/react`: Client-only React. It starts the fake GraphQL execution in
  the browser and consumes the subsequent async iterable directly.
- `examples/vue`: Vue 3 Composition API with `provide`/`inject` and
  `shallowRef`, which is Vue's recommended primitive for integrating external
  state systems.
- `examples/svelte`: Svelte 5 components with `$props()` and local Svelte
  stores for stream/defer snapshots.
- `examples/solid`: Solid context, signals for streamed lists, and resources
  for deferred fragments.

All examples send this operation object to `fakeExecuteIncrementally`, which
stands in for the GraphQL server:

```graphql
query ProductPage {
  stuff {
    name
    ...ProductDetails @defer(label: "productDetails")
  }
  moreStuff @stream(initialCount: 0, label: "moreStuff") {
    id
    name
  }
}

fragment ProductDetails on Stuff {
  description
}
```

The important mapping is:

```text
label + path -> current operation runtime id
runtime id -> local stream/defer state
```

The label is what component code knows. The runtime `id` comes from the current
GraphQL execution and is only stable within that operation.

## Fake Execution

`examples/common/fakeExecuteIncrementally.ts` is the GraphQL server boundary for
these examples. It validates that it received the expected GraphQL operation
document, then returns a hardcoded initial result and subsequent incremental
payloads. The examples consume the `initialResult` immediately, render deferred
product details when `productDetails` completes, and render streamed
`moreStuff` payload batches as they arrive.

The React Server Components example calls this fake executor directly in the
server component and consumes the same async iterable on the server. The
client-only React, Vue, Svelte, and Solid examples consume the async iterable in
their browser-side framework bridges.

## Scripts

```bash
npm run format
npm run lint
npm run check
npm run test
npm run verify
```

`npm run verify` runs Prettier check, ESLint, TypeScript, and tests.
