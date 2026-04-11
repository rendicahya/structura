<script>
  import { onMount } from 'svelte';
  import { nodes, edges, updateNode, removeNode, connectNodes, disconnectNode, headId, tailId, setHead, setTail } from '../stores/graph.js';
  import { pushHistory, undo, redo } from '../stores/history.js';
  import NodeComponent from './NodeComponent.svelte';
  import EdgeComponent from './EdgeComponent.svelte';
  import ContextMenu from './ContextMenu.svelte';

  const NODE_W = 130;
  const NODE_H = 64;

  let dragging = null;
  let svgEl;

  let pendingFrom = null;
  let pendingMouse = { x: 0, y: 0 };
  let mousePos = { x: 0, y: 0 };

  let contextMenu = null;
  let selectedNodeId = null;

  function getSVGPoint(e) {
    const rect = svgEl.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onSVGMousemove(e) {
    mousePos = getSVGPoint(e);
    if (dragging) {
      const { nodeId, offsetX, offsetY } = dragging;
      updateNode(nodeId, { x: mousePos.x - offsetX, y: mousePos.y - offsetY });
    }
    if (pendingFrom) pendingMouse = mousePos;
  }

  function onSVGMouseup(e) {
    if (dragging) { pushHistory(); dragging = null; }
    if (pendingFrom) pendingFrom = null;
  }

  function onSVGMousedown(e) {
    if (e.target === svgEl || e.target.tagName === 'svg') {
      selectedNodeId = null;
      contextMenu = null;
    }
  }

  function onNodeDragstart({ detail }) {
    const { e, nodeId } = detail;
    e.stopPropagation();
    contextMenu = null;
    selectedNodeId = nodeId;
    const pt = getSVGPoint(e);
    const node = $nodes.find(n => n.id === nodeId);
    dragging = { nodeId, offsetX: pt.x - node.x, offsetY: pt.y - node.y };
  }

  function onPortDragstart({ detail }) {
    const { e, nodeId } = detail;
    e.stopPropagation();
    pendingFrom = nodeId;
    pendingMouse = getSVGPoint(e);
  }

  function onConnectTarget({ detail }) {
    const { nodeId } = detail;
    if (pendingFrom && pendingFrom !== nodeId) {
      pushHistory();
      connectNodes(pendingFrom, nodeId);
      pushHistory();
    }
    pendingFrom = null;
  }

  function onContextMenu({ detail }) {
    const { e, node } = detail;
    e.preventDefault();
    contextMenu = { x: e.clientX, y: e.clientY, node };
    selectedNodeId = node.id;
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

  function onMenuDelete() {
    pushHistory();
    removeNode(contextMenu.node.id);
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
    // toggle: unset if already head
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

  function pendingEdgePos(fromId, ns) {
    const from = ns.find(n => n.id === fromId);
    if (!from) return null;
    return {
      fromX: from.x + NODE_W - 8,
      fromY: from.y + NODE_H / 2,
      toX: pendingMouse.x,
      toY: pendingMouse.y,
    };
  }

  function onKeydown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo(); }
  }

  onMount(() => {
    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
  });
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="canvas-wrapper">
  <svg
    bind:this={svgEl}
    class="canvas-svg"
    on:mousemove={onSVGMousemove}
    on:mouseup={onSVGMouseup}
    on:mousedown={onSVGMousedown}
    on:contextmenu|preventDefault
  >
    <defs>
      <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse">
        <circle cx="14" cy="14" r="0.8" fill="var(--border)" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#grid)" />

    {#each $edges as edge (edge.from + '-' + edge.to)}
      {#if edgePos(edge, $nodes)}
        {@const pos = edgePos(edge, $nodes)}
        <EdgeComponent {...pos} />
      {/if}
    {/each}

    {#if pendingFrom}
      {@const pos = pendingEdgePos(pendingFrom, $nodes)}
      {#if pos}
        <EdgeComponent {...pos} pending={true} />
      {/if}
    {/if}

    {#each $nodes as node (node.id)}
      <NodeComponent
        {node}
        selected={selectedNodeId === node.id}
        connecting={pendingFrom === node.id}
        isHead={$headId === node.id}
        isTail={$tailId === node.id}
        on:dragstart={onNodeDragstart}
        on:portdragstart={onPortDragstart}
        on:connecttarget={onConnectTarget}
        on:contextmenu={onContextMenu}
      />
    {/each}
  </svg>

  {#if $nodes.length === 0}
    <div class="empty-hint">
      <div class="empty-icon">◈</div>
      <div class="empty-title">No nodes yet</div>
      <div class="empty-sub">Click <strong>Add Node</strong> to create your first linked list node</div>
    </div>
  {/if}
</div>

{#if contextMenu}
  <ContextMenu
    x={contextMenu.x}
    y={contextMenu.y}
    node={$nodes.find(n => n.id === contextMenu.node.id)}
    isHead={$headId === contextMenu.node.id}
    isTail={$tailId === contextMenu.node.id}
    on:close={onMenuClose}
    on:rename={onMenuRename}
    on:editData={onMenuEditData}
    on:delete={onMenuDelete}
    on:disconnect={onMenuDisconnect}
    on:setHead={onMenuSetHead}
    on:setTail={onMenuSetTail}
  />
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
  .empty-hint {
    position: absolute;
    top: 50%;
    left: 50%;
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
</style>