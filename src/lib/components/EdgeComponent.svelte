<script>
  export let fromX = 0;
  export let fromY = 0;
  export let toX = 0;
  export let toY = 0;
  export let pending = false;

  // Control point for curve
  $: cx = (fromX + toX) / 2;
  $: cy = Math.min(fromY, toY) - 40;
</script>

<g class="edge" class:pending>
  <defs>
    <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill={pending ? '#f0b429' : '#5b8fff'} />
    </marker>
  </defs>
  <path
    d="M {fromX} {fromY} Q {cx} {cy} {toX} {toY}"
    fill="none"
    stroke={pending ? '#f0b429' : '#5b8fff'}
    stroke-width="1.8"
    stroke-dasharray={pending ? '5 4' : 'none'}
    marker-end="url(#arrowhead)"
    opacity={pending ? 0.7 : 1}
  />
</g>

<style>
  .edge { pointer-events: none; }
</style>