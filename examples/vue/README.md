# Vue Example

This example uses Vue 3's Composition API with `provide`/`inject` and
`shallowRef` snapshots.

## Shape

- `ProductPage.vue` creates a `VueIncrementalClient` during setup and provides
  it to descendant components.
- `onMounted` consumes the subsequent `AsyncIterable` and applies each result to
  the client. `onUnmounted` closes the async iterator.
- `useStream` and `useDeferredFragment` return readonly `ShallowRef` values.
- Components read the current stream or deferred snapshot directly in templates.
- Product details use `@defer`; the recommendations list uses `@stream`.

## Incremental Delivery Fit

Vue's `shallowRef` is a strong fit for this bridge because the shared helpers
already produce immutable stream and deferred snapshots. The bridge replaces the
whole snapshot after each payload, so Vue tracks the top-level snapshot change
without deeply proxying GraphQL result data.

The template syntax is concise for streamed lists: nested `v-for` blocks render
recommendation batches, while the deferred product details render in a separate
component.

## Friction Points

- Like the Svelte example, this bridge exposes `@defer` as snapshot state rather
  than the promise/resource read shown in the React and Solid examples.
  Components check `done` explicitly.
