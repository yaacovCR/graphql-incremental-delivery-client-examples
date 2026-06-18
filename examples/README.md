# Framework Examples

These examples show how each framework can consume the same GraphQL incremental
payload shape without sharing a framework-level store abstraction.

- [`react/`](./react/README.md) starts GraphQL incremental execution from a
  Client Component and consumes subsequent payloads through the async iterable
  directly.
- [`react-server-components/`](./react-server-components/README.md) consumes the
  GraphQL incremental stream on the server and uses Suspense to stream rendered
  Server Component chunks.
- [`vue/`](./vue/README.md) uses Composition API descendants with provide/inject
  and `shallowRef`.
- [`svelte/`](./svelte/README.md) uses Svelte 5 `$props()` plus Svelte stores.
- [`solid/`](./solid/README.md) uses context, `<For>`, resources, and signals.

The examples use `examples/common/executeProductPageIncrementally.ts` instead
of route boilerplate. It accepts the expected GraphQL operation document and
calls GraphQL.js `experimentalExecuteIncrementally` against a small local
schema. Each framework example consumes the same async iterable at the boundary
that makes sense for that framework.
