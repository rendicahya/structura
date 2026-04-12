<script>
  export let fromX = 0;
  export let fromY = 0;
  export let toX = 0;
  export let toY = 0;
  export let pending = false;

  $: cx = (fromX + toX) / 2;
  $: cy = Math.min(fromY, toY) - 40;
  $: color = pending ? '#f0b429' : '#5b8fff';
  $: markerId = pending ? 'arrow-pending' : 'arrow-solid';
</script>

<g class="edge">
  <path
    d="M {fromX} {fromY} Q {cx} {cy} {toX} {toY}"
    fill="none"
    stroke={color}
    stroke-width="1.8"
    stroke-dasharray={pending ? '5 4' : 'none'}
    marker-end="url(#{markerId})"
    opacity={pending ? 0.8 : 1}
  />
</g>

<style>
  .edge { pointer-events: none; }
</style>