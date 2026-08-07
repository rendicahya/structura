<script>
    import { onMount } from "svelte";
    import EdgeComponent from "../node/EdgeComponent.svelte";
    import CanvasDefs from "./CanvasDefs.svelte";
    import { createCanvasLogic } from "../../utils/canvasLogic.js";
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
    import { pushHistory, undo, redo } from "../../stores/shared/history.js";
    import { toast } from "../../stores/shared/toast.js";

    const NODE_R = 28;

    let { zoom = $bindable(1) } = $props();

    /** @type {SVGSVGElement} */
    let svgEl = $state();
    let panX = $state(0);
    let panY = $state(0);
    let panning = $state(false);

    /** @type {string|null} */
    let pendingFrom = $state(null);
    let pendingX = $state(0);
    let pendingY = $state(0);

    /** @type {{ x: number, y: number, svgX?: number, svgY?: number, type: 'canvas'|'node', nodeId?: string }|null} */
    let contextMenu = $state(null);

    /** @type {{ nodeId: string, x: number, y: number, value: string }|null} */
    let inlineEdit = $state(null);
    let inlineInputEl = $state();

    const logic = createCanvasLogic({
        getZoom: () => zoom,
        setZoom: (z) => {
            zoom = z;
        },
        getNodes: () => $graphNodes,
        updateNodeFn: (id, patch, silent) => updateGraphNode(id, patch, silent),
    });

    function syncPan() {
        panX = logic.getPanX();
        panY = logic.getPanY();
        panning = logic.isPanning();
    }

    function blockedByTraversal() {
        if ($traversalState.order.length > 0) {
            toast.error("Stop traversal playback first");
            return true;
        }
        return false;
    }

    /** @param {MouseEvent} e */
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
        if (pendingFrom !== null) pendingFrom = null;
    }

    /** @param {MouseEvent} e */
    function onSVGMousedown(e) {
        if (e.button !== 0) return;
        if (logic.isBackground(e.target)) {
            contextMenu = null;
            commitInlineEdit();
            logic.startPan(e.clientX, e.clientY);
            syncPan();
        }
    }

    /** @param {MouseEvent} e */
    function onSVGContextMenu(e) {
        e.preventDefault();
        const pt = logic.getSVGPoint(e.clientX, e.clientY);
        contextMenu = { x: e.clientX, y: e.clientY, svgX: pt.x, svgY: pt.y, type: "canvas" };
    }

    function handleAddNode() {
        if (!contextMenu) return;
        pushHistory();
        addGraphNode({ x: contextMenu.svgX, y: contextMenu.svgY });
        pushHistory();
        contextMenu = null;
    }

    /** @param {MouseEvent} e @param {string} nodeId */
    function onNodeMousedown(e, nodeId) {
        e.stopPropagation();
        if (e.button !== 0) return;
        contextMenu = null;
        if ($traversalState.order.length === 0) setStartNode(nodeId);
        logic.startDrag(nodeId, e.clientX, e.clientY);
    }

    /** @param {MouseEvent} e @param {string} nodeId */
    function onPortMousedown(e, nodeId) {
        e.stopPropagation();
        const pt = logic.getSVGPoint(e.clientX, e.clientY);
        pendingFrom = nodeId;
        pendingX = pt.x;
        pendingY = pt.y;
    }

    /** @param {string} nodeId */
    function onNodeMouseup(nodeId) {
        if (pendingFrom !== null && pendingFrom !== nodeId && !blockedByTraversal()) {
            pushHistory();
            addEdge(pendingFrom, nodeId);
            pushHistory();
        }
        pendingFrom = null;
    }

    /** @param {MouseEvent} e @param {string} nodeId */
    function onNodeContextMenu(e, nodeId) {
        e.preventDefault();
        e.stopPropagation();
        commitInlineEdit();
        contextMenu = { x: e.clientX, y: e.clientY, type: "node", nodeId };
    }

    /** @param {string} nodeId */
    function onNodeDblClick(nodeId) {
        const node = $graphNodes.find((n) => n.id === nodeId);
        if (!node || !svgEl) return;
        contextMenu = null;
        const pos = logic.getInlineEditPos(node);
        inlineEdit = { nodeId, x: pos.x, y: pos.y, value: node.data };
        setTimeout(() => {
            inlineInputEl?.focus();
            inlineInputEl?.select();
        }, 10);
    }

    function commitInlineEdit() {
        if (!inlineEdit) return;
        pushHistory();
        updateGraphNode(inlineEdit.nodeId, { data: inlineEdit.value });
        pushHistory();
        inlineEdit = null;
    }

    function cancelInlineEdit() {
        inlineEdit = null;
    }

    /** @param {KeyboardEvent} e */
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

    /**
     * Point on the circle of radius r centered at (cx,cy) closest to (fromX,fromY).
     */
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

    let traversalCurrentId = $derived(
        $traversalState.index >= 0 ? ($traversalState.order[$traversalState.index] ?? null) : null,
    );
    let traversalVisitedIds = $derived(
        new Set($traversalState.order.slice(0, Math.max(0, $traversalState.index))),
    );

    /** @param {KeyboardEvent} e */
    function onKeydown(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === "z") {
            e.preventDefault();
            undo();
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.shiftKey && e.key === "z"))) {
            e.preventDefault();
            redo();
        }
    }

    /** @param {WheelEvent} e */
    function handleWheel(e) {
        logic.onWheel(e);
        requestAnimationFrame(() => syncPan());
    }

    onMount(() => {
        logic.setSvgEl(svgEl);
        window.addEventListener("keydown", onKeydown);
        svgEl.addEventListener("wheel", handleWheel, { passive: false });

        return () => {
            window.removeEventListener("keydown", onKeydown);
            svgEl?.removeEventListener("wheel", handleWheel);
        };
    });
</script>

<svelte:window onmousemove={onWindowMousemove} onmouseup={onWindowMouseup} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="canvas-wrapper">
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <svg
        bind:this={svgEl}
        class="canvas-svg"
        class:panning
        onmousedown={onSVGMousedown}
        oncontextmenu={onSVGContextMenu}
    >
        <CanvasDefs {panX} {panY} {zoom} markerPrefix="graph" />

        <rect width="100%" height="100%" fill="url(#grid)" />

        <g
            style="transform: translate({panX}px, {panY}px) scale({zoom}); transform-origin: 0 0; will-change: transform;"
        >
            {#each $graphEdges as edge (`${edge.from}-${edge.to}`)}
                {#if edgePos(edge, $graphNodes)}
                    {@const pos = edgePos(edge, $graphNodes)}
                    <EdgeComponent {...pos} markerPrefix="graph" />
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
                        markerPrefix="graph"
                    />
                {/if}
            {/if}

            {#each $graphNodes as node (node.id)}
                {@const isStart = node.id === $traversalState.startNodeId}
                {@const isCurrent = node.id === traversalCurrentId}
                {@const isVisited = traversalVisitedIds.has(node.id)}

                <g style="transform: translate({node.x}px, {node.y}px);">
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <g
                        class="graph-node"
                        class:traversal-current={isCurrent}
                        class:traversal-visited={isVisited}
                        onmousedown={(e) => onNodeMousedown(e, node.id)}
                        onmouseup={() => onNodeMouseup(node.id)}
                        oncontextmenu={(e) => onNodeContextMenu(e, node.id)}
                        ondblclick={() => onNodeDblClick(node.id)}
                    >
                        <circle cx="2" cy="3" r={NODE_R} fill="rgba(0,0,0,0.3)" />

                        <circle
                            class="node-circle"
                            cx="0"
                            cy="0"
                            r={NODE_R}
                            fill={isVisited ? "var(--accent-glow)" : "var(--node-bg)"}
                            stroke={isCurrent
                                ? "var(--warning)"
                                : isStart
                                  ? "var(--accent)"
                                  : "var(--node-border)"}
                            stroke-width={isCurrent || isStart ? 2.5 : 1.5}
                        />

                        <line x1="-16" y1="-3" x2="16" y2="-3" stroke="var(--border)" stroke-width="1" opacity="0.6" />

                        <text
                            x="0"
                            y="11"
                            text-anchor="middle"
                            font-family="var(--font-mono)"
                            font-size="12"
                            fill={node.data ? "var(--text)" : "var(--text-muted)"}
                            font-weight={node.data ? "500" : "400"}
                            >{node.data || "null"}</text
                        >

                        <text
                            x="0"
                            y="-9"
                            text-anchor="middle"
                            font-family="var(--font-mono)"
                            font-size="8"
                            fill="var(--accent)"
                            font-weight="500">{node.varName}</text
                        >

                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                        <circle
                            class="port"
                            cx="0"
                            cy={NODE_R}
                            r="5"
                            fill="var(--node-border)"
                            stroke="var(--border-bright)"
                            stroke-width="1"
                            onmousedown={(e) => onPortMousedown(e, node.id)}
                        />
                    </g>
                </g>
            {/each}
        </g>
    </svg>

    {#if inlineEdit}
        <input
            class="inline-edit"
            bind:this={inlineInputEl}
            bind:value={inlineEdit.value}
            style="left: {inlineEdit.x}px; top: {inlineEdit.y}px;"
            onkeydown={onInlineKeydown}
            onblur={commitInlineEdit}
            placeholder="value"
            spellcheck="false"
        />
    {/if}

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
</div>

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
    .graph-node {
        cursor: grab;
    }
    .graph-node:active {
        cursor: grabbing;
    }
    .port {
        cursor: crosshair;
    }
    .edge-hit {
        cursor: pointer;
        pointer-events: stroke;
    }
    .graph-node.traversal-current .node-circle {
        animation: graphTraversalPulse 900ms ease-in-out infinite;
    }
    @keyframes graphTraversalPulse {
        0%, 100% { filter: drop-shadow(0 0 0 rgba(240, 180, 41, 0)); }
        50% { filter: drop-shadow(0 0 6px var(--warning)); }
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
        gap: 20px;
        animation: fadeIn 0.4s ease;
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
    .ctx-item.danger:hover {
        background: rgba(255, 91, 110, 0.1);
    }
</style>
