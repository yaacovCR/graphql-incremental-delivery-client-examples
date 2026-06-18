<script lang="ts">
  import { onMount } from 'svelte';

  import type {
    ProductPageExecution,
    ProductPageSubsequentResult,
  } from '../common/executeProductPageIncrementally';
  import { consumeAsyncIterable } from '../common/consumeAsyncIterable';
  import {
    setIncrementalClient,
    SvelteIncrementalClient,
  } from './incremental';
  import MoreStuffList from './MoreStuffList.svelte';
  import ProductDetails from './ProductDetails.svelte';

  let {
    initialResult,
    subsequentResults,
  }: {
    initialResult: ProductPageExecution['initialResult'];
    subsequentResults: AsyncIterable<ProductPageSubsequentResult>;
  } = $props();

  const client = new SvelteIncrementalClient(initialResult);
  setIncrementalClient(client);

  onMount(() => {
    return consumeAsyncIterable(subsequentResults, (result) =>
      client.apply(result),
    );
  });
</script>

<h1>{initialResult.data.stuff.name}</h1>
<ProductDetails />
<MoreStuffList />
