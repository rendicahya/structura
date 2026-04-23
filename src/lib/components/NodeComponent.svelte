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

  // Badge dimensions
  const BADGE_W = 40;
  const BADGE_H = 20;
  const BADGE_GAP = 10; // gap between badge bottom and node top
  const ARROW_LEN = BADGE_GAP;

  function onMousedown(e) {
    if (e.button === 0) dispatch('dragstart', { e, nodeId: node.id });
  }
  function onContextMenu(e) {
    e.preventDefault();
    e.stopPropagation();
    dispatch('contextmenu', { e, node });
  }
  function onPortMousedown(e) {
    e.stopPropagation();
    dispatch('portdragstart', { e, nodeId: node.id });
  }
  function onNodeMouseup(e) {
    dispatch('connecttarget', { e, nodeId: node.id });
  }
  function onDblClick(e) {
    e.stopPropagation();
    dispatch('dblclick', { node });
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

  // How many badges sit above? used to stack HEAD above TAIL
  // HEAD badge: centered above node
  // TAIL badge: if both, stack above HEAD
  $: headBadgeY  = -(BADGE_H + ARROW_LEN);         // bottom of badge touches arrow top
  $: tailBadgeY  = isHead
    ? -(BADGE_H + ARROW_LEN) * 2 - 4               // stacked above head badge
    : -(BADGE_H + ARROW_LEN);
  $: badgeCenterX = W / 2;
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
  on:dblclick={onDblClick}
>
  <!-- ── HEAD badge ── -->
  {#if isHead}
    <!-- Arrow from badge bottom to node top -->
    <line
      x1={badgeCenterX}
      y1={headBadgeY + BADGE_H}
      x2={badgeCenterX}
      y2={0}
      stroke="var(--success)"
      stroke-width="1.5"
      stroke-dasharray="none"
    />
    <!-- Arrowhead pointing down into node -->
    <polygon
      points="{badgeCenterX - 4},{-6} {badgeCenterX + 4},{-6} {badgeCenterX},{0}"
      fill="var(--success)"
    />
    <!-- Badge box -->
    <rect
      x={badgeCenterX - BADGE_W / 2}
      y={headBadgeY}
      width={BADGE_W}
      height={BADGE_H}
      rx="5"
      fill="rgba(78,204,163,0.15)"
      stroke="var(--success)"
      stroke-width="1.2"
    />
    <text
      x={badgeCenterX}
      y={headBadgeY + 13}
      text-anchor="middle"
      font-family="var(--font-mono)"
      font-size="9"
      font-weight="700"
      fill="var(--success)"
      letter-spacing="0.8"
    >HEAD</text>
  {/if}

  <!-- ── TAIL badge ── -->
  {#if isTail}
    <line
      x1={badgeCenterX}
      y1={tailBadgeY + BADGE_H}
      x2={badgeCenterX}
      y2={isHead ? headBadgeY : 0}
      stroke="#c084fc"
      stroke-width="1.5"
    />
    <polygon
      points="{badgeCenterX - 4},{isHead ? headBadgeY - 6 : -6} {badgeCenterX + 4},{isHead ? headBadgeY - 6 : -6} {badgeCenterX},{isHead ? headBadgeY : 0}"
      fill="#c084fc"
    />
    <rect
      x={badgeCenterX - BADGE_W / 2}
      y={tailBadgeY}
      width={BADGE_W}
      height={BADGE_H}
      rx="5"
      fill="rgba(192,132,252,0.15)"
      stroke="#c084fc"
      stroke-width="1.2"
    />
    <text
      x={badgeCenterX}
      y={tailBadgeY + 13}
      text-anchor="middle"
      font-family="var(--font-mono)"
      font-size="9"
      font-weight="700"
      fill="#c084fc"
      letter-spacing="0.8"
    >TAIL</text>
  {/if}

  <!-- ── Node box ── -->
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

  <!-- data value -->
  <text
    x={W / 2} y="50"
    text-anchor="middle"
    font-family="var(--font-mono)"
    font-size="13"
    fill={node.data ? '#e8ecf5' : 'var(--text-muted)'}
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
    <line x1={W/2} y1={H} x2={W/2} y2={H + groundLen} stroke="var(--text-muted)" stroke-width="1.5" />
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