<script lang="ts">
  import { useDeferredFragment } from './incremental';

  const details = useDeferredFragment<{ description: string }>(
    'productDetails',
    ['stuff'],
  );
</script>

{#if $details.done}
  <p>{$details.data?.description}</p>
{:else}
  <p>Loading product details...</p>
{/if}
