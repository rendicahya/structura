<script>
    import { untrack } from "svelte";
    import { SvelteFlow, Background, Controls } from "@xyflow/svelte";
    import "@xyflow/svelte/dist/style.css";
    import TreeFlowNode from "../node/TreeFlowNode.svelte";
    import {
        treeNodes,
        rootId,
        treeIsEmpty,
        addTreeNode,
        updateTreeNode,
        removeTreeNode,
        garbageCollectTree,
    } from "../../stores/tree/graphTree.js";
    import { pushHistory } from "../../stores/shared/history.js";
    import { traversalState } from "../../stores/tree/treeTraversal.js";
    import { toast } from "../../stores/shared/toast.js";
    import { ZOOM_MIN, ZOOM_MAX } from "../../utils/canvasConstants.js";
    import { createFlowViewportSync } from "../../utils/flowViewportSync.svelte.js";

    const NODE_R = 34;

    let { zoom = $bindable(1) } = $props();

    const nodeTypes = { tree: TreeFlowNode };

    /** @type {HTMLDivElement} */
    let wrapperEl = $state();

    let initialized = false;
    // See CanvasSLLFlow.svelte: remount Svelte Flow whenever we recenter or
    // push an externally-driven zoom so its internal pan/zoom transform
    // reseeds from the corrected viewport, and wire `initialViewport` to the
    // live `viewport` so the outgoing instance's own teardown-triggered
    // reset can't clobber that correction before the new instance reads it.
    const flow = createFlowViewportSync({
        getZoom: () => zoom,
        setZoom: (z) => (zoom = z),
    });

    /** @type {{ x: number, y: number, type: 'canvas'|'node', nodeId?: string }|null} */
    let contextMenu = $state(null);

    function centerTree() {
        if (!wrapperEl || $treeNodes.length === 0) return false;
        const rect = wrapperEl.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;

        const padding = 80;
        const minX = Math.min(...$treeNodes.map((n) => n.x - NODE_R));
        const maxX = Math.max(...$treeNodes.map((n) => n.x + NODE_R));
        const minY = Math.min(...$treeNodes.map((n) => n.y - NODE_R));
        const maxY = Math.max(...$treeNodes.map((n) => n.y + NODE_R));
        const contentW = maxX - minX;
        const contentH = maxY - minY;
        const scaleX = (rect.width - padding * 2) / contentW;
        const scaleY = (rect.height - padding * 2) / contentH;
        const newZoom = Math.min(Math.min(scaleX, scaleY), 1);

        zoom = newZoom;
        flow.viewport = {
            x: (rect.width - contentW * newZoom) / 2 - minX * newZoom,
            y: (rect.height - contentH * newZoom) / 2 - minY * newZoom + padding / 2,
            zoom: newZoom,
        };
        flow.remount();
        return true;
    }

    $effect(() => {
        const nodes = $treeNodes;
        if (nodes.length > 0 && !initialized && wrapperEl) {
            untrack(() => {
                const attemptCenter = () => {
                    if (centerTree()) {
                        initialized = true;
                    } else if (!initialized) {
                        requestAnimationFrame(attemptCenter);
                    }
                };
                attemptCenter();
            });
        } else if (nodes.length === 0) {
            initialized = false;
        }
    });

    function blockedByTraversal() {
        if ($traversalState.order.length > 0) {
            toast.error("Stop traversal playback first");
            return true;
        }
        return false;
    }

    let reachableIds = $derived(() => {
        const root = $rootId;
        const ns = $treeNodes;
        const reachable = new Set();
        function traverse(id) {
            if (!id) return;
            reachable.add(id);
            const node = ns.find((n) => n.id === id);
            if (!node) return;
            traverse(node.left);
            traverse(node.right);
        }
        traverse(root);
        return reachable;
    });

    function isReachable(nodeId) {
        return reachableIds().has(nodeId);
    }

    let traversalCurrentId = $derived(
        $traversalState.index >= 0 ? ($traversalState.order[$traversalState.index] ?? null) : null,
    );
    let traversalVisitedIds = $derived(
        new Set($traversalState.order.slice(0, Math.max(0, $traversalState.index))),
    );
    let searchOutcomeId = $derived(
        $traversalState.type === "search" &&
            $traversalState.order.length > 0 &&
            $traversalState.index === $traversalState.order.length - 1
            ? traversalCurrentId
            : null,
    );

    function canAddLeft(nodeId) {
        const node = $treeNodes.find((n) => n.id === nodeId);
        return node && !node.left;
    }

    function canAddRight(nodeId) {
        const node = $treeNodes.find((n) => n.id === nodeId);
        return node && !node.right;
    }

    function handleEdit(nodeId, value) {
        pushHistory();
        updateTreeNode(nodeId, { data: value });
        pushHistory();
    }

    let flowNodes = $derived(
        $treeNodes.map((node) => {
            const reachable = isReachable(node.id);
            const isSearchOutcome = node.id === searchOutcomeId;
            return {
                id: node.id,
                type: "tree",
                position: { x: node.x - NODE_R, y: node.y - NODE_R },
                draggable: false,
                selectable: false,
                connectable: false,
                style: "transition: transform 0.3s ease;",
                data: {
                    varName: node.varName,
                    value: node.data,
                    isRoot: node.id === $rootId,
                    reachable,
                    isCurrent: node.id === traversalCurrentId && !isSearchOutcome,
                    isVisited: traversalVisitedIds.has(node.id),
                    isFound: isSearchOutcome && $traversalState.searchFound,
                    isNotFound: isSearchOutcome && !$traversalState.searchFound,
                    onEdit: (value) => handleEdit(node.id, value),
                },
            };
        }),
    );

    function onPaneContextMenu({ event }) {
        event.preventDefault();
        contextMenu = { x: event.clientX, y: event.clientY, type: "canvas" };
    }

    function onNodeContextMenu({ node, event }) {
        event.preventDefault();
        contextMenu = { x: event.clientX, y: event.clientY, type: "node", nodeId: node.id };
    }

    function closeContextMenu() {
        contextMenu = null;
    }

    function handleAddRoot() {
        if (blockedByTraversal()) return;
        pushHistory();
        addTreeNode(null, null);
        pushHistory();
        closeContextMenu();
    }

    function handleAddLeft() {
        if (blockedByTraversal()) return;
        pushHistory();
        addTreeNode(contextMenu?.nodeId ?? null, "left");
        pushHistory();
        closeContextMenu();
    }

    function handleAddRight() {
        if (blockedByTraversal()) return;
        pushHistory();
        addTreeNode(contextMenu?.nodeId ?? null, "right");
        pushHistory();
        closeContextMenu();
    }

    function handleRemove() {
        if (blockedByTraversal()) return;
        pushHistory();
        removeTreeNode(contextMenu?.nodeId ?? "");
        pushHistory();
        closeContextMenu();
    }

    function handleGC() {
        if (blockedByTraversal()) return;
        pushHistory();
        garbageCollectTree();
        pushHistory();
        closeContextMenu();
    }
</script>

<div class="canvas-wrapper" bind:this={wrapperEl}>
    {#key flow.flowGen}
        <SvelteFlow
            nodes={flowNodes}
            edges={[]}
            {nodeTypes}
            bind:viewport={flow.viewport}
            initialViewport={flow.viewport}
            minZoom={ZOOM_MIN}
            maxZoom={ZOOM_MAX}
            onnodecontextmenu={onNodeContextMenu}
            onpanecontextmenu={onPaneContextMenu}
            onpaneclick={closeContextMenu}
            onmoveend={flow.onMoveEnd}
        >
            <Background />
            <Controls />
        </SvelteFlow>
    {/key}

    <svg class="tree-decor">
        <defs>
            <marker id="arrow-tree-flow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="var(--border-bright)" />
            </marker>
        </defs>
        <g
            style="transform: translate({flow.viewport.x}px, {flow.viewport.y}px) scale({flow.viewport.zoom}); transform-origin: 0 0;"
        >
            {#each $treeNodes as node (node.id)}
                {#if node.left}
                    {@const child = $treeNodes.find((n) => n.id === node.left)}
                    {#if child && isReachable(child.id)}
                        <line
                            x1={node.x}
                            y1={node.y + NODE_R}
                            x2={child.x}
                            y2={child.y - NODE_R - 6}
                            stroke="var(--border-bright)"
                            stroke-width="1.5"
                            marker-end="url(#arrow-tree-flow)"
                            style="transition: all 0.3s ease;"
                        />
                    {/if}
                {/if}
                {#if node.right}
                    {@const child = $treeNodes.find((n) => n.id === node.right)}
                    {#if child && isReachable(child.id)}
                        <line
                            x1={node.x}
                            y1={node.y + NODE_R}
                            x2={child.x}
                            y2={child.y - NODE_R - 6}
                            stroke="var(--border-bright)"
                            stroke-width="1.5"
                            marker-end="url(#arrow-tree-flow)"
                            style="transition: all 0.3s ease;"
                        />
                    {/if}
                {/if}
            {/each}
        </g>
    </svg>

    {#if $treeIsEmpty}
        <div class="empty-hint">
            <div class="empty-title">Canvas is empty</div>
            <div class="empty-hints-list">
                <div class="empty-hint-item">
                    <kbd>Right click</kbd> <span>anywhere on canvas to add a root</span>
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
                {#if $treeIsEmpty}
                    <button class="ctx-item" onclick={handleAddRoot}>
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.3" /><path d="M6.5 4v5M4 6.5h5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /></svg>
                        Add root node
                    </button>
                {:else}
                    <button class="ctx-item" onclick={handleGC}>
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 2C4.3 2 2.5 3.8 2.5 6s1.8 4 4 4 4-1.8 4-4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /><path d="M8.5 2h2.5v2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" /><path d="M8.5 4.5l2.5-2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /></svg>
                        Run GC
                    </button>
                {/if}
            {:else}
                {@const node = $treeNodes.find((n) => n.id === contextMenu.nodeId)}
                {@const reachable = isReachable(contextMenu.nodeId ?? "")}

                {#if reachable && node}
                    {#if canAddLeft(contextMenu.nodeId ?? "")}
                        <button class="ctx-item" onclick={handleAddLeft}>
                            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.3" /><path d="M6.5 4v5M4 6.5h5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /></svg>
                            Add left child
                        </button>
                    {/if}
                    {#if canAddRight(contextMenu.nodeId ?? "")}
                        <button class="ctx-item" onclick={handleAddRight}>
                            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.3" /><path d="M6.5 4v5M4 6.5h5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /></svg>
                            Add right child
                        </button>
                    {/if}
                    {#if canAddLeft(contextMenu.nodeId ?? "") || canAddRight(contextMenu.nodeId ?? "")}
                        <div class="ctx-divider"></div>
                    {/if}
                    <button class="ctx-item danger" onclick={handleRemove}>
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 6.5h2.5M8.5 6.5H11" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /></svg>
                        Remove node
                    </button>
                {:else}
                    <div class="ctx-label">Unreachable — waiting for GC</div>
                    <button class="ctx-item" onclick={handleGC}>Run GC</button>
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
    :global(.svelte-flow) {
        background: var(--bg);
    }
    .tree-decor {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 5;
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
        min-width: 170px;
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
