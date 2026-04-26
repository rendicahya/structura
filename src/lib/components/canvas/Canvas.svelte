<script>
  import { onMount } from "svelte";
  import {
    nodes,
    edges,
    updateNode,
    removeNodeFromList,
    connectNodes,
    disconnectNode,
    headId,
    tailId,
    walkId,
    setHead,
    setTail,
    setWalk,
    createNode,
    addNode,
  } from "../../stores/sll/graph.js";
  import { pushHistory, undo, redo } from "../../stores/shared/history.js";
  import { createCanvasLogic } from "../../utils/canvasLogic.js";
  import NodeComponent from "../node/NodeComponent.svelte";
  import EdgeComponent from "../node/EdgeComponent.svelte";
  import ContextMenu from "../ui/ContextMenu.svelte";

  const NODE_W = 130;
  const NODE_H = 64;

  export let zoom = 1;

  let svgEl;
  let wrapperEl;
  let panX = 0;
  let panY = 0;
  let panning = false;

  let pendingFrom = null;
  let pendingX = 0;
  let pendingY = 0;

  let contextMenu = null;
  let canvasContextMenu = null;
  let selectedNodeId = null;
  let inlineEdit = null;
  let inlineInputEl;

  const logic = createCanvasLogic({
    getZoom: () => zoom,
    setZoom: (z) => {
      zoom = z;
    },
    getNodes: () => $nodes,
    updateNodeFn: (id, patch, silent) => updateNode(id, patch, silent),
  });

  function syncPan() {
    panX = logic.getPanX();
    panY = logic.getPanY();
    panning = logic.isPanning();
  }

  function onWindowMousemove(e) {
    logic.onMousemove(e.clientX, e.clientY);
    syncPan();
    if (pendingFrom !== null) {
      const pt = logic.getSVGPoint(e.clientX, e.clientY);
      pendingX = pt.x;
      pendingY = pt.y;
    }
  }

  function onWindowMouseup() {
    logic.onMouseup(pushHistory);
    syncPan();
    if (pendingFrom !== null) {
      pendingFrom = null;
    }
  }

  function onSVGMousedown(e) {
    canvasContextMenu = null;
    if (e.button !== 0) return;
    if (logic.isBackground(e.target)) {
      selectedNodeId = null;
      contextMenu = null;
      commitInlineEdit();
      logic.startPan(e.clientX, e.clientY);
      syncPan();
    }
  }

  function onSVGContextMenu(e) {
    e.preventDefault();
    contextMenu = null;
    const pt = logic.getSVGPoint(e.clientX, e.clientY);
    canvasContextMenu = {
      clientX: e.clientX,
      clientY: e.clientY,
      svgX: pt.x,
      svgY: pt.y,
    };
  }

  function onCanvasAddNode() {
    pushHistory();
    const node = createNode(
      canvasContextMenu.svgX - NODE_W / 2,
      canvasContextMenu.svgY - NODE_H / 2,
    );
    addNode(node);
    pushHistory();
    canvasContextMenu = null;
  }

  function onNodeDragstart({ e, nodeId }) {
    e.stopPropagation();
    contextMenu = null;
    canvasContextMenu = null;
    selectedNodeId = nodeId;
    logic.startDrag(nodeId, e.clientX, e.clientY);
  }

  function onPortDragstart({ e, nodeId }) {
    e.stopPropagation();
    const pt = logic.getSVGPoint(e.clientX, e.clientY);
    pendingFrom = nodeId;
    pendingX = pt.x;
    pendingY = pt.y;
  }

  function onConnectTarget({ nodeId }) {
    if (pendingFrom !== null && pendingFrom !== nodeId) {
      pushHistory();
      connectNodes(pendingFrom, nodeId);
      pushHistory();
    }
    pendingFrom = null;
  }

  function onContextMenu({ e, node }) {
    e.preventDefault();
    commitInlineEdit();
    canvasContextMenu = null;
    contextMenu = { x: e.clientX, y: e.clientY, node };
    selectedNodeId = node.id;
  }

  function onNodeDblClick({ node }) {
    commitInlineEdit();
    contextMenu = null;
    selectedNodeId = node.id;
    const pos = logic.getInlineEditPos(node);
    inlineEdit = { nodeId: node.id, x: pos.x, y: pos.y, value: node.data };
    setTimeout(() => {
      inlineInputEl?.focus();
      inlineInputEl?.select();
    }, 10);
  }

  function commitInlineEdit() {
    if (!inlineEdit) return;
    pushHistory();
    updateNode(inlineEdit.nodeId, { data: inlineEdit.value });
    pushHistory();
    inlineEdit = null;
  }

  function cancelInlineEdit() {
    inlineEdit = null;
  }

  function onInlineKeydown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitInlineEdit();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      cancelInlineEdit();
    }
  }

  function onMenuClose() {
    contextMenu = null;
  }
  function onMenuRename({ varName }) {
    pushHistory();
    updateNode(contextMenu.node.id, { varName });
    pushHistory();
    contextMenu = null;
  }
  function onMenuEditData({ data }) {
    pushHistory();
    updateNode(contextMenu.node.id, { data });
    pushHistory();
    contextMenu = null;
  }
  function onMenuDisconnect() {
    pushHistory();
    disconnectNode(contextMenu.node.id);
    pushHistory();
    contextMenu = null;
  }
  function onMenuSetHead() {
    pushHistory();
    setHead($headId === contextMenu.node.id ? null : contextMenu.node.id);
    pushHistory();
    contextMenu = null;
  }
  function onMenuSetTail() {
    pushHistory();
    setTail($tailId === contextMenu.node.id ? null : contextMenu.node.id);
    pushHistory();
    contextMenu = null;
  }
  function onMenuSetWalk() {
    pushHistory();
    setWalk($walkId === contextMenu.node.id ? null : contextMenu.node.id);
    pushHistory();
    contextMenu = null;
  }
  function onMenuUnlink() {
    pushHistory();
    removeNodeFromList(contextMenu.node.id);
    pushHistory();
    contextMenu = null;
  }

  function edgePos(edge, ns) {
    const from = ns.find((n) => n.id === edge.from);
    const to = ns.find((n) => n.id === edge.to);
    if (!from || !to) return null;
    return {
      fromX: from.x + NODE_W - 8,
      fromY: from.y + NODE_H / 2,
      toX: to.x,
      toY: to.y + NODE_H / 2,
    };
  }

  function onKeydown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "z") {
      e.preventDefault();
      undo();
    }
    if (
      (e.ctrlKey || e.metaKey) &&
      (e.key === "y" || (e.shiftKey && e.key === "z"))
    ) {
      e.preventDefault();
      redo();
    }
  }

  function onBeforeUnload(e) {
    if ($nodes.length > 0) {
      e.preventDefault();
      e.returnValue = "";
    }
  }

  function handleWheel(e) {
    logic.onWheel(e);
    // Sync setelah rAF selesai
    requestAnimationFrame(() => syncPan());
  }

  onMount(() => {
    logic.setSvgEl(svgEl);
    window.addEventListener("keydown", onKeydown);
    window.addEventListener("beforeunload", onBeforeUnload);
    svgEl.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      window.removeEventListener("keydown", onKeydown);
      window.removeEventListener("beforeunload", onBeforeUnload);
      svgEl?.removeEventListener("wheel", handleWheel);
    };
  });
</script>

<svelte:window on:mousemove={onWindowMousemove} on:mouseup={onWindowMouseup} />

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="canvas-wrapper" bind:this={wrapperEl}>
  <svg
    bind:this={svgEl}
    class="canvas-svg"
    class:panning
    on:mousedown={onSVGMousedown}
    on:contextmenu={onSVGContextMenu}
  >
    <defs>
      <pattern
        id="grid"
        width={28}
        height={28}
        patternUnits="userSpaceOnUse"
        patternTransform="translate({panX}, {panY}) scale({zoom})"
      >
        <circle cx="14" cy="14" r="0.8" fill="var(--border)" />
      </pattern>
      <!-- marker defs tetap sama -->
    </defs>

    <rect width="100%" height="100%" fill="url(#grid)" />

    <g
      style="transform: translate({panX}px, {panY}px) scale({zoom}); transform-origin: 0 0; will-change: transform;"
    >
      {#each $edges as edge (edge.from + "-" + edge.to)}
        {#if edgePos(edge, $nodes)}
          {@const pos = edgePos(edge, $nodes)}
          <EdgeComponent {...pos} />
        {/if}
      {/each}

      {#if pendingFrom !== null}
        {#if $nodes.find((n) => n.id === pendingFrom)}
          {@const from = $nodes.find((n) => n.id === pendingFrom)}
          <EdgeComponent
            fromX={from.x + NODE_W - 8}
            fromY={from.y + NODE_H / 2}
            toX={pendingX}
            toY={pendingY}
            pending={true}
          />
        {/if}
      {/if}

      {#each $nodes as node (node.id)}
        <NodeComponent
          {node}
          selected={selectedNodeId === node.id}
          connecting={pendingFrom === node.id}
          isHead={$headId === node.id}
          isTail={$tailId === node.id}
          isWalk={$walkId === node.id}
          ondragstart={onNodeDragstart}
          onportdragstart={onPortDragstart}
          onconnecttarget={onConnectTarget}
          oncontextmenu={onContextMenu}
          ondblclick={onNodeDblClick}
        />
      {/each}
    </g>
  </svg>

  {#if inlineEdit}
    <input
      class="inline-edit"
      bind:this={inlineInputEl}
      bind:value={inlineEdit.value}
      style="left: {inlineEdit.x}px; top: {inlineEdit.y}px;"
      on:keydown={onInlineKeydown}
      on:blur={commitInlineEdit}
      placeholder="value"
      spellcheck="false"
    />
  {/if}

  {#if $nodes.length === 0}
    <div class="empty-hint">
      <svg
        class="empty-illustration"
        viewBox="0 0 200 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <!-- Node 1 -->
        <rect
          x="10"
          y="20"
          width="60"
          height="40"
          rx="8"
          fill="var(--node-bg)"
          stroke="var(--border-bright)"
          stroke-width="1.5"
        />
        <text
          x="40"
          y="36"
          text-anchor="middle"
          font-family="monospace"
          font-size="7"
          fill="var(--accent)">node1</text
        >
        <line
          x1="18"
          y1="40"
          x2="52"
          y2="40"
          stroke="var(--border)"
          stroke-width="1"
        />
        <text
          x="40"
          y="52"
          text-anchor="middle"
          font-family="monospace"
          font-size="9"
          fill="var(--text-muted)">null</text
        >
        <circle cx="65" cy="40" r="4" fill="var(--accent)" class="port-dot" />

        <!-- Arrow -->
        <path
          d="M69 40 H105"
          stroke="var(--accent)"
          stroke-width="1.5"
          stroke-linecap="round"
          class="arrow-line"
        />
        <polygon
          points="102,36 110,40 102,44"
          fill="var(--accent)"
          class="arrow-head"
        />

        <!-- Node 2 -->
        <rect
          x="110"
          y="20"
          width="60"
          height="40"
          rx="8"
          fill="var(--node-bg)"
          stroke="var(--border-bright)"
          stroke-width="1.5"
        />
        <text
          x="140"
          y="36"
          text-anchor="middle"
          font-family="monospace"
          font-size="7"
          fill="var(--accent)">node2</text
        >
        <line
          x1="118"
          y1="40"
          x2="152"
          y2="40"
          stroke="var(--border)"
          stroke-width="1"
        />
        <text
          x="140"
          y="52"
          text-anchor="middle"
          font-family="monospace"
          font-size="9"
          fill="var(--text-muted)">null</text
        >

        <!-- Ground symbol -->
        <line
          x1="165"
          y1="40"
          x2="182"
          y2="40"
          stroke="var(--text-muted)"
          stroke-width="1.5"
        />
        <line
          x1="182"
          y1="40"
          x2="182"
          y2="54"
          stroke="var(--text-muted)"
          stroke-width="1.5"
        />
        <line
          x1="175"
          y1="54"
          x2="189"
          y2="54"
          stroke="var(--text-muted)"
          stroke-width="1.5"
        />
        <line
          x1="177"
          y1="59"
          x2="187"
          y2="59"
          stroke="var(--text-muted)"
          stroke-width="1.5"
        />
        <line
          x1="179"
          y1="64"
          x2="185"
          y2="64"
          stroke="var(--text-muted)"
          stroke-width="1.5"
        />
      </svg>

      <div class="empty-title">Canvas is empty</div>
      <div class="empty-hints-list">
        <div class="empty-hint-item">
          <kbd>Click</kbd> <span>Add Node in toolbar</span>
        </div>
        <div class="empty-hint-item">
          <kbd>Right click</kbd> <span>anywhere on canvas</span>
        </div>
      </div>
    </div>
  {/if}
</div>

{#if contextMenu}
  <ContextMenu
    x={contextMenu.x}
    y={contextMenu.y}
    node={$nodes.find((n) => n.id === contextMenu.node.id)}
    isHead={$headId === contextMenu.node.id}
    isTail={$tailId === contextMenu.node.id}
    isWalk={$walkId === contextMenu.node.id}
    hasNext={!!$nodes.find((n) => n.id === contextMenu.node.id)?.nextId}
    hasPrev={false}
    onclose={onMenuClose}
    onrename={onMenuRename}
    oneditData={onMenuEditData}
    ondisconnectNext={onMenuDisconnect}
    onsetHead={onMenuSetHead}
    onsetTail={onMenuSetTail}
    onsetWalk={onMenuSetWalk}
    onunlink={onMenuUnlink}
  />
{/if}

{#if canvasContextMenu}
  <div
    class="canvas-ctx-menu"
    style="left: {canvasContextMenu.clientX}px; top: {canvasContextMenu.clientY}px;"
  >
    <button class="ctx-item" on:click={onCanvasAddNode}>
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <circle
          cx="6.5"
          cy="6.5"
          r="5"
          stroke="currentColor"
          stroke-width="1.3"
        />
        <path
          d="M6.5 4v5M4 6.5h5"
          stroke="currentColor"
          stroke-width="1.3"
          stroke-linecap="round"
        />
      </svg>
      Add Node here
    </button>
  </div>
{/if}

<style>
  .canvas-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: var(--bg);
  }
  .canvas-svg {
    width: 100%;
    height: 100%;
    display: block;
    cursor: grab;
    user-select: none;
  }
  .canvas-svg.panning {
    cursor: grabbing;
  }
  .inline-edit {
    position: fixed;
    transform: translateX(-50%);
    width: 110px;
    background: var(--surface2);
    border: 1.5px solid var(--accent);
    border-radius: 6px;
    color: var(--text);
    font-family: var(--font-mono);
    font-size: 13px;
    font-weight: 500;
    padding: 4px 8px;
    text-align: center;
    outline: none;
    box-shadow:
      0 0 0 3px var(--accent-glow),
      0 4px 16px rgba(0, 0, 0, 0.4);
    z-index: 500;
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
    gap: 16px;
    animation: fadeIn 0.4s ease;
  }
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translate(-50%, -48%);
    }
    to {
      opacity: 1;
      transform: translate(-50%, -50%);
    }
  }

  .empty-illustration {
    width: 200px;
    height: 80px;
    opacity: 0.5;
  }

  .port-dot {
    animation: pulse 2s ease-in-out infinite;
  }

  .arrow-line,
  .arrow-head {
    animation: fadeFlow 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 0.4;
    }
    50% {
      opacity: 1;
    }
  }

  @keyframes fadeFlow {
    0%,
    100% {
      opacity: 0.3;
    }
    50% {
      opacity: 1;
    }
  }

  .empty-title {
    font-family: var(--font-ui);
    font-size: 15px;
    font-weight: 700;
    color: var(--text-muted);
  }

  .empty-hints-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
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
  .empty-title {
    font-family: var(--font-ui);
    font-size: 16px;
    font-weight: 700;
    color: var(--text-muted);
    margin-bottom: 6px;
  }
  .canvas-ctx-menu {
    position: fixed;
    z-index: 1000;
    background: var(--surface);
    border: 1px solid var(--border-bright);
    border-radius: 10px;
    padding: 6px;
    min-width: 160px;
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
  .ctx-item:hover {
    background: var(--surface2);
    color: var(--text);
  }
</style>
