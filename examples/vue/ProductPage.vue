<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";

import type {
  ProductPageExecution,
  ProductPageSubsequentResult,
} from "../common/executeProductPageIncrementally";
import { consumeAsyncIterable } from "../common/consumeAsyncIterable";
import { provideIncrementalClient, VueIncrementalClient } from "./incremental";
import ProductDetails from "./ProductDetails.vue";
import RecommendationsList from "./RecommendationsList.vue";

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
  <h1>{{ initialResult.data.product.name }}</h1>
  <ProductDetails />
  <RecommendationsList />
</template>
