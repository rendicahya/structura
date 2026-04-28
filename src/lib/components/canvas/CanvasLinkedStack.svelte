<script>
  import {
    linkedStackNodes,
    topId,
    linkedStackIsEmpty,
    garbageCollectLinkedStack,
    peekLinkedStack,
  } from "../../stores/stack/graphLinkedStack.js";
  import { logOpLinkedStack } from "../../stores/shared/linkedStackLog.js";
  import { pushHistory } from "../../stores/shared/history.js";
  import { toast } from "../../stores/shared/toast.js";

  const NODE_W = 130;
  const NODE_H = 64;
  const NODE_GAP = 40;
  const CANVAS_PAD_Y = 60;

  let { zoom = $bindable(1) } = $props();

  /** @type {SVGSVGElement} */
  let svgEl = $state();
  let panX = $state(0);
  let panY = $state(0);
  let panning = $state(false);
  let panStartX = 0;
  let panStartY = 0;
  let initialized = $state(false);
  let peekingId = $state(null);

  /** @type {{ x: number, y: number, type: 'canvas'|'node', nodeId?: string }|null} */
  let contextMenu = $state(null);

  // Animasi push
  let animatingInId = $state(null);
  let prevLength = 0;
  $effect(() => {
    const nodes = $linkedStackNodes;
    if (nodes.length > prevLength) {
      animatingInId = nodes[0].id;
      setTimeout(() => {
        animatingInId = null;
      }, 400);
    }
    prevLength = nodes.length;
  });

  // Center saat pertama ada node
  $effect(() => {
    if ($linkedStackNodes.length > 0 && !initialized && svgEl) {
      centerStack();
      initialized = true;
    }
    if ($linkedStackNodes.length === 0) initialized = false;
  });

  function centerStack() {
    const rect = svgEl.getBoundingClientRect();
    panX = rect.width / 2 - NODE_W / 2;
    panY = CANVAS_PAD_Y;
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

  function onSVGContextMenu(e) {
    e.preventDefault();
    contextMenu = { x: e.clientX, y: e.clientY, type: "canvas" };
  }

  function onNodeContextMenu(e, nodeId) {
    e.preventDefault();
    e.stopPropagation();
    contextMenu = { x: e.clientX, y: e.clientY, type: "node", nodeId };
  }

  function closeContextMenu() {
    contextMenu = null;
  }

  function handlePushFromMenu() {
    closeContextMenu();
    window.dispatchEvent(new CustomEvent("linkedstack:push"));
  }

  function handlePopFromMenu() {
    closeContextMenu();
    window.dispatchEvent(new CustomEvent("linkedstack:pop"));
  }

  function handlePeekFromMenu(nodeId) {
    peekingId = nodeId ?? $topId;
    peekLinkedStack();
    setTimeout(() => {
      peekingId = null;
    }, 1500);
    closeContextMenu();
  }

  function handleGCFromMenu() {
    closeContextMenu();
    pushHistory();
    garbageCollectLinkedStack();
    pushHistory();
  }

  // Posisi Y tiap node — top di atas
  /**
   * @param {number} index
   */
  function getNodeY(index) {
    return index * (NODE_H + NODE_GAP);
  }

  // Node yang masih di stack (terhubung dari top)
  let stackNodeIds = $derived(() => {
    const nodes = $linkedStackNodes;
    const pointed = new Set(nodes.map((n) => n.nextId).filter(Boolean));
    const tops = nodes.filter((n) => !pointed.has(n.id));
    if (tops.length === 0) return [];
    const result = [];
    let current = tops[0];
    while (current) {
      result.push(current.id);
      const next = nodes.find((n) => n.id === current.nextId);
      current = next ?? null;
    }
    return result;
  });

  // Node unreachable (sudah di-pop, menunggu GC)
  let unreachableNodes = $derived(
    $linkedStackNodes.filter((n) => !stackNodeIds().includes(n.id)),
  );

  const GROUND_LEN = 22;
  const GROUND_LINES = [{ w: 14 }, { w: 9 }, { w: 4 }];
</script>

<svelte:window onmousemove={onWindowMousemove} onmouseup={onWindowMouseup} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="canvas-wrapper">
  {#if $linkedStackIsEmpty}
    <div class="empty-hint">
      <div class="empty-title">Stack is empty</div>
      <div class="empty-hints-list">
        <div class="empty-hint-item">
          <kbd>Push</kbd> <span>to add a node</span>
        </div>
        <div class="empty-hint-item">
          <kbd>Right click</kbd> <span>for options</span>
        </div>
      </div>
    </div>
  {/if}

  <svg
    bind:this={svgEl}
    class="canvas-svg"
    class:panning
    role="application"
    onmousedown={onSVGMousedown}
    oncontextmenu={onSVGContextMenu}
  >
    <defs>
      <marker
        id="arrow-ls"
        markerWidth="8"
        markerHeight="6"
        refX="7"
        refY="3"
        orient="auto"
      >
        <polygon points="0 0, 8 3, 0 6" fill="#5b8fff" />
      </marker>
      <pattern
        id="grid-ls"
        width="28"
        height="28"
        patternUnits="userSpaceOnUse"
      >
        <circle cx="14" cy="14" r="0.8" fill="var(--border)" />
      </pattern>
    </defs>

    <rect width="100%" height="100%" fill="url(#grid-ls)" />

    <g
      style="transform: translate({panX}px, {panY}px) scale({zoom}); transform-origin: 0 0;"
    >
      <!-- Stack nodes (reachable) -->
      {#each stackNodeIds() as nodeId, index}
        {@const node = $linkedStackNodes.find((n) => n.id === nodeId)}
        {#if node}
          {@const y = getNodeY(index)}
          {@const isTop = index === 0}
          {@const isPeeking = peekingId === node.id}
          {@const isAnimIn = animatingInId === node.id}

          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <g
            class="node-group"
            class:anim-in={isAnimIn}
            oncontextmenu={(e) => onNodeContextMenu(e, node.id)}
          >
            <!-- Shadow -->
            <rect
              x="2"
              y={y + 4}
              width={NODE_W}
              height={NODE_H}
              rx="10"
              fill="rgba(0,0,0,0.35)"
            />

            <!-- Main box -->
            <rect
              x="0"
              {y}
              width={NODE_W}
              height={NODE_H}
              rx="10"
              fill="var(--node-bg)"
              stroke={isPeeking
                ? "var(--warning)"
                : isTop
                  ? "var(--accent)"
                  : "var(--node-border)"}
              stroke-width={isTop || isPeeking ? 1.8 : 1}
            />

            <!-- Top accent bar -->
            <rect
              x="1"
              y={y + 1}
              width={NODE_W - 2}
              height="3"
              rx="2"
              fill={isPeeking
                ? "var(--warning)"
                : isTop
                  ? "var(--accent)"
                  : "var(--node-border)"}
              opacity="0.8"
            />

            <!-- var name -->
            <text
              x={NODE_W / 2}
              y={y + 22}
              text-anchor="middle"
              font-family="var(--font-mono)"
              font-size="10"
              fill="var(--accent)"
              font-weight="500">{node.varName}</text
            >

            <!-- divider -->
            <line
              x1="12"
              y1={y + 28}
              x2={NODE_W - 12}
              y2={y + 28}
              stroke="var(--border)"
              stroke-width="1"
            />

            <!-- data -->
            <text
              x={NODE_W / 2}
              y={y + 50}
              text-anchor="middle"
              font-family="var(--font-mono)"
              font-size="13"
              fill={node.data ? "#e8ecf5" : "var(--text-muted)"}
              font-weight={node.data ? "500" : "400"}
              >{node.data || "null"}</text
            >
          </g>

          <!-- TOP badge -->
          {#if isTop}
            <rect
              x={NODE_W + 10}
              y={y + NODE_H / 2 - 10}
              width="40"
              height="20"
              rx="5"
              fill="rgba(78,204,163,0.15)"
              stroke="var(--success)"
              stroke-width="1.2"
            />
            <text
              x={NODE_W + 30}
              y={y + NODE_H / 2 + 4}
              text-anchor="middle"
              font-family="var(--font-mono)"
              font-size="9"
              font-weight="700"
              fill="var(--success)"
              letter-spacing="0.8">TOP</text
            >
            <line
              x1={NODE_W + 10}
              y1={y + NODE_H / 2}
              x2={NODE_W + 1}
              y2={y + NODE_H / 2}
              stroke="var(--success)"
              stroke-width="1.5"
            />
            <polygon
              points="{NODE_W + 7},{y + NODE_H / 2 - 4} {NODE_W + 1},{y +
                NODE_H / 2} {NODE_W + 7},{y + NODE_H / 2 + 4}"
              fill="var(--success)"
            />
          {/if}

          <!-- Arrow ke node berikutnya -->
          {#if index < stackNodeIds().length - 1}
            {@const nextY = getNodeY(index + 1)}
            <line
              x1={NODE_W / 2}
              y1={y + NODE_H}
              x2={NODE_W / 2}
              y2={nextY - 4}
              stroke="var(--accent)"
              stroke-width="1.8"
              marker-end="url(#arrow-ls)"
            />
          {/if}

          <!-- Ground symbol untuk node terbawah -->
          {#if index === stackNodeIds().length - 1}
            <line
              x1={NODE_W / 2}
              y1={y + NODE_H}
              x2={NODE_W / 2}
              y2={y + NODE_H + GROUND_LEN}
              stroke="var(--text-muted)"
              stroke-width="1.5"
            />
            {#each GROUND_LINES as gl, i}
              <line
                x1={NODE_W / 2 - gl.w / 2}
                y1={y + NODE_H + GROUND_LEN + i * 7}
                x2={NODE_W / 2 + gl.w / 2}
                y2={y + NODE_H + GROUND_LEN + i * 7}
                stroke="var(--text-muted)"
                stroke-width="1.5"
              />
            {/each}
          {/if}
        {/if}
      {/each}

      <!-- Unreachable nodes (sudah di-pop, menunggu GC) -->
      {#each unreachableNodes as node, index}
        {@const y = getNodeY(stackNodeIds().length + index + 1)}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <g
          class="node-group unreachable"
          oncontextmenu={(e) => onNodeContextMenu(e, node.id)}
        >
          <rect
            x="2"
            y={y + 4}
            width={NODE_W}
            height={NODE_H}
            rx="10"
            fill="rgba(0,0,0,0.2)"
          />
          <rect
            x="0"
            {y}
            width={NODE_W}
            height={NODE_H}
            rx="10"
            fill="var(--node-bg)"
            stroke="var(--border)"
            stroke-width="1"
            opacity="0.5"
            stroke-dasharray="4 3"
          />
          <text
            x={NODE_W / 2}
            y={y + 22}
            text-anchor="middle"
            font-family="var(--font-mono)"
            font-size="10"
            fill="var(--text-muted)"
            font-weight="500">{node.varName}</text
          >
          <line
            x1="12"
            y1={y + 28}
            x2={NODE_W - 12}
            y2={y + 28}
            stroke="var(--border)"
            stroke-width="1"
          />
          <text
            x={NODE_W / 2}
            y={y + 50}
            text-anchor="middle"
            font-family="var(--font-mono)"
            font-size="13"
            fill="var(--text-muted)">{node.data || "null"}</text
          >
          <!-- GC label -->
          <text
            x={NODE_W + 10}
            y={y + NODE_H / 2 + 4}
            font-family="var(--font-mono)"
            font-size="9"
            fill="var(--text-muted)"
            font-style="italic">unreachable</text
          >
        </g>
      {/each}
    </g>
  </svg>

  <!-- Context menu -->
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
          disabled={$linkedStackIsEmpty}
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
          onclick={() => handlePeekFromMenu(null)}
          disabled={$linkedStackIsEmpty}
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
        <div class="ctx-divider"></div>
        <button class="ctx-item" onclick={handleGCFromMenu}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path
              d="M6.5 2C4.3 2 2.5 3.8 2.5 6s1.8 4 4 4 4-1.8 4-4"
              stroke="currentColor"
              stroke-width="1.3"
              stroke-linecap="round"
            />
            <path
              d="M8.5 2h2.5v2.5"
              stroke="currentColor"
              stroke-width="1.3"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M8.5 4.5l2.5-2.5"
              stroke="currentColor"
              stroke-width="1.3"
              stroke-linecap="round"
            />
          </svg>
          Run GC
        </button>
      {:else}
        {@const isTop = contextMenu.nodeId === $topId}
        {@const isUnreachable = unreachableNodes.some(
          (n) => n.id === contextMenu.nodeId,
        )}
        {#if !isUnreachable}
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
            onclick={() => handlePeekFromMenu(contextMenu?.nodeId)}
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
          <div class="ctx-label">Unreachable — waiting for GC</div>
          <button class="ctx-item" onclick={handleGCFromMenu}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path
                d="M6.5 2C4.3 2 2.5 3.8 2.5 6s1.8 4 4 4 4-1.8 4-4"
                stroke="currentColor"
                stroke-width="1.3"
                stroke-linecap="round"
              />
              <path
                d="M8.5 2h2.5v2.5"
                stroke="currentColor"
                stroke-width="1.3"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d="M8.5 4.5l2.5-2.5"
                stroke="currentColor"
                stroke-width="1.3"
                stroke-linecap="round"
              />
            </svg>
            Run GC
          </button>
        {/if}
      {/if}
    </div>
  {/if}
</div>

<style>
  .canvas-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: var(--bg);
  }
  .canvas-svg {
    display: block;
    width: 100%;
    height: 100%;
    cursor: grab;
    user-select: none;
  }
  .canvas-svg.panning {
    cursor: grabbing;
  }
  .node-group {
    cursor: default;
  }
  .node-group.unreachable {
    opacity: 0.5;
  }
  .node-group.anim-in {
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
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  .empty-title {
    font-family: var(--font-ui);
    font-size: 16px;
    font-weight: 700;
    color: var(--text-muted);
  }
  .empty-hints-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: center;
  }
  .empty-hint-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font-ui);
    font-size: 12px;
    color: var(--text-muted);
  }
  .empty-hint-item kbd {
    font-family: var(--font-mono);
    font-size: 11px;
    background: var(--surface2);
    border: 1px solid var(--border-bright);
    border-radius: 4px;
    padding: 2px 6px;
    color: var(--text-dim);
  }
  .ctx-menu {
    position: fixed;
    z-index: 1000;
    background: var(--surface);
    border: 1px solid var(--border-bright);
    border-radius: 10px;
    padding: 6px;
    min-width: 180px;
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
  .ctx-label {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-muted);
    padding: 4px 10px 6px;
    font-style: italic;
  }
</style>
