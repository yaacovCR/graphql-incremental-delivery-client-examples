<script setup lang="ts">
import { useStream } from "./incremental";

const recommendations = useStream<{ id: string; name: string }>(
  "recommendations",
);
</script>

<template>
  <ul>
    <template
      v-for="(batch, batchIndex) in recommendations.batches"
      :key="batchIndex"
    >
      <li v-for="entry in batch" :key="entry.item.id">
        {{ entry.item.name }}
      </li>
    </template>
  </ul>
</template>
