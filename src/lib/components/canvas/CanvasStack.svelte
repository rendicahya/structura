<script>
  import {
    stackItems,
    stackCapacity,
    isFull,
  } from "../../stores/stack/graphStack.js";

  const NODE_W = 160;
  const NODE_H = 50;
  const NODE_GAP = 4;
  const CANVAS_PAD_Y = 60;

  const { zoom = 1 } = $props();

  /** @type {SVGSVGElement} */
  let svgEl;
  let wrapperEl;

  /** @type {string|null} */
  let animatingInId = $state(null);
  let panX = $state(0);
  let panY = $state(0);
  let panning = $state(false);
  let panStartX = 0;
  let panStartY = 0;
  let initialized = $state(false);

  let prevLength = 0;
  $effect(() => {
    const items = $stackItems;
    if (items.length > prevLength) {
      const newItem = items[items.length - 1];
      animatingInId = newItem.id;
      setTimeout(() => {
        animatingInId = null;
      }, 400);
    }
    prevLength = items.length;
  });

  // Center stack saat kapasitas pertama kali di-set
  $effect(() => {
    if ($stackCapacity > 0 && !initialized && svgEl) {
      centerStack();
      initialized = true;
    }
    if ($stackCapacity === 0) initialized = false;
  });

  function centerStack() {
    const rect = svgEl.getBoundingClientRect();
    const stackHeight = $stackCapacity * (NODE_H + NODE_GAP) + CANVAS_PAD_Y * 2;
    const stackWidth = NODE_W + 200; // NODE_W + ruang badge TOP + bracket

    // Offset agar stack muncul di tengah canvas
    panX = rect.width / 2 - stackWidth / 2 - 20;
    panY = rect.height / 2 - stackHeight / 2;
  }

  function onSVGMousedown(e) {
    if (e.button !== 0) return;
    panning = true;
    panStartX = e.clientX - panX;
    panStartY = e.clientY - panY;
  }

  function onWindowMousemove(e) {
    if (!panning) return;
    panX = e.clientX - panStartX;
    panY = e.clientY - panStartY;
  }

  function onWindowMouseup() {
    panning = false;
  }

  let emptySlots = $derived(
    Array.from(
      { length: $stackCapacity - $stackItems.length },
      (_, i) => $stackItems.length + i,
    ),
  );

  /**
   * @param {number} index
   */
  function getItemY(index) {
    const stackHeight = $stackCapacity * (NODE_H + NODE_GAP);
    return CANVAS_PAD_Y + stackHeight - (index + 1) * (NODE_H + NODE_GAP);
  }

  // Konstanta posisi X untuk stack (selalu di x=0 dalam koordinat lokal)
  const STACK_X = 60; // ruang untuk bracket kiri + index label
</script>

<svelte:window on:mousemove={onWindowMousemove} on:mouseup={onWindowMouseup} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="stack-canvas" bind:this={wrapperEl}>
  {#if $stackCapacity === 0}
    <div class="empty-hint">
      <div class="empty-title">Stack not initialized</div>
      <div class="empty-sub">
        Click <strong>New Stack</strong> to get started
      </div>
    </div>
  {:else}
    <svg
      bind:this={svgEl}
      class="stack-svg"
      class:panning
      onmousedown={onSVGMousedown}
    >
      <defs>
        <pattern
          id="grid-stack"
          width="28"
          height="28"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="14" cy="14" r="0.8" fill="var(--border)" />
        </pattern>
      </defs>

      <rect width="100%" height="100%" fill="url(#grid-stack)" />

      <g
        style="transform: translate({panX}px, {panY}px) scale({zoom}); transform-origin: 0 0;"
      >
        <!-- Array bracket kiri -->
        <path
          d="M {STACK_X - 16} {CANVAS_PAD_Y - 4}
             L {STACK_X - 24} {CANVAS_PAD_Y - 4}
             L {STACK_X - 24} {CANVAS_PAD_Y +
            $stackCapacity * (NODE_H + NODE_GAP) -
            NODE_GAP +
            4}
             L {STACK_X - 16} {CANVAS_PAD_Y +
            $stackCapacity * (NODE_H + NODE_GAP) -
            NODE_GAP +
            4}"
          fill="none"
          stroke="var(--border-bright)"
          stroke-width="2"
          stroke-linecap="round"
        />

        <!-- Array bracket kanan -->
        <path
          d="M {STACK_X + NODE_W + 16} {CANVAS_PAD_Y - 4}
             L {STACK_X + NODE_W + 24} {CANVAS_PAD_Y - 4}
             L {STACK_X + NODE_W + 24} {CANVAS_PAD_Y +
            $stackCapacity * (NODE_H + NODE_GAP) -
            NODE_GAP +
            4}
             L {STACK_X + NODE_W + 16} {CANVAS_PAD_Y +
            $stackCapacity * (NODE_H + NODE_GAP) -
            NODE_GAP +
            4}"
          fill="none"
          stroke="var(--border-bright)"
          stroke-width="2"
          stroke-linecap="round"
        />

        <!-- Slot kosong -->
        {#each emptySlots as slotIndex}
          {@const y = getItemY(slotIndex)}
          <rect
            x={STACK_X}
            {y}
            width={NODE_W}
            height={NODE_H}
            rx="6"
            fill="var(--surface)"
            stroke="var(--border)"
            stroke-width="1"
            stroke-dasharray="4 3"
          />
          <text
            x={STACK_X - 8}
            y={y + NODE_H / 2 + 4}
            text-anchor="end"
            font-family="var(--font-mono)"
            font-size="10"
            fill="var(--text-muted)">{slotIndex}</text
          >
        {/each}

        <!-- Item yang ada -->
        {#each $stackItems as item (item.id)}
          {@const y = getItemY(item.index)}
          {@const isTop = item.index === $stackItems.length - 1}
          {@const isAnimIn = animatingInId === item.id}

          <g class="stack-item" class:anim-in={isAnimIn}>
            <rect
              x={STACK_X}
              {y}
              width={NODE_W}
              height={NODE_H}
              rx="6"
              fill="var(--node-bg)"
              stroke={isTop ? "var(--accent)" : "var(--node-border)"}
              stroke-width={isTop ? 1.8 : 1}
            />
            {#if isTop}
              <rect
                x={STACK_X + 1}
                y={y + 1}
                width={NODE_W - 2}
                height="3"
                rx="2"
                fill="var(--accent)"
                opacity="0.8"
              />
            {/if}
            <text
              x={STACK_X + NODE_W / 2}
              y={y + NODE_H / 2 + 5}
              text-anchor="middle"
              font-family="var(--font-mono)"
              font-size="14"
              fill={item.value ? "#e8ecf5" : "var(--text-muted)"}
              font-weight="500">{item.value || "0"}</text
            >
            <text
              x={STACK_X - 8}
              y={y + NODE_H / 2 + 4}
              text-anchor="end"
              font-family="var(--font-mono)"
              font-size="10"
              fill="var(--text-muted)">{item.index}</text
            >
          </g>

          <!-- TOP badge -->
          {#if isTop}
            <line
              x1={STACK_X + NODE_W + 50}
              y1={y + NODE_H / 2}
              x2={STACK_X + NODE_W + 2}
              y2={y + NODE_H / 2}
              stroke="var(--success)"
              stroke-width="1.5"
            />
            <polygon
              points="{STACK_X + NODE_W + 8},{y + NODE_H / 2 - 4} {STACK_X +
                NODE_W +
                2},{y + NODE_H / 2} {STACK_X + NODE_W + 8},{y + NODE_H / 2 + 4}"
              fill="var(--success)"
            />
            <rect
              x={STACK_X + NODE_W + 50}
              y={y + NODE_H / 2 - 12}
              width="40"
              height="20"
              rx="5"
              fill="rgba(78,204,163,0.15)"
              stroke="var(--success)"
              stroke-width="1.2"
            />
            <text
              x={STACK_X + NODE_W + 70}
              y={y + NODE_H / 2 + 4}
              text-anchor="middle"
              font-family="var(--font-mono)"
              font-size="9"
              font-weight="700"
              fill="var(--success)"
              letter-spacing="0.8">TOP</text
            >
          {/if}
        {/each}

        {#if $isFull}
          <text
            x={STACK_X + NODE_W / 2}
            y={CANVAS_PAD_Y - 16}
            text-anchor="middle"
            font-family="var(--font-mono)"
            font-size="10"
            fill="var(--danger)"
            font-weight="600">FULL</text
          >
        {/if}
      </g>
    </svg>
  {/if}
</div>

<style>
  .stack-canvas {
    position: relative;
    width: 100%;
    height: 100%;
    background: var(--bg);
    overflow: hidden;
  }
  .stack-svg {
    display: block;
    width: 100%;
    height: 100%;
    cursor: grab;
    user-select: none;
  }
  .stack-svg.panning {
    cursor: grabbing;
  }
  .stack-item {
    transition: transform 0.3s ease;
  }
  .stack-item.anim-in {
    animation: slideDown 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .empty-hint {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    pointer-events: none;
  }
  .empty-title {
    font-family: var(--font-ui);
    font-size: 16px;
    font-weight: 700;
    color: var(--text-muted);
    margin-bottom: 8px;
  }
  .empty-sub {
    font-size: 13px;
    color: var(--text-muted);
  }
  .empty-sub strong {
    color: var(--accent);
  }
</style>
