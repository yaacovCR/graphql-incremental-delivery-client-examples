<script lang="ts">
  import { useStream } from './incremental';

  const moreStuff = useStream<{ id: string; name: string }>('moreStuff');
</script>

<ul>
  {#each $moreStuff.batches as batch}
    {#each batch as entry (entry.item.id)}
      <li>
        {entry.item.name}
      </li>
    {/each}
  {/each}
</ul>
