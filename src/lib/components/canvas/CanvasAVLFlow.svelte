<script>
    import { untrack } from "svelte";
    import { SvelteFlow, Background, Controls } from "@xyflow/svelte";
    import "@xyflow/svelte/dist/style.css";
    import AVLFlowNode from "../node/AVLFlowNode.svelte";
    import {
        avlNodes,
        avlRootId,
        avlIsEmpty,
        deleteAVLNode,
        garbageCollectAVL,
        computeAllBalances,
    } from "../../stores/tree/graphAVL.js";
    import { pushHistory } from "../../stores/shared/history.js";
    import { traversalState } from "../../stores/tree/avlTraversal.js";
    import { toast } from "../../stores/shared/toast.js";
    import { ZOOM_MIN, ZOOM_MAX } from "../../utils/canvasConstants.js";
    import { createFlowViewportSync } from "../../utils/flowViewportSync.svelte.js";

    const NODE_R = 34;

    let { zoom = $bindable(1) } = $props();

    const nodeTypes = { avl: AVLFlowNode };

    /** @type {HTMLDivElement} */
    let wrapperEl = $state();

    let initialized = false;
    const flow = createFlowViewportSync({
        getZoom: () => zoom,
        setZoom: (z) => (zoom = z),
    });

    /** @type {{ x: number, y: number, type: 'canvas'|'node', nodeId?: string }|null} */
    let contextMenu = $state(null);

    function centerTree() {
        if (!wrapperEl || $avlNodes.length === 0) return false;
        const rect = wrapperEl.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;

        const padding = 80;
        const { minX, maxX, minY, maxY } = $avlNodes.reduce(
            (acc, n) => ({
                minX: Math.min(acc.minX, n.x - NODE_R),
                maxX: Math.max(acc.maxX, n.x + NODE_R),
                minY: Math.min(acc.minY, n.y - NODE_R),
                maxY: Math.max(acc.maxY, n.y + NODE_R),
            }),
            { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
        );
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
        const nodes = $avlNodes;
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

    let nodesById = $derived(new Map($avlNodes.map((n) => [n.id, n])));

    let reachableIds = $derived.by(() => {
        const root = $avlRootId;
        const ns = nodesById;
        const reachable = new Set();
        function traverse(id) {
            if (!id || reachable.has(id)) return;
            reachable.add(id);
            const node = ns.get(id);
            if (!node) return;
            traverse(node.left);
            traverse(node.right);
        }
        traverse(root);
        return reachable;
    });

    function isReachable(nodeId) {
        return reachableIds.has(nodeId);
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

    let balances = $derived(computeAllBalances(nodesById));

    let flowNodes = $derived(
        $avlNodes.map((node) => {
            const reachable = isReachable(node.id);
            const isSearchOutcome = node.id === searchOutcomeId;
            return {
                id: node.id,
                type: "avl",
                position: { x: node.x - NODE_R, y: node.y - NODE_R },
                draggable: false,
                selectable: false,
                connectable: false,
                style: "transition: transform 0.3s ease;",
                data: {
                    varName: node.varName,
                    value: node.data,
                    balance: balances.get(node.id),
                    isRoot: node.id === $avlRootId,
                    reachable,
                    isCurrent: node.id === traversalCurrentId && !isSearchOutcome,
                    isVisited: traversalVisitedIds.has(node.id),
                    isFound: isSearchOutcome && $traversalState.searchFound,
                    isNotFound: isSearchOutcome && !$traversalState.searchFound,
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

    function handleInsertFromMenu() {
        if (blockedByTraversal()) return;
        closeContextMenu();
        window.dispatchEvent(new CustomEvent("avl:insert"));
    }

    function handleDelete() {
        if (blockedByTraversal()) return;
        pushHistory();
        deleteAVLNode(contextMenu?.nodeId ?? "");
        pushHistory();
        closeContextMenu();
    }

    function handleGC() {
        if (blockedByTraversal()) return;
        pushHistory();
        garbageCollectAVL();
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

    <svg class="avl-decor">
        <defs>
            <marker id="arrow-avl-flow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="var(--border-bright)" />
            </marker>
        </defs>
        <g
            style="transform: translate({flow.viewport.x}px, {flow.viewport.y}px) scale({flow.viewport.zoom}); transform-origin: 0 0;"
        >
            {#each $avlNodes as node (node.id)}
                {#if node.left}
                    {@const child = nodesById.get(node.left)}
                    {#if child && isReachable(child.id)}
                        <line
                            x1={node.x}
                            y1={node.y + NODE_R}
                            x2={child.x}
                            y2={child.y - NODE_R - 6}
                            stroke="var(--border-bright)"
                            stroke-width="1.5"
                            marker-end="url(#arrow-avl-flow)"
                            style="transition: all 0.3s ease;"
                        />
                    {/if}
                {/if}
                {#if node.right}
                    {@const child = nodesById.get(node.right)}
                    {#if child && isReachable(child.id)}
                        <line
                            x1={node.x}
                            y1={node.y + NODE_R}
                            x2={child.x}
                            y2={child.y - NODE_R - 6}
                            stroke="var(--border-bright)"
                            stroke-width="1.5"
                            marker-end="url(#arrow-avl-flow)"
                            style="transition: all 0.3s ease;"
                        />
                    {/if}
                {/if}
            {/each}
        </g>
    </svg>

    {#if $avlIsEmpty}
        <div class="empty-hint">
            <div class="empty-title">Canvas is empty</div>
            <div class="empty-hints-list">
                <div class="empty-hint-item">
                    <kbd>Right click</kbd> <span>anywhere on canvas to insert a value</span>
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
                <button class="ctx-item" onclick={handleInsertFromMenu}>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.3" /><path d="M6.5 4v5M4 6.5h5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /></svg>
                    Insert value
                </button>
                {#if !$avlIsEmpty}
                    <button class="ctx-item" onclick={handleGC}>
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 2C4.3 2 2.5 3.8 2.5 6s1.8 4 4 4 4-1.8 4-4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /><path d="M8.5 2h2.5v2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" /><path d="M8.5 4.5l2.5-2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /></svg>
                        Run GC
                    </button>
                {/if}
            {:else}
                {@const reachable = isReachable(contextMenu.nodeId ?? "")}

                {#if reachable}
                    <button class="ctx-item danger" onclick={handleDelete}>
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 6.5h2.5M8.5 6.5H11" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /></svg>
                        Delete node
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
    .avl-decor {
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
    .ctx-label {
        font-family: var(--font-mono);
        font-size: 10px;
        color: var(--text-muted);
        padding: 4px 10px 6px;
        font-style: italic;
    }
</style>
