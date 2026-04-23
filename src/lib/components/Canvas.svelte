<script>
  import { onMount } from 'svelte';
  import { nodes, edges, updateNode, removeNodeFromList, connectNodes, disconnectNode, headId, tailId, walkId, setHead, setTail, setWalk } from '../stores/graph.js';
  import { pushHistory, undo, redo } from '../stores/history.js';
  import { createNode, addNode } from '../stores/graph.js';
  import NodeComponent from './NodeComponent.svelte';
  import EdgeComponent from './EdgeComponent.svelte';
  import ContextMenu from './ContextMenu.svelte';

  const NODE_W = 130;
  const NODE_H = 64;
  const ZOOM_STEP = 0.1;
  const ZOOM_MIN  = 0.3;
  const ZOOM_MAX  = 2;

  export let zoom = 1;

  let dragging = null;
  let svgEl;
  let wrapperEl;

  // Use separate x/y so Svelte reactivity triggers properly
  let pendingFrom = null;
  let pendingX = 0;
  let pendingY = 0;

  let contextMenu = null;
  let canvasContextMenu = null;
  let selectedNodeId = null;

  let inlineEdit = null;
  let inlineInputEl;

  // Pan state
  let panX = 0;
  let panY = 0;
  let panning = false;
  let panStartX = 0;
  let panStartY = 0;

  let spaceDown = false;

  function onWheel(e) {
    e.preventDefault();
    const rect = svgEl.getBoundingClientRect();

    // Posisi mouse relatif ke SVG sebelum zoom
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
    const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, +(zoom + delta).toFixed(2)));

    // Adjust pan agar titik di bawah mouse tidak bergeser
    panX = mouseX - (mouseX - panX) * (newZoom / zoom);
    panY = mouseY - (mouseY - panY) * (newZoom / zoom);
    zoom = newZoom;
  }

  function getSVGPoint(clientX, clientY) {
    const rect = svgEl.getBoundingClientRect();
    return {
      x: (clientX - rect.left - panX) / zoom,
      y: (clientY - rect.top  - panY) / zoom,
    };
  }

  function onWindowMousemove(e) {
    if (panning) {
      panX = e.clientX - panStartX;
      panY = e.clientY - panStartY;
      return;
    }
    if (dragging) {
      const pt = getSVGPoint(e.clientX, e.clientY);
      updateNode(dragging.nodeId, {
        x: pt.x - dragging.offsetX,
        y: pt.y - dragging.offsetY,
      });
    }
    if (pendingFrom !== null) {
      const pt = getSVGPoint(e.clientX, e.clientY);
      pendingX = pt.x;
      pendingY = pt.y;
    }
  }

  function onWindowMouseup() {
    if (panning) { panning = false; return; }
    if (dragging) { pushHistory(); dragging = null; }
    if (pendingFrom !== null) { pendingFrom = null; }
  }

  function onSVGMousedown(e) {
    canvasContextMenu = null;
    if (e.button === 1 || (e.button === 0 && spaceDown)) {
      e.preventDefault();
      panning = true;
      panStartX = e.clientX - panX;
      panStartY = e.clientY - panY;
      return;
    }
    if (e.target === svgEl || e.target.tagName === 'svg') {
      selectedNodeId = null;
      contextMenu = null;
      commitInlineEdit();
    }
  }

  function onSVGContextMenu(e) {
    e.preventDefault();
    contextMenu = null;
    const pt = getSVGPoint(e.clientX, e.clientY);
    canvasContextMenu = { clientX: e.clientX, clientY: e.clientY, svgX: pt.x, svgY: pt.y };
  }

  function onCanvasAddNode() {
    pushHistory();
    const node = createNode(canvasContextMenu.svgX - NODE_W / 2, canvasContextMenu.svgY - NODE_H / 2);
    addNode(node);
    pushHistory();
    canvasContextMenu = null;
  }

  function onNodeDragstart({ detail }) {
    const { e, nodeId } = detail;
    e.stopPropagation();
    contextMenu = null;
    canvasContextMenu = null;
    selectedNodeId = nodeId;
    const pt = getSVGPoint(e.clientX, e.clientY);
    const node = $nodes.find(n => n.id === nodeId);
    dragging = { nodeId, offsetX: pt.x - node.x, offsetY: pt.y - node.y };
  }

  function onPortDragstart({ detail }) {
    const { e, nodeId } = detail;
    e.stopPropagation();
    const pt = getSVGPoint(e.clientX, e.clientY);
    pendingFrom = nodeId;
    pendingX = pt.x;
    pendingY = pt.y;
  }

  function onConnectTarget({ detail }) {
    const { nodeId } = detail;
    if (pendingFrom !== null && pendingFrom !== nodeId) {
      pushHistory();
      connectNodes(pendingFrom, nodeId);
      pushHistory();
    }
    pendingFrom = null;
  }

  function onContextMenu({ detail }) {
    const { e, node } = detail;
    e.preventDefault();
    commitInlineEdit();
    canvasContextMenu = null;
    contextMenu = { x: e.clientX, y: e.clientY, node };
    selectedNodeId = node.id;
  }

  function onNodeDblClick({ detail }) {
    const { node } = detail;
    commitInlineEdit();
    contextMenu = null;
    selectedNodeId = node.id;
    const svgRect = svgEl.getBoundingClientRect();
    inlineEdit = {
      nodeId: node.id,
      x: svgRect.left + node.x * zoom,
      y: svgRect.top  + node.y * zoom + 32 * zoom,
      value: node.data,
    };
    setTimeout(() => { inlineInputEl?.focus(); inlineInputEl?.select(); }, 10);
  }

  function commitInlineEdit() {
    if (!inlineEdit) return;
    pushHistory();
    updateNode(inlineEdit.nodeId, { data: inlineEdit.value });
    pushHistory();
    inlineEdit = null;
  }

  function cancelInlineEdit() { inlineEdit = null; }

  function onInlineKeydown(e) {
    if (e.key === 'Enter')  { e.preventDefault(); commitInlineEdit(); }
    if (e.key === 'Escape') { e.preventDefault(); cancelInlineEdit(); }
  }

  function onMenuClose() { contextMenu = null; }

  function onMenuRename({ detail }) {
    pushHistory();
    updateNode(contextMenu.node.id, { varName: detail.varName });
    pushHistory();
    contextMenu = null;
  }

  function onMenuEditData({ detail }) {
    pushHistory();
    updateNode(contextMenu.node.id, { data: detail.data });
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

  function edgePos(edge, ns) {
    const from = ns.find(n => n.id === edge.from);
    const to   = ns.find(n => n.id === edge.to);
    if (!from || !to) return null;
    return {
      fromX: from.x + NODE_W - 8,
      fromY: from.y + NODE_H / 2,
      toX: to.x,
      toY: to.y + NODE_H / 2,
    };
  }

  function onKeydown(e) {
    if (e.key === ' ' && !e.target.closest('input')) {
      e.preventDefault();
      spaceDown = true;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo(); }
  }

  function onKeyup(e) {
    if (e.key === ' ') spaceDown = false;
  }

  function onBeforeUnload(e) {
    if ($nodes.length > 0) {
      e.preventDefault();
      e.returnValue = '';
    }
  }

  function onMenuUnlink() {
    pushHistory();
    removeNodeFromList(contextMenu.node.id);
    pushHistory();
    contextMenu = null;
  }

  function onMenuSetWalk() {
    pushHistory();
    setWalk($walkId === contextMenu.node.id ? null : contextMenu.node.id);
    pushHistory();
    contextMenu = null;
  }

  onMount(() => {
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('keyup', onKeyup);
    window.addEventListener('beforeunload', onBeforeUnload);
    svgEl.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      window.removeEventListener('keydown', onKeydown);
      window.removeEventListener('keyup', onKeyup);
      window.removeEventListener('beforeunload', onBeforeUnload);
      svgEl.removeEventListener('wheel', onWheel);
    };
  });
</script>

<svelte:window on:mousemove={onWindowMousemove} on:mouseup={onWindowMouseup} />

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="canvas-wrapper" bind:this={wrapperEl}>
  <svg
    bind:this={svgEl}
    class="canvas-svg"
    class:panning={spaceDown || panning}
    on:mousedown={onSVGMousedown}
    on:contextmenu={onSVGContextMenu}
  >
    <defs>
      <marker id="arrow-solid" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#5b8fff" />
      </marker>
      <marker id="arrow-pending" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#f0b429" />
      </marker>
      <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse">
        <circle cx="14" cy="14" r="0.8" fill="var(--border)" />
      </pattern>
    </defs>

    <rect width="100%" height="100%" fill="url(#grid)" />

    <g transform="translate({panX}, {panY}) scale({zoom})">
      {#each $edges as edge (edge.from + '-' + edge.to)}
        {#if edgePos(edge, $nodes)}
          {@const pos = edgePos(edge, $nodes)}
          <EdgeComponent {...pos} />
        {/if}
      {/each}

      {#if pendingFrom !== null}
        {#if $nodes.find(n => n.id === pendingFrom)}
          {@const from = $nodes.find(n => n.id === pendingFrom)}
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
          on:dragstart={onNodeDragstart}
          on:portdragstart={onPortDragstart}
          on:connecttarget={onConnectTarget}
          on:contextmenu={onContextMenu}
          on:dblclick={onNodeDblClick}
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
      <div class="empty-icon">◈</div>
      <div class="empty-title">No nodes yet</div>
      <div class="empty-sub">
        Click <strong>Add Node</strong> or right-click canvas to get started
      </div>
    </div>
  {/if}
</div>

<!-- Node context menu -->
{#if contextMenu}
  <ContextMenu
    x={contextMenu.x}
    y={contextMenu.y}
    node={$nodes.find(n => n.id === contextMenu.node.id)}
    isHead={$headId === contextMenu.node.id}
    isTail={$tailId === contextMenu.node.id}
    isWalk={$walkId === contextMenu.node.id}
    on:close={onMenuClose}
    on:rename={onMenuRename}
    on:editData={onMenuEditData}
    on:disconnect={onMenuDisconnect}
    on:setHead={onMenuSetHead}
    on:setTail={onMenuSetTail}
    on:unlink={onMenuUnlink}
    on:setWalk={onMenuSetWalk}
  />
{/if}

<!-- Canvas context menu -->
{#if canvasContextMenu}
  <div
    class="canvas-ctx-menu"
    style="left: {canvasContextMenu.clientX}px; top: {canvasContextMenu.clientY}px;"
  >
    <button class="ctx-item" on:click={onCanvasAddNode}>
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.3"/>
        <path d="M6.5 4v5M4 6.5h5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
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
    cursor: default;
    user-select: none;
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
    box-shadow: 0 0 0 3px var(--accent-glow), 0 4px 16px rgba(0,0,0,0.4);
    z-index: 500;
  }
  .empty-hint {
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    pointer-events: none;
    animation: fadeIn 0.4s ease;
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translate(-50%, -48%); }
    to   { opacity: 1; transform: translate(-50%, -50%); }
  }
  .empty-icon  { font-size: 40px; color: var(--border-bright); margin-bottom: 12px; }
  .empty-title { font-family: var(--font-ui); font-size: 16px; font-weight: 700; color: var(--text-muted); margin-bottom: 6px; }
  .empty-sub   { font-size: 13px; color: var(--text-muted); line-height: 1.5; }
  .empty-sub strong { color: var(--accent); }

  .canvas-ctx-menu {
    position: fixed;
    z-index: 1000;
    background: var(--surface);
    border: 1px solid var(--border-bright);
    border-radius: 10px;
    padding: 6px;
    min-width: 160px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    animation: menuIn 0.12s ease;
  }
  @keyframes menuIn {
    from { opacity: 0; transform: scale(0.95) translateY(-4px); }
    to   { opacity: 1; transform: scale(1) translateY(0); }
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
  .ctx-item:hover { background: var(--surface2); color: var(--text); }
  .canvas-svg.panning { cursor: grab; }
  .canvas-svg.panning:active { cursor: grabbing; }
</style>