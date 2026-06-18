<script lang="ts">
  import { useStream } from "./incremental";

  const recommendations = useStream<{ id: string; name: string }>(
    "recommendations",
  );
</script>

<ul>
  {#each $recommendations.batches as batch}
    {#each batch as entry (entry.item.id)}
      <li>
        {entry.item.name}
      </li>
    {/each}
  {/each}
</ul>
