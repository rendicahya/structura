<script>
  import { createEventDispatcher } from 'svelte';

  export let node;
  export let selected = false;
  export let connecting = false; // this node is the source of a pending connection

  const dispatch = createEventDispatcher();

  const W = 130;
  const H = 64;

  // Ground symbol dimensions
  const gx = node.x + W / 2;
  const gy = node.y + H;
  const groundLen = 22;
  const groundLines = [
    { y: 0, w: 14 },
    { y: 6, w: 9 },
    { y: 12, w: 4 },
  ];

  function onMousedown(e) {
    if (e.button === 0) dispatch('dragstart', { e, nodeId: node.id });
  }

  function onContextMenu(e) {
    e.preventDefault();
    dispatch('contextmenu', { e, node });
  }

  function onPortMousedown(e) {
    e.stopPropagation();
    dispatch('portdragstart', { e, nodeId: node.id });
  }

  function onNodeMouseup(e) {
    dispatch('connecttarget', { e, nodeId: node.id });
  }

  $: gx2 = node.x + W / 2;
  $: gy2 = node.y + H;
  $: hasNext = !!node.nextId;
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<g
  class="node-group"
  class:selected
  class:connecting
  transform="translate({node.x}, {node.y})"
  on:mousedown={onMousedown}
  on:contextmenu={onContextMenu}
  on:mouseup={onNodeMouseup}
>
  <!-- Shadow -->
  <rect x="2" y="4" width={W} height={H} rx="10" fill="rgba(0,0,0,0.35)" />

  <!-- Main box -->
  <rect
    x="0" y="0" width={W} height={H} rx="10"
    fill="var(--node-bg)"
    stroke={selected ? 'var(--node-selected)' : connecting ? 'var(--warning)' : 'var(--node-border)'}
    stroke-width={selected || connecting ? 1.8 : 1}
  />

  <!-- Top accent bar -->
  <rect
    x="1" y="1" width={W - 2} height="3" rx="2"
    fill={selected ? 'var(--accent)' : connecting ? 'var(--warning)' : 'var(--node-border)'}
    opacity="0.7"
  />

  <!-- var name label -->
  <text
    x="12" y="22"
    font-family="var(--font-mono)"
    font-size="10"
    fill="var(--accent)"
    font-weight="500"
  >{node.varName}</text>

  <!-- divider -->
  <line x1="12" y1="28" x2={W - 12} y2="28" stroke="var(--border)" stroke-width="1"/>

  <!-- data value -->
  <text
    x={W / 2} y="50"
    text-anchor="middle"
    font-family="var(--font-mono)"
    font-size="13"
    fill={node.data ? 'var(--text)' : 'var(--text-muted)'}
    font-weight="400"
  >{node.data || 'null'}</text>

  <!-- Port dot (right side, drag to connect) -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <circle
    cx={W - 8} cy={H / 2}
    r="5"
    fill={hasNext ? 'var(--accent)' : 'var(--node-border)'}
    stroke={hasNext ? 'var(--accent-dim)' : 'var(--border-bright)'}
    stroke-width="1"
    class="port"
    on:mousedown={onPortMousedown}
  />

  <!-- Ground symbol (when no next) -->
  {#if !hasNext}
    <!-- Vertical stem down from bottom center -->
    <line
      x1={W/2} y1={H}
      x2={W/2} y2={H + groundLen}
      stroke="var(--text-muted)" stroke-width="1.5"
    />
    {#each groundLines as gl, i}
      <line
        x1={W/2 - gl.w/2} y1={H + groundLen + i * 7}
        x2={W/2 + gl.w/2} y2={H + groundLen + i * 7}
        stroke="var(--text-muted)" stroke-width="1.5"
      />
    {/each}
  {/if}
</g>

<style>
  .node-group { cursor: grab; }
  .node-group:active { cursor: grabbing; }
  .port { cursor: crosshair; }
  .node-group.selected rect:nth-child(2) {
    filter: drop-shadow(0 0 8px rgba(91,143,255,0.4));
  }
</style>