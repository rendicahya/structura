<script>
  import { stackItems, stackCapacity, isFull, isEmpty } from '../../stores/stack/graphStack.js';

  const NODE_W = 160;
  const NODE_H = 50;
  const NODE_GAP = 4;
  const CANVAS_PAD_X = 100;
  const CANVAS_PAD_Y = 60;

  // Animasi — track item baru dan item yang di-pop
  /** @type {string|null} */
  let animatingInId = $state(null);
  /** @type {string|null} */
  let animatingOutId = $state(null);

  // Watch untuk animasi push
  let prevLength = 0;
  $effect(() => {
    const items = $stackItems;
    if (items.length > prevLength) {
      // Push — animasi item teratas
      const newItem = items[items.length - 1];
      animatingInId = newItem.id;
      setTimeout(() => { animatingInId = null; }, 400);
    }
    prevLength = items.length;
  });

  let totalHeight = $derived($stackCapacity * (NODE_H + NODE_GAP) + CANVAS_PAD_Y * 2);
  let svgHeight = $derived(Math.max(400, totalHeight));

  // Posisi Y setiap item — index 0 di bawah, top di atas
  /**
   * @param {number} index
   */
  function getItemY(index) {
    const stackHeight = $stackCapacity * (NODE_H + NODE_GAP);
    const startY = CANVAS_PAD_Y + stackHeight - (index + 1) * (NODE_H + NODE_GAP);
    return startY;
  }

  // Slot kosong
  let emptySlots = $derived(Array.from(
    { length: $stackCapacity - $stackItems.length },
    (_, i) => $stackItems.length + i
  ));
</script>

<div class="stack-canvas">
  {#if $stackCapacity === 0}
    <div class="empty-hint">
      <div class="empty-title">Stack not initialized</div>
      <div class="empty-sub">Click <strong>New Stack</strong> to get started</div>
    </div>
  {:else}
    <svg
      class="stack-svg"
      width="100%"
      height={svgHeight}
      viewBox="0 0 400 {svgHeight}"
    >
      <!-- Array bracket kiri -->
      <path
        d="M {CANVAS_PAD_X - 16} {CANVAS_PAD_Y - 4}
           L {CANVAS_PAD_X - 24} {CANVAS_PAD_Y - 4}
           L {CANVAS_PAD_X - 24} {CANVAS_PAD_Y + $stackCapacity * (NODE_H + NODE_GAP) - NODE_GAP + 4}
           L {CANVAS_PAD_X - 16} {CANVAS_PAD_Y + $stackCapacity * (NODE_H + NODE_GAP) - NODE_GAP + 4}"
        fill="none"
        stroke="var(--border-bright)"
        stroke-width="2"
        stroke-linecap="round"
      />
      <!-- Array bracket kanan -->
      <path
        d="M {CANVAS_PAD_X + NODE_W + 16} {CANVAS_PAD_Y - 4}
           L {CANVAS_PAD_X + NODE_W + 24} {CANVAS_PAD_Y - 4}
           L {CANVAS_PAD_X + NODE_W + 24} {CANVAS_PAD_Y + $stackCapacity * (NODE_H + NODE_GAP) - NODE_GAP + 4}
           L {CANVAS_PAD_X + NODE_W + 16} {CANVAS_PAD_Y + $stackCapacity * (NODE_H + NODE_GAP) - NODE_GAP + 4}"
        fill="none"
        stroke="var(--border-bright)"
        stroke-width="2"
        stroke-linecap="round"
      />

      <!-- Slot kosong -->
      {#each emptySlots as slotIndex}
        {@const y = getItemY(slotIndex)}
        <rect
          x={CANVAS_PAD_X} y={y}
          width={NODE_W} height={NODE_H}
          rx="6"
          fill="var(--surface)"
          stroke="var(--border)"
          stroke-width="1"
          stroke-dasharray="4 3"
        />
        <!-- Index label -->
        <text
          x={CANVAS_PAD_X - 8} y={y + NODE_H/2 + 4}
          text-anchor="end"
          font-family="var(--font-mono)"
          font-size="10"
          fill="var(--text-muted)"
        >[{slotIndex}]</text>
      {/each}

      <!-- Item yang ada -->
      {#each $stackItems as item (item.id)}
        {@const y = getItemY(item.index)}
        {@const isTop = item.index === $stackItems.length - 1}
        {@const isAnimIn = animatingInId === item.id}

        <!-- Node box -->
        <g
          class="stack-item"
          class:anim-in={isAnimIn}
          style="--item-y: {y}px"
        >
          <rect
            x={CANVAS_PAD_X} y={y}
            width={NODE_W} height={NODE_H}
            rx="6"
            fill="var(--node-bg)"
            stroke={isTop ? 'var(--accent)' : 'var(--node-border)'}
            stroke-width={isTop ? 1.8 : 1}
          />

          <!-- Top accent -->
          {#if isTop}
            <rect
              x={CANVAS_PAD_X + 1} y={y + 1}
              width={NODE_W - 2} height="3"
              rx="2"
              fill="var(--accent)"
              opacity="0.8"
            />
          {/if}

          <!-- Value -->
          <text
            x={CANVAS_PAD_X + NODE_W/2} y={y + NODE_H/2 + 5}
            text-anchor="middle"
            font-family="var(--font-mono)"
            font-size="14"
            fill={item.value ? '#e8ecf5' : 'var(--text-muted)'}
            font-weight="500"
          >{item.value || '0'}</text>

          <!-- Index label -->
          <text
            x={CANVAS_PAD_X - 8} y={y + NODE_H/2 + 4}
            text-anchor="end"
            font-family="var(--font-mono)"
            font-size="10"
            fill="var(--text-muted)"
          >[{item.index}]</text>
        </g>

        <!-- TOP badge -->
        {#if isTop}
          <!-- Arrow -->
          <line
            x1={CANVAS_PAD_X + NODE_W + 50}
            y1={y + NODE_H/2}
            x2={CANVAS_PAD_X + NODE_W + 2}
            y2={y + NODE_H/2}
            stroke="var(--success)"
            stroke-width="1.5"
          />
          <polygon
            points="
              {CANVAS_PAD_X + NODE_W + 8},{y + NODE_H/2 - 4}
              {CANVAS_PAD_X + NODE_W + 2},{y + NODE_H/2}
              {CANVAS_PAD_X + NODE_W + 8},{y + NODE_H/2 + 4}
            "
            fill="var(--success)"
          />
          <!-- Badge box -->
          <rect
            x={CANVAS_PAD_X + NODE_W + 50}
            y={y + NODE_H/2 - 12}
            width="40" height="20"
            rx="5"
            fill="rgba(78,204,163,0.15)"
            stroke="var(--success)"
            stroke-width="1.2"
          />
          <text
            x={CANVAS_PAD_X + NODE_W + 70}
            y={y + NODE_H/2 + 4}
            text-anchor="middle"
            font-family="var(--font-mono)"
            font-size="9"
            font-weight="700"
            fill="var(--success)"
            letter-spacing="0.8"
          >TOP</text>
        {/if}
      {/each}

      <!-- Stack full indicator -->
      {#if $isFull}
        <text
          x={CANVAS_PAD_X + NODE_W/2}
          y={CANVAS_PAD_Y - 16}
          text-anchor="middle"
          font-family="var(--font-mono)"
          font-size="10"
          fill="var(--danger)"
          font-weight="600"
        >FULL</text>
      {/if}
    </svg>
  {/if}
</div>

<style>
  .stack-canvas {
    width: 100%;
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    background: var(--bg);
    display: flex;
    align-items: flex-start;
    justify-content: center;
  }

  .stack-svg {
    display: block;
  }

  .stack-item {
    transition: transform 0.3s ease;
  }

  .stack-item.anim-in {
    animation: slideDown 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-30px); }
    to   { opacity: 1; transform: translateY(0); }
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

  .empty-sub strong { color: var(--accent); }
</style>