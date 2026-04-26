<script>
  import { logOpStack } from "../../stores/shared/stackLog.js";
  import {
    stackVarName,
    stackType,
    stackItems,
  } from "../../stores/stack/graphStack.js";
  import { get } from "svelte/store";
  import {
    stackCapacity,
    stackIsFull,
    stackIsEmpty,
  } from "../../stores/stack/graphStack.js";
  import { derived } from "svelte/store";

  const NODE_W = 160;
  const NODE_H = 50;
  const NODE_GAP = 4;
  const CANVAS_PAD_Y = 60;
  const capacity = derived(stackCapacity, ($s) => $s);
  const { zoom = 1 } = $props();

  /** @type {SVGSVGElement} */
  let svgEl = $state();
  let wrapperEl;

  /** @type {{ x: number, y: number, type: 'canvas' | 'item', itemId?: string } | null} */
  let contextMenu = $state(null);
  let peekingId = $state(null);

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

  function onSVGContextMenu(e) {
    e.preventDefault();
    contextMenu = { x: e.clientX, y: e.clientY, type: "canvas" };
  }

  function onItemContextMenu(e, itemId) {
    e.preventDefault();
    e.stopPropagation();
    contextMenu = { x: e.clientX, y: e.clientY, type: "item", itemId };
  }

  function closeContextMenu() {
    contextMenu = null;
  }

  function handlePeek(itemId) {
    peekingId = itemId;

    const varName = get(stackVarName);
    const type = get(stackType);
    const items = get(stackItems);

    if (items.length > 0) {
      logOpStack(
        `${type} peeked = ${varName}[top - 1]; // peek`,
        `peeked = ${varName}[top - 1]  # peek`,
      );
    }

    setTimeout(() => {
      peekingId = null;
    }, 1500);
    closeContextMenu();
  }

  function handlePushFromMenu() {
    closeContextMenu();
    // trigger push modal di toolbar — pakai custom event
    window.dispatchEvent(new CustomEvent("stack:push"));
  }

  function handlePopFromMenu() {
    closeContextMenu();
    window.dispatchEvent(new CustomEvent("stack:pop"));
  }

  function centerStack() {
    const rect = svgEl.getBoundingClientRect();
    const stackHeight = $stackCapacity * (NODE_H + NODE_GAP) + CANVAS_PAD_Y * 2;
    const stackWidth = NODE_W + 200; // NODE_W + ruang badge TOP + bracket

    // Offset agar stack muncul di tengah canvas
    panX = rect.width / 2 - stackWidth / 2 - 20;
    panY = rect.height / 2 - stackHeight / 2;
  }

  function onSVGMousedown(e) {
    contextMenu = null;
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
      oncontextmenu={onSVGContextMenu}
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
          {@const isPeeking = peekingId === item.id}

          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <g
            class="stack-item"
            class:anim-in={isAnimIn}
            class:peeking={isPeeking}
            oncontextmenu={(e) => onItemContextMenu(e, item.id)}
          >
            <rect
              x={STACK_X}
              {y}
              width={NODE_W}
              height={NODE_H}
              rx="6"
              fill="var(--node-bg)"
              stroke={isPeeking
                ? "var(--warning)"
                : isTop
                  ? "var(--accent)"
                  : "var(--node-border)"}
              stroke-width={isPeeking || isTop ? 1.8 : 1}
            />
            {#if isTop && !isPeeking}
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
            {#if isPeeking}
              <rect
                x={STACK_X + 1}
                y={y + 1}
                width={NODE_W - 2}
                height="3"
                rx="2"
                fill="var(--warning)"
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

        {#if $stackIsFull}
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

    {#if contextMenu}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="ctx-menu"
        style="left: {contextMenu.x}px; top: {contextMenu.y}px;"
        onmousedown={(e) => e.stopPropagation()}
      >
        {#if contextMenu.type === "canvas"}
          <button class="ctx-item" onclick={handlePushFromMenu}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path
                d="M6.5 9V4M4 6.5l2.5 2.5 2.5-2.5"
                stroke="currentColor"
                stroke-width="1.3"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            Push
          </button>
          <button
            class="ctx-item"
            onclick={handlePopFromMenu}
            disabled={$stackIsEmpty}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path
                d="M6.5 4v5M4 6.5l2.5-2.5 2.5 2.5"
                stroke="currentColor"
                stroke-width="1.3"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            Pop
          </button>
          <div class="ctx-divider"></div>
          <button
            class="ctx-item"
            onclick={() => handlePeek(contextMenu?.itemId ?? "")}
            disabled={$stackIsEmpty}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <circle
                cx="6.5"
                cy="6.5"
                r="4"
                stroke="currentColor"
                stroke-width="1.3"
              />
              <circle cx="6.5" cy="6.5" r="1.5" fill="currentColor" />
            </svg>
            Peek
          </button>
        {:else}
          {@const ctxItem = $stackItems.find(
            (i) => i.id === contextMenu?.itemId,
          )}
          {@const isTop = ctxItem?.index === $stackItems.length - 1}
          <button
            class="ctx-item"
            onclick={handlePopFromMenu}
            disabled={!isTop}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path
                d="M6.5 4v5M4 6.5l2.5-2.5 2.5 2.5"
                stroke="currentColor"
                stroke-width="1.3"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            Pop {!isTop ? "(top only)" : ""}
          </button>
          <button
            class="ctx-item"
            onclick={() => handlePeek(contextMenu?.itemId ?? "")}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <circle
                cx="6.5"
                cy="6.5"
                r="4"
                stroke="currentColor"
                stroke-width="1.3"
              />
              <circle cx="6.5" cy="6.5" r="1.5" fill="currentColor" />
            </svg>
            Peek
          </button>
        {/if}
      </div>
    {/if}
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
  .ctx-menu {
    position: fixed;
    z-index: 1000;
    background: var(--surface);
    border: 1px solid var(--border-bright);
    border-radius: 10px;
    padding: 6px;
    min-width: 150px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    animation: menuIn 0.12s ease;
  }
  @keyframes menuIn {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(-4px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }
  .ctx-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 7px 10px;
    background: none;
    border: none;
    border-radius: 6px;
    color: var(--text-dim);
    font-family: var(--font-ui);
    font-size: 13px;
    cursor: pointer;
    text-align: left;
    transition: all 0.1s;
  }
  .ctx-item:hover:not(:disabled) {
    background: var(--surface2);
    color: var(--text);
  }
  .ctx-item:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  .ctx-divider {
    height: 1px;
    background: var(--border);
    margin: 4px 0;
  }
  .peeking {
    filter: drop-shadow(0 0 6px rgba(240, 180, 41, 0.5));
  }
</style>
