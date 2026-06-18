<script lang="ts">
  import { useDeferredFragment } from "./incremental";

  const details = useDeferredFragment<{ description: string }>(
    "productDetails",
    ["product"],
  );
</script>

{#if $details.done}
  <p>{$details.data?.description}</p>
{:else}
  <p>Loading product details...</p>
{/if}
