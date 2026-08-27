<script>
    import { SvelteFlow, Background, Controls, MarkerType } from "@xyflow/svelte";
    import "@xyflow/svelte/dist/style.css";
    import SLLFlowNode from "../node/SLLFlowNode.svelte";
    import ContextMenu from "../ui/ContextMenu.svelte";
    import {
        nodes,
        edges,
        headId,
        tailId,
        walkId,
        createNode,
        addNode,
        updateNode,
        removeNodeFromList,
        connectNodes,
        disconnectNode,
        setHead,
        setTail,
        setWalk,
    } from "../../stores/sll/graph.js";
    import { pushHistory, undo, redo } from "../../stores/shared/history.js";
    import { ZOOM_MIN, ZOOM_MAX } from "../../utils/canvasConstants.js";
    import { createFlowViewportSync } from "../../utils/flowViewportSync.svelte.js";

    let { zoom = $bindable(1) } = $props();

    const nodeTypes = { sll: SLLFlowNode };

    /** @type {HTMLDivElement} */
    let wrapperEl = $state();

    // Svelte Flow's own pan/zoom gesture seeds its internal transform once,
    // at mount, from whatever `viewport` holds at that instant, and never
    // re-reads it afterward. Pushing a new zoom into `viewport` from outside
    // (restoring a remembered per-page zoom on mount, or the toolbar's zoom
    // buttons) only updates the value we render from, not that internal
    // transform, so the next drag would otherwise snap back to a transform
    // based on the stale pre-update zoom. Remounting Svelte Flow whenever we
    // push an externally-driven zoom forces it to reseed from the corrected
    // `viewport`, keeping the two in sync. The outgoing instance's own
    // teardown resets its store's viewport to `initialViewport ?? {zoom:1}`
    // (@xyflow/svelte's resetStoreValues), which — since that write flows
    // straight into our bound `viewport` — would otherwise clobber the very
    // correction we just made, right before the new instance reads it. Wiring
    // `initialViewport` to the live `viewport` below makes that reset a no-op.
    const flow = createFlowViewportSync({
        getZoom: () => zoom,
        setZoom: (z) => (zoom = z),
    });

    /** @type {{ x: number, y: number, node: any }|null} */
    let contextMenu = $state(null);

    /** @type {{ x: number, y: number, flowX: number, flowY: number }|null} */
    let canvasContextMenu = $state(null);

    // The shared App-level zoom (driven by the reused toolbar's zoom
    // buttons, or restored per-page on navigation) is applied into Svelte
    // Flow's own viewport. The reverse direction (scrolling/pinching
    // directly on the canvas updating the shared `zoom` number) is handled
    // event-driven via onMoveEnd below, not reactively, to avoid a
    // bidirectional-effect feedback loop — onMoveEnd's echo lands here with
    // `z` already equal to `viewport.zoom` (Svelte Flow already applied it
    // live), so the equality guard below skips it regardless.
    function handleEdit(nodeId, value) {
        pushHistory();
        updateNode(nodeId, { data: value });
        pushHistory();
    }

    let flowNodes = $derived(
        $nodes.map((n) => ({
            id: n.id,
            type: "sll",
            position: { x: n.x, y: n.y },
            data: {
                varName: n.varName,
                value: n.data,
                isHead: n.id === $headId,
                isTail: n.id === $tailId,
                isWalk: n.id === $walkId,
                hasNext: !!n.nextId,
                onEdit: (value) => handleEdit(n.id, value),
            },
        })),
    );

    let flowEdges = $derived(
        $edges.map((e) => ({
            id: `${e.from}-${e.to}`,
            source: e.from,
            target: e.to,
            markerEnd: { type: MarkerType.ArrowClosed },
        })),
    );

    function onNodeDragStop({ targetNode }) {
        if (!targetNode) return;
        pushHistory();
        updateNode(
            targetNode.id,
            { x: targetNode.position.x, y: targetNode.position.y },
            true,
        );
        pushHistory();
    }

    function isValidConnection(connection) {
        return connection.source !== connection.target;
    }

    function onConnect(connection) {
        if (connection.source === connection.target) return;
        pushHistory();
        connectNodes(connection.source, connection.target);
        pushHistory();
    }

    function onDelete({ nodes: deletedNodes, edges: deletedEdges }) {
        const deletedNodeIds = new Set(deletedNodes.map((n) => n.id));

        for (const n of deletedNodes) {
            pushHistory();
            removeNodeFromList(n.id);
            pushHistory();
        }

        // Edges whose node is also being deleted are already fully handled
        // (relinking/cleanup) by removeNodeFromList above — only handle
        // edges deleted on their own (user selected just the connection).
        for (const e of deletedEdges) {
            if (deletedNodeIds.has(e.source) || deletedNodeIds.has(e.target)) continue;
            pushHistory();
            disconnectNode(e.source);
            pushHistory();
        }
    }

    function onPaneContextMenu({ event }) {
        event.preventDefault();
        contextMenu = null;
        if (!wrapperEl) return;
        const rect = wrapperEl.getBoundingClientRect();
        const flowX = (event.clientX - rect.left - flow.viewport.x) / flow.viewport.zoom;
        const flowY = (event.clientY - rect.top - flow.viewport.y) / flow.viewport.zoom;
        canvasContextMenu = { x: event.clientX, y: event.clientY, flowX, flowY };
    }

    function closeAllMenus() {
        contextMenu = null;
        canvasContextMenu = null;
    }

    function handleAddNode() {
        if (!canvasContextMenu) return;
        pushHistory();
        const node = createNode(canvasContextMenu.flowX, canvasContextMenu.flowY);
        addNode(node);
        pushHistory();
        canvasContextMenu = null;
    }

    function onNodeContextMenu({ node, event }) {
        event.preventDefault();
        canvasContextMenu = null;
        const storeNode = $nodes.find((n) => n.id === node.id);
        if (!storeNode) return;
        contextMenu = { x: event.clientX, y: event.clientY, node: storeNode };
    }

    function closeContextMenu() {
        contextMenu = null;
    }

    function handleEditData({ data }) {
        if (!contextMenu) return;
        pushHistory();
        updateNode(contextMenu.node.id, { data });
        pushHistory();
    }

    function handleDisconnectNext() {
        if (!contextMenu) return;
        pushHistory();
        disconnectNode(contextMenu.node.id);
        pushHistory();
    }

    function handleSetHead() {
        if (!contextMenu) return;
        pushHistory();
        setHead($headId === contextMenu.node.id ? null : contextMenu.node.id);
        pushHistory();
    }

    function handleSetTail() {
        if (!contextMenu) return;
        pushHistory();
        setTail($tailId === contextMenu.node.id ? null : contextMenu.node.id);
        pushHistory();
    }

    function handleSetWalk() {
        if (!contextMenu) return;
        pushHistory();
        setWalk($walkId === contextMenu.node.id ? null : contextMenu.node.id);
        pushHistory();
    }

    function handleUnlink() {
        if (!contextMenu) return;
        pushHistory();
        removeNodeFromList(contextMenu.node.id);
        pushHistory();
    }

    /** @param {KeyboardEvent} e */
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
</script>

<svelte:window onkeydown={onKeydown} />

<div class="canvas-wrapper" bind:this={wrapperEl}>
    {#key flow.flowGen}
        <SvelteFlow
            nodes={flowNodes}
            edges={flowEdges}
            {nodeTypes}
            {isValidConnection}
            bind:viewport={flow.viewport}
            initialViewport={flow.viewport}
            minZoom={ZOOM_MIN}
            maxZoom={ZOOM_MAX}
            connectionRadius={140}
            onnodedragstop={onNodeDragStop}
            onconnect={onConnect}
            ondelete={onDelete}
            onnodecontextmenu={onNodeContextMenu}
            onpanecontextmenu={onPaneContextMenu}
            onpaneclick={closeAllMenus}
            onmoveend={flow.onMoveEnd}
        >
            <Background />
            <Controls />
        </SvelteFlow>
    {/key}

    {#if $nodes.length === 0}
        <div class="empty-hint">
            <div class="empty-title">Canvas is empty</div>
            <div class="empty-hints-list">
                <div class="empty-hint-item">
                    <kbd>Right click</kbd> <span>anywhere on canvas to add a node</span>
                </div>
            </div>
        </div>
    {/if}

    {#if canvasContextMenu}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
            class="canvas-ctx-menu"
            style="left: {canvasContextMenu.x}px; top: {canvasContextMenu.y}px;"
            onmousedown={(e) => e.stopPropagation()}
        >
            <button class="ctx-item" onclick={handleAddNode}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.3" />
                    <path d="M6.5 4v5M4 6.5h5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
                </svg>
                Add a node
            </button>
        </div>
    {/if}

    {#if contextMenu}
        <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            node={$nodes.find((n) => n.id === contextMenu.node.id)}
            isHead={$headId === contextMenu.node.id}
            isTail={$tailId === contextMenu.node.id}
            isWalk={$walkId === contextMenu.node.id}
            hasNext={!!$nodes.find((n) => n.id === contextMenu.node.id)?.nextId}
            isConnected={!!$nodes.find((n) => n.id === contextMenu.node.id)?.nextId ||
                $nodes.some((n) => n.nextId === contextMenu.node.id)}
            onclose={closeContextMenu}
            oneditData={handleEditData}
            ondisconnectNext={handleDisconnectNext}
            onsetHead={handleSetHead}
            onsetTail={handleSetTail}
            onsetWalk={handleSetWalk}
            onunlink={handleUnlink}
        />
    {/if}
</div>

<style>
    .canvas-wrapper {
        position: relative;
        width: 100%;
        height: 100%;
        background: var(--bg);
    }
    :global(.svelte-flow) {
        background: var(--bg);
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
        z-index: 5;
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
</style>
