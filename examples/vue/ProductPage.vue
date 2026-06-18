<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";

import type {
  ProductPageExecution,
  ProductPageSubsequentResult,
} from "../common/executeProductPageIncrementally";
import { consumeAsyncIterable } from "../common/consumeAsyncIterable";
import { provideIncrementalClient, VueIncrementalClient } from "./incremental";
import MoreStuffList from "./MoreStuffList.vue";
import ProductDetails from "./ProductDetails.vue";

const props = defineProps<{
  initialResult: ProductPageExecution["initialResult"];
  subsequentResults: AsyncIterable<ProductPageSubsequentResult>;
}>();

const client = new VueIncrementalClient(props.initialResult);
provideIncrementalClient(client);

let stopConsuming: (() => void) | undefined;

onMounted(() => {
  stopConsuming = consumeAsyncIterable(props.subsequentResults, (result) =>
    client.apply(result),
  );
});

onUnmounted(() => {
  stopConsuming?.();
});
</script>

<template>
  <h1>{{ initialResult.data.stuff.name }}</h1>
  <ProductDetails />
  <MoreStuffList />
</template>
