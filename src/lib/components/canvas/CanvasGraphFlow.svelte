<script>
    import { untrack } from "svelte";
    import { SvelteFlow, Background, Controls } from "@xyflow/svelte";
    import "@xyflow/svelte/dist/style.css";
    import GraphFlowNode from "../node/GraphFlowNode.svelte";
    import EdgeComponent from "../node/EdgeComponent.svelte";
    import CanvasDefs from "./CanvasDefs.svelte";
    import {
        graphNodes,
        graphEdges,
        addGraphNode,
        updateGraphNode,
        removeGraphNode,
        addEdge,
        removeEdge,
    } from "../../stores/graph/graphGraph.js";
    import {
        traversalState,
        setStartNode,
    } from "../../stores/graph/graphTraversal.js";
    import { pushHistory } from "../../stores/shared/history.js";
    import { toast } from "../../stores/shared/toast.js";
    import { ZOOM_MIN, ZOOM_MAX } from "../../utils/canvasConstants.js";
    import { isTypingTarget } from "../../utils/keyboard.js";

    const NODE_R = 28;

    let { zoom = $bindable(1) } = $props();

    const nodeTypes = { graph: GraphFlowNode };

    /** @type {HTMLDivElement} */
    let wrapperEl = $state();

    let viewport = $state({ x: 0, y: 0, zoom: 1 });
    // Svelte Flow's own pan/zoom gesture seeds its internal transform once,
    // at mount, from whatever `viewport` holds at that instant, and never
    // re-reads it afterward. Pushing a new zoom into `viewport` from outside
    // (restoring a remembered per-page zoom on mount, or the toolbar's zoom
    // buttons) only updates the value we render from, not that internal
    // transform, so the next drag would otherwise snap back to a transform
    // based on the stale pre-update zoom. Remounting Svelte Flow whenever we
    // push an externally-driven zoom forces it to reseed from the corrected
    // `viewport`, keeping the two in sync. See CanvasSLLFlow.svelte for why
    // `initialViewport` is also wired below: without it, the outgoing
    // instance's own teardown resets `viewport` back to the library default
    // right before the new instance reads it, clobbering our correction.
    let flowGen = $state(0);
    // Only reseed automatically, before the user has touched this mounted
    // instance's pan/zoom directly — once they have, its internal transform
    // is live and trustworthy, and remounting on every toolbar zoom-in/out
    // click would flicker the canvas for no benefit.
    let userInteracted = false;

    /** @type {string|null} */
    let pendingFrom = $state(null);
    let pendingX = $state(0);
    let pendingY = $state(0);

    /** @type {{ x: number, y: number, flowX?: number, flowY?: number, type: 'canvas'|'node', nodeId?: string }|null} */
    let contextMenu = $state(null);

    // The shared App-level zoom (driven by the reused toolbar's zoom
    // buttons, or restored per-page on navigation) is applied into Svelte
    // Flow's own viewport. The reverse direction (scrolling/pinching
    // directly on the canvas updating the shared `zoom` number) is handled
    // event-driven via onMoveEnd below, not reactively, to avoid a
    // bidirectional-effect feedback loop — onMoveEnd's echo lands here with
    // `z` already equal to `viewport.zoom` (Svelte Flow already applied it
    // live), so the equality guard below skips it regardless.
    $effect(() => {
        const z = zoom;
        untrack(() => {
            if (z === viewport.zoom) return;
            viewport = { ...viewport, zoom: z };
            if (!userInteracted) flowGen++;
        });
    });

    function onMoveEnd(event, vp) {
        userInteracted = true;
        zoom = vp.zoom;
    }

    function blockedByTraversal() {
        if ($traversalState.order.length > 0) {
            toast.error("Stop traversal playback first");
            return true;
        }
        return false;
    }

    function clientToFlow(clientX, clientY) {
        if (!wrapperEl) return { x: 0, y: 0 };
        const rect = wrapperEl.getBoundingClientRect();
        return {
            x: (clientX - rect.left - viewport.x) / viewport.zoom,
            y: (clientY - rect.top - viewport.y) / viewport.zoom,
        };
    }

    /** @param {MouseEvent} e */
    function onWindowMousemove(e) {
        if (pendingFrom !== null) {
            const pt = clientToFlow(e.clientX, e.clientY);
            pendingX = pt.x;
            pendingY = pt.y;
        }
    }

    function onWindowMouseup() {
        if (pendingFrom !== null) pendingFrom = null;
    }

    function handleEdit(nodeId, value) {
        pushHistory();
        updateGraphNode(nodeId, { data: value });
        pushHistory();
    }

    /** @param {MouseEvent} e @param {string} nodeId */
    function handlePortMousedown(e, nodeId) {
        const pt = clientToFlow(e.clientX, e.clientY);
        pendingFrom = nodeId;
        pendingX = pt.x;
        pendingY = pt.y;
    }

    /** @param {string} nodeId */
    function handleNodeMouseupTarget(nodeId) {
        if (pendingFrom !== null && pendingFrom !== nodeId && !blockedByTraversal()) {
            pushHistory();
            addEdge(pendingFrom, nodeId);
            pushHistory();
        }
        pendingFrom = null;
    }

    let traversalCurrentId = $derived(
        $traversalState.index >= 0 ? ($traversalState.order[$traversalState.index] ?? null) : null,
    );
    let traversalVisitedIds = $derived(
        new Set($traversalState.order.slice(0, Math.max(0, $traversalState.index))),
    );

    let flowNodes = $derived(
        $graphNodes.map((node) => ({
            id: node.id,
            type: "graph",
            position: { x: node.x - NODE_R, y: node.y - NODE_R },
            data: {
                varName: node.varName,
                value: node.data,
                isStart: node.id === $traversalState.startNodeId,
                isCurrent: node.id === traversalCurrentId,
                isVisited: traversalVisitedIds.has(node.id),
                onEdit: (value) => handleEdit(node.id, value),
                onPortMousedown: (e) => handlePortMousedown(e, node.id),
                onNodeMouseup: () => handleNodeMouseupTarget(node.id),
            },
        })),
    );

    function boundaryPoint(fromX, fromY, cx, cy, r) {
        const dx = cx - fromX;
        const dy = cy - fromY;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        return { x: cx - (dx / dist) * r, y: cy - (dy / dist) * r };
    }

    /** @param {{from: string, to: string}} edge @param {any[]} ns */
    function edgePos(edge, ns) {
        const from = ns.find((n) => n.id === edge.from);
        const to = ns.find((n) => n.id === edge.to);
        if (!from || !to) return null;
        const start = boundaryPoint(to.x, to.y, from.x, from.y, NODE_R);
        const end = boundaryPoint(from.x, from.y, to.x, to.y, NODE_R);
        return { fromX: start.x, fromY: start.y, toX: end.x, toY: end.y };
    }

    // The graph-decor overlay draws edges from $graphNodes (app state), not
    // from Svelte Flow's own live drag position, so the store must be kept
    // in sync on every drag frame (not just on drop) for edges to visually
    // follow the node while dragging. The undo snapshot is taken once at
    // drag start (before any movement) and once at drag stop, so the
    // continuous updates in between don't flood the history stack.
    function onNodeDrag({ targetNode }) {
        if (!targetNode) return;
        updateGraphNode(
            targetNode.id,
            { x: targetNode.position.x + NODE_R, y: targetNode.position.y + NODE_R },
            true,
        );
    }

    function onNodeDragStop({ targetNode }) {
        if (!targetNode) return;
        updateGraphNode(
            targetNode.id,
            { x: targetNode.position.x + NODE_R, y: targetNode.position.y + NODE_R },
            true,
        );
        pushHistory();
    }

    function onNodeClick({ node }) {
        if ($traversalState.order.length === 0) setStartNode(node.id);
    }

    function onNodeDragStart({ node }) {
        pushHistory();
        if ($traversalState.order.length === 0) setStartNode(node.id);
    }

    function onPaneContextMenu({ event }) {
        event.preventDefault();
        const pt = clientToFlow(event.clientX, event.clientY);
        contextMenu = { x: event.clientX, y: event.clientY, flowX: pt.x, flowY: pt.y, type: "canvas" };
    }

    function onNodeContextMenu({ node, event }) {
        event.preventDefault();
        contextMenu = { x: event.clientX, y: event.clientY, type: "node", nodeId: node.id };
    }

    function closeContextMenu() {
        contextMenu = null;
    }

    function handleAddNode() {
        if (!contextMenu) return;
        pushHistory();
        addGraphNode({ x: contextMenu.flowX, y: contextMenu.flowY });
        pushHistory();
        contextMenu = null;
    }

    // "N" shortcut has no cursor position to anchor to (unlike the
    // right-click "Add a node" menu), so it drops the new node at the
    // center of the current viewport instead.
    function handleAddNodeShortcut() {
        if (!wrapperEl) return;
        const rect = wrapperEl.getBoundingClientRect();
        const pt = clientToFlow(rect.left + rect.width / 2, rect.top + rect.height / 2);
        pushHistory();
        addGraphNode(pt);
        pushHistory();
    }

    /** @param {KeyboardEvent} e */
    function onKeydown(e) {
        if (isTypingTarget(e) || e.repeat) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key.toLowerCase() === "n") {
            e.preventDefault();
            handleAddNodeShortcut();
        }
    }

    function handleDeleteNode() {
        if (!contextMenu?.nodeId) return;
        if (blockedByTraversal()) {
            contextMenu = null;
            return;
        }
        const deletedId = contextMenu.nodeId;
        pushHistory();
        removeGraphNode(deletedId);
        pushHistory();
        if ($traversalState.startNodeId === deletedId) setStartNode(null);
        contextMenu = null;
    }

    /** @param {MouseEvent} e @param {string} fromId @param {string} toId */
    function handleDeleteEdge(e, fromId, toId) {
        e.preventDefault();
        e.stopPropagation();
        if (blockedByTraversal()) return;
        pushHistory();
        removeEdge(fromId, toId);
        pushHistory();
    }
</script>

<svelte:window
    onmousemove={onWindowMousemove}
    onmouseup={onWindowMouseup}
    onkeydown={onKeydown}
/>

<div class="canvas-wrapper" bind:this={wrapperEl}>
    {#key flowGen}
        <SvelteFlow
            nodes={flowNodes}
            edges={[]}
            {nodeTypes}
            bind:viewport
            initialViewport={viewport}
            minZoom={ZOOM_MIN}
            maxZoom={ZOOM_MAX}
            onnodedrag={onNodeDrag}
            onnodedragstop={onNodeDragStop}
            onnodedragstart={onNodeDragStart}
            onnodeclick={onNodeClick}
            onnodecontextmenu={onNodeContextMenu}
            onpanecontextmenu={onPaneContextMenu}
            onpaneclick={closeContextMenu}
            onmoveend={onMoveEnd}
        >
            <Background />
            <Controls />
        </SvelteFlow>
    {/key}

    <svg class="graph-decor">
        <CanvasDefs panX={viewport.x} panY={viewport.y} zoom={viewport.zoom} markerPrefix="graph-flow" />
        <g
            style="transform: translate({viewport.x}px, {viewport.y}px) scale({viewport.zoom}); transform-origin: 0 0;"
        >
            {#each $graphEdges as edge (`${edge.from}-${edge.to}`)}
                {#if edgePos(edge, $graphNodes)}
                    {@const pos = edgePos(edge, $graphNodes)}
                    <EdgeComponent {...pos} markerPrefix="graph-flow" />
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <path
                        d="M {pos.fromX} {pos.fromY} Q {(pos.fromX + pos.toX) / 2} {Math.min(pos.fromY, pos.toY) - 40} {pos.toX} {pos.toY}"
                        fill="none"
                        stroke="transparent"
                        stroke-width="14"
                        class="edge-hit"
                        oncontextmenu={(e) => handleDeleteEdge(e, edge.from, edge.to)}
                    />
                {/if}
            {/each}

            {#if pendingFrom !== null}
                {#if $graphNodes.find((n) => n.id === pendingFrom)}
                    {@const from = $graphNodes.find((n) => n.id === pendingFrom)}
                    {@const start = boundaryPoint(pendingX, pendingY, from.x, from.y, NODE_R)}
                    <EdgeComponent
                        fromX={start.x}
                        fromY={start.y}
                        toX={pendingX}
                        toY={pendingY}
                        pending={true}
                        markerPrefix="graph-flow"
                    />
                {/if}
            {/if}
        </g>
    </svg>

    {#if $graphNodes.length === 0}
        <div class="empty-hint">
            <div class="empty-title">Canvas is empty</div>
            <div class="empty-hints-list">
                <div class="empty-hint-item">
                    <kbd>Right click</kbd> <span>anywhere on canvas to add a node</span>
                </div>
                <div class="empty-hint-item">
                    <kbd>Drag</kbd> <span>the small dot below a node to connect it</span>
                </div>
            </div>
        </div>
    {/if}

    {#if contextMenu}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
            class="ctx-menu"
            style="left: {contextMenu.x}px; top: {contextMenu.y}px;"
            onmousedown={(e) => e.stopPropagation()}
        >
            {#if contextMenu.type === "canvas"}
                <button class="ctx-item" onclick={handleAddNode}>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                        <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.3" />
                        <path d="M6.5 4v5M4 6.5h5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
                    </svg>
                    Add a node
                    <kbd class="ctx-shortcut">N</kbd>
                </button>
            {:else}
                <button class="ctx-item danger" onclick={handleDeleteNode}>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                        <path d="M2 6.5h2.5M8.5 6.5H11" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
                    </svg>
                    Delete node
                </button>
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
    :global(.svelte-flow) {
        background: var(--bg);
    }
    .graph-decor {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 5;
    }
    .edge-hit {
        cursor: pointer;
        pointer-events: stroke;
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
        gap: 20px;
        animation: fadeIn 0.4s ease;
        z-index: 5;
    }
    @keyframes fadeIn {
        from { opacity: 0; transform: translate(-50%, -48%); }
        to { opacity: 1; transform: translate(-50%, -50%); }
    }
    .empty-title {
        font-family: var(--font-ui);
        font-size: 18px;
        font-weight: 700;
        color: var(--text-muted);
    }
    .empty-hints-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
        align-items: center;
    }
    .empty-hint-item {
        display: flex;
        align-items: center;
        gap: 8px;
        font-family: var(--font-ui);
        font-size: 14px;
        color: var(--text-muted);
    }
    .empty-hint-item kbd {
        font-family: var(--font-mono);
        font-size: 12px;
        background: var(--surface2);
        border: 1px solid var(--border-bright);
        border-radius: 4px;
        padding: 3px 8px;
        color: var(--text-dim);
    }
    .ctx-menu {
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
        from { opacity: 0; transform: scale(0.95) translateY(-4px); }
        to { opacity: 1; transform: scale(1) translateY(0); }
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
    .ctx-item.danger {
        color: var(--danger);
    }
    .ctx-shortcut {
        margin-left: auto;
        font-family: var(--font-mono);
        font-size: 10px;
        color: var(--text-muted);
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 4px;
        padding: 1px 5px;
    }
    .ctx-item.danger:hover {
        background: rgba(255, 91, 110, 0.1);
    }
</style>
