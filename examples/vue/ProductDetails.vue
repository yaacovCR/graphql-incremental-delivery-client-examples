<script setup lang="ts">
import { useDeferredFragment } from "./incremental";

const details = useDeferredFragment<{ description: string }>("productDetails", [
  "stuff",
]);
</script>

<template>
  <p v-if="details.done">
    {{ details.data?.description }}
  </p>
  <p v-else>Loading product details...</p>
</template>
