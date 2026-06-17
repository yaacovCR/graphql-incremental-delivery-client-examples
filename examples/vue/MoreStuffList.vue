<script setup lang="ts">
import { useStream } from "./incremental";

const moreStuff = useStream<{ id: string; name: string }>("moreStuff");
</script>

<template>
  <ul>
    <template
      v-for="(batch, batchIndex) in moreStuff.batches"
      :key="batchIndex"
    >
      <li v-for="entry in batch" :key="entry.item.id">
        {{ entry.item.name }}
      </li>
    </template>
  </ul>
</template>
