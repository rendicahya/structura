<script>
  import { createEventDispatcher } from 'svelte';

  export let node;
  export let selected = false;
  export let connecting = false;
  export let connectingPort = null; // 'next' | 'prev' | null
  export let isHead = false;
  export let isTail = false;
  export let isWalk = false;
  export let doubly = false;

  const dispatch = createEventDispatcher();

  const W = 130;
  const H = 64;

  const groundLen = 22;
  const groundLines = [
    { y: 0, w: 14 },
    { y: 6, w: 9 },
    { y: 12, w: 4 },
  ];

  const BADGE_W = 40;
  const BADGE_H = 20;
  const BADGE_GAP = 10;
  const ARROW_LEN = BADGE_GAP;

  function onMousedown(e) {
    if (e.button === 0) dispatch('dragstart', { e, nodeId: node.id });
  }
  function onContextMenu(e) {
    e.preventDefault();
    e.stopPropagation();
    dispatch('contextmenu', { e, node });
  }
  function onNextPortMousedown(e) {
    e.stopPropagation();
    dispatch('portdragstart', { e, nodeId: node.id, portType: 'next' });
  }
  function onPrevPortMousedown(e) {
    e.stopPropagation();
    dispatch('portdragstart', { e, nodeId: node.id, portType: 'prev' });
  }
  function onNodeMouseup(e) {
    dispatch('connecttarget', { e, nodeId: node.id });
  }
  function onDblClick(e) {
    e.stopPropagation();
    dispatch('dblclick', { node });
  }

  $: hasNext = !!node.nextId;
  $: hasPrev = !!node.prevId;

  $: borderColor = selected
    ? 'var(--node-selected)'
    : connecting
    ? 'var(--warning)'
    : isHead
    ? 'var(--success)'
    : isTail
    ? '#c084fc'
    : isWalk
    ? '#fb923c'
    : 'var(--node-border)';

  $: headBadgeY = -(BADGE_H + ARROW_LEN);
  $: tailBadgeY = isHead
    ? -(BADGE_H + ARROW_LEN) * 2 - 4
    : -(BADGE_H + ARROW_LEN);
  $: walkBadgeY = (() => {
    let y = -(BADGE_H + ARROW_LEN);
    if (isHead) y -= (BADGE_H + ARROW_LEN + 4);
    if (isTail) y -= (BADGE_H + ARROW_LEN + 4);
    return y;
  })();
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
  <!-- WALK badge -->
  {#if isWalk}
    <line x1={badgeCenterX} y1={walkBadgeY + BADGE_H} x2={badgeCenterX} y2={isHead ? headBadgeY : isTail ? tailBadgeY : 0} stroke="#fb923c" stroke-width="1.5"/>
    <polygon points="{badgeCenterX-4},{isHead ? headBadgeY-6 : isTail ? tailBadgeY-6 : -6} {badgeCenterX+4},{isHead ? headBadgeY-6 : isTail ? tailBadgeY-6 : -6} {badgeCenterX},{isHead ? headBadgeY : isTail ? tailBadgeY : 0}" fill="#fb923c"/>
    <rect x={badgeCenterX-BADGE_W/2} y={walkBadgeY} width={BADGE_W} height={BADGE_H} rx="5" fill="rgba(251,146,60,0.15)" stroke="#fb923c" stroke-width="1.2"/>
    <text x={badgeCenterX} y={walkBadgeY+13} text-anchor="middle" font-family="var(--font-mono)" font-size="9" font-weight="700" fill="#fb923c" letter-spacing="0.8">WALK</text>
  {/if}

  <!-- HEAD badge -->
  {#if isHead}
    <line x1={badgeCenterX} y1={headBadgeY+BADGE_H} x2={badgeCenterX} y2="0" stroke="var(--success)" stroke-width="1.5"/>
    <polygon points="{badgeCenterX-4},-6 {badgeCenterX+4},-6 {badgeCenterX},0" fill="var(--success)"/>
    <rect x={badgeCenterX-BADGE_W/2} y={headBadgeY} width={BADGE_W} height={BADGE_H} rx="5" fill="rgba(78,204,163,0.15)" stroke="var(--success)" stroke-width="1.2"/>
    <text x={badgeCenterX} y={headBadgeY+13} text-anchor="middle" font-family="var(--font-mono)" font-size="9" font-weight="700" fill="var(--success)" letter-spacing="0.8">HEAD</text>
  {/if}

  <!-- TAIL badge -->
  {#if isTail}
    <line x1={badgeCenterX} y1={tailBadgeY+BADGE_H} x2={badgeCenterX} y2={isHead ? headBadgeY : 0} stroke="#c084fc" stroke-width="1.5"/>
    <polygon points="{badgeCenterX-4},{isHead ? headBadgeY-6 : -6} {badgeCenterX+4},{isHead ? headBadgeY-6 : -6} {badgeCenterX},{isHead ? headBadgeY : 0}" fill="#c084fc"/>
    <rect x={badgeCenterX-BADGE_W/2} y={tailBadgeY} width={BADGE_W} height={BADGE_H} rx="5" fill="rgba(192,132,252,0.15)" stroke="#c084fc" stroke-width="1.2"/>
    <text x={badgeCenterX} y={tailBadgeY+13} text-anchor="middle" font-family="var(--font-mono)" font-size="9" font-weight="700" fill="#c084fc" letter-spacing="0.8">TAIL</text>
  {/if}

  <!-- Shadow -->
  <rect x="2" y="4" width={W} height={H} rx="10" fill="rgba(0,0,0,0.35)"/>

  <!-- Main box -->
  <rect x="0" y="0" width={W} height={H} rx="10"
    fill="var(--node-bg)"
    stroke={borderColor}
    stroke-width={selected || connecting || isHead || isTail || isWalk ? 1.8 : 1}
  />

  <!-- Top accent bar -->
  <rect x="1" y="1" width={W-2} height="3" rx="2"
    fill={isHead ? 'var(--success)' : isTail ? '#c084fc' : isWalk ? '#fb923c' : selected ? 'var(--accent)' : connecting ? 'var(--warning)' : 'var(--node-border)'}
    opacity="0.8"
  />

  <!-- var name -->
  <text x={W/2} y="22" text-anchor="middle" font-family="var(--font-mono)" font-size="10" fill="var(--accent)" font-weight="500">{node.varName}</text>

  <!-- divider -->
  <line x1="12" y1="28" x2={W-12} y2="28" stroke="var(--border)" stroke-width="1"/>

  <!-- data value -->
  <text x={W/2} y="50" text-anchor="middle" font-family="var(--font-mono)" font-size="13"
    fill={node.data ? '#e8ecf5' : 'var(--text-muted)'}
    font-weight={node.data ? '500' : '400'}
  >{node.data || 'null'}</text>

  <!-- Next port (right) -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <circle
    cx={W-8} cy={H/2} r="5"
    fill={hasNext ? 'var(--accent)' : 'var(--node-border)'}
    stroke={hasNext ? 'var(--accent-dim)' : 'var(--border-bright)'}
    stroke-width="1"
    class="port"
    on:mousedown={onNextPortMousedown}
  />

  <!-- Prev port (left) — only for doubly -->
  {#if doubly}
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <circle
      cx={8} cy={H/2} r="5"
      fill={hasPrev ? '#c792ea' : 'var(--node-border)'}
      stroke={hasPrev ? '#a855f7' : 'var(--border-bright)'}
      stroke-width="1"
      class="port"
      on:mousedown={onPrevPortMousedown}
    />
  {/if}

  <!-- Ground symbol next (kanan) — muncul kalau tidak ada next -->
  {#if !hasNext}
    {@const gx = W + 6}
    {@const gy = H / 2}
    <!-- Garis horizontal keluar dari sisi kanan -->
    <line x1={W - 8} y1={gy} x2={gx + 10} y2={gy} stroke="var(--text-muted)" stroke-width="1.5"/>
    <!-- Belok ke bawah -->
    <line x1={gx + 10} y1={gy} x2={gx + 10} y2={gy + 18} stroke="var(--text-muted)" stroke-width="1.5"/>
    <!-- Tiga garis ground -->
    <line x1={gx + 3}  y1={gy + 18} x2={gx + 17} y2={gy + 18} stroke="var(--text-muted)" stroke-width="1.5"/>
    <line x1={gx + 6}  y1={gy + 24} x2={gx + 14} y2={gy + 24} stroke="var(--text-muted)" stroke-width="1.5"/>
    <line x1={gx + 9}  y1={gy + 30} x2={gx + 11} y2={gy + 30} stroke="var(--text-muted)" stroke-width="1.5"/>
  {/if}

  <!-- Ground symbol prev (kiri) — hanya untuk doubly, muncul kalau tidak ada prev -->
  {#if doubly && !hasPrev}
    {@const gx = -6}
    {@const gy = H / 2}
    <!-- Garis horizontal keluar dari sisi kiri -->
    <line x1={8} y1={gy} x2={gx - 10} y2={gy} stroke="var(--text-muted)" stroke-width="1.5"/>
    <!-- Belok ke bawah -->
    <line x1={gx - 10} y1={gy} x2={gx - 10} y2={gy + 18} stroke="var(--text-muted)" stroke-width="1.5"/>
    <!-- Tiga garis ground -->
    <line x1={gx - 17} y1={gy + 18} x2={gx - 3}  y2={gy + 18} stroke="var(--text-muted)" stroke-width="1.5"/>
    <line x1={gx - 14} y1={gy + 24} x2={gx - 6}  y2={gy + 24} stroke="var(--text-muted)" stroke-width="1.5"/>
    <line x1={gx - 11} y1={gy + 30} x2={gx - 9}  y2={gy + 30} stroke="var(--text-muted)" stroke-width="1.5"/>
  {/if}
</g>

<style>
  .node-group { cursor: grab; }
  .node-group:active { cursor: grabbing; }
  .port { cursor: crosshair; }
</style>