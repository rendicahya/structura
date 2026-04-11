<script>
  import { createEventDispatcher } from 'svelte';

  export let node;
  export let selected = false;
  export let connecting = false;
  export let isHead = false;
  export let isTail = false;

  const dispatch = createEventDispatcher();

  const W = 130;
  const H = 64;

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

  $: hasNext = !!node.nextId;
  $: borderColor = selected
    ? 'var(--node-selected)'
    : connecting
    ? 'var(--warning)'
    : isHead
    ? 'var(--success)'
    : isTail
    ? '#c084fc'
    : 'var(--node-border)';
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
    stroke={borderColor}
    stroke-width={selected || connecting || isHead || isTail ? 1.8 : 1}
  />

  <!-- Top accent bar -->
  <rect
    x="1" y="1" width={W - 2} height="3" rx="2"
    fill={isHead ? 'var(--success)' : isTail ? '#c084fc' : selected ? 'var(--accent)' : connecting ? 'var(--warning)' : 'var(--node-border)'}
    opacity="0.8"
  />

  <!-- head / tail badge -->
  {#if isHead}
    <rect x={W - 38} y="6" width="30" height="14" rx="4" fill="rgba(78,204,163,0.15)" />
    <text x={W - 23} y="16.5" text-anchor="middle" font-family="var(--font-mono)" font-size="8" fill="var(--success)" font-weight="700" letter-spacing="0.5">HEAD</text>
  {/if}
  {#if isTail}
    <rect x={W - 38} y={isHead ? 22 : 6} width="30" height="14" rx="4" fill="rgba(192,132,252,0.15)" />
    <text x={W - 23} y={isHead ? 32.5 : 16.5} text-anchor="middle" font-family="var(--font-mono)" font-size="8" fill="#c084fc" font-weight="700" letter-spacing="0.5">TAIL</text>
  {/if}

  <!-- var name label — centered -->
  <text
    x={W / 2} y="22"
    text-anchor="middle"
    font-family="var(--font-mono)"
    font-size="10"
    fill="var(--accent)"
    font-weight="500"
  >{node.varName}</text>

  <!-- divider -->
  <line x1="12" y1="28" x2={W - 12} y2="28" stroke="var(--border)" stroke-width="1"/>

  <!-- data value — bright white -->
  <text
    x={W / 2} y="50"
    text-anchor="middle"
    font-family="var(--font-mono)"
    font-size="13"
    fill={node.data ? '#ffffff' : 'var(--text-muted)'}
    font-weight={node.data ? '500' : '400'}
  >{node.data || 'null'}</text>

  <!-- Port dot -->
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

  <!-- Ground symbol -->
  {#if !hasNext}
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
</style>