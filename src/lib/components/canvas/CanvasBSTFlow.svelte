<script>
    import { untrack } from "svelte";
    import { SvelteFlow, Background, Controls } from "@xyflow/svelte";
    import "@xyflow/svelte/dist/style.css";
    import BSTFlowNode from "../node/BSTFlowNode.svelte";
    import {
        bstNodes,
        bstRootId,
        bstIsEmpty,
        deleteBSTNode,
        garbageCollectBST,
    } from "../../stores/tree/graphBST.js";
    import { pushHistory } from "../../stores/shared/history.js";
    import { traversalState } from "../../stores/tree/bstTraversal.js";
    import { toast } from "../../stores/shared/toast.js";
    import { ZOOM_MIN, ZOOM_MAX } from "../../utils/canvasConstants.js";

    const NODE_R = 34;

    let { zoom = $bindable(1) } = $props();

    const nodeTypes = { bst: BSTFlowNode };

    /** @type {HTMLDivElement} */
    let wrapperEl = $state();

    let viewport = $state({ x: 0, y: 0, zoom: 1 });
    let initialized = false;
    // See CanvasSLLFlow.svelte: remount Svelte Flow whenever we recenter or
    // push an externally-driven zoom so its internal pan/zoom transform
    // reseeds from the corrected viewport, and wire `initialViewport` to the
    // live `viewport` so the outgoing instance's own teardown-triggered
    // reset can't clobber that correction before the new instance reads it.
    let flowGen = $state(0);
    // Only reseed automatically, before the user has touched this mounted
    // instance's pan/zoom directly — once they have, its internal transform
    // is live and trustworthy, and remounting on every toolbar zoom-in/out
    // click would flicker the canvas for no benefit.
    let userInteracted = false;

    /** @type {{ x: number, y: number, type: 'canvas'|'node', nodeId?: string }|null} */
    let contextMenu = $state(null);

    // The shared toolbar's zoom buttons (or a restored per-page zoom on
    // mount) push into Svelte Flow's viewport; the reverse direction
    // (wheel/pinch on canvas) is captured via onMoveEnd, which lands here
    // with `z` already equal to `viewport.zoom`, so the equality guard skips
    // it regardless.
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

    function centerTree() {
        if (!wrapperEl || $bstNodes.length === 0) return false;
        const rect = wrapperEl.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;

        const padding = 80;
        const minX = Math.min(...$bstNodes.map((n) => n.x - NODE_R));
        const maxX = Math.max(...$bstNodes.map((n) => n.x + NODE_R));
        const minY = Math.min(...$bstNodes.map((n) => n.y - NODE_R));
        const maxY = Math.max(...$bstNodes.map((n) => n.y + NODE_R));
        const contentW = maxX - minX;
        const contentH = maxY - minY;
        const scaleX = (rect.width - padding * 2) / contentW;
        const scaleY = (rect.height - padding * 2) / contentH;
        const newZoom = Math.min(Math.min(scaleX, scaleY), 1);

        zoom = newZoom;
        viewport = {
            x: (rect.width - contentW * newZoom) / 2 - minX * newZoom,
            y: (rect.height - contentH * newZoom) / 2 - minY * newZoom + padding / 2,
            zoom: newZoom,
        };
        flowGen++;
        return true;
    }

    $effect(() => {
        const nodes = $bstNodes;
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
        const root = $bstRootId;
        const ns = $bstNodes;
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

    let flowNodes = $derived(
        $bstNodes.map((node) => {
            const reachable = isReachable(node.id);
            const isSearchOutcome = node.id === searchOutcomeId;
            return {
                id: node.id,
                type: "bst",
                position: { x: node.x - NODE_R, y: node.y - NODE_R },
                draggable: false,
                selectable: false,
                connectable: false,
                style: "transition: transform 0.3s ease;",
                data: {
                    varName: node.varName,
                    value: node.data,
                    isRoot: node.id === $bstRootId,
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
        window.dispatchEvent(new CustomEvent("bst:insert"));
    }

    function handleDelete() {
        if (blockedByTraversal()) return;
        pushHistory();
        deleteBSTNode(contextMenu?.nodeId ?? "");
        pushHistory();
        closeContextMenu();
    }

    function handleGC() {
        if (blockedByTraversal()) return;
        pushHistory();
        garbageCollectBST();
        pushHistory();
        closeContextMenu();
    }
</script>

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
            onnodecontextmenu={onNodeContextMenu}
            onpanecontextmenu={onPaneContextMenu}
            onpaneclick={closeContextMenu}
            onmoveend={onMoveEnd}
        >
            <Background />
            <Controls />
        </SvelteFlow>
    {/key}

    <svg class="bst-decor">
        <defs>
            <marker id="arrow-bst-flow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="var(--border-bright)" />
            </marker>
        </defs>
        <g
            style="transform: translate({viewport.x}px, {viewport.y}px) scale({viewport.zoom}); transform-origin: 0 0;"
        >
            {#each $bstNodes as node (node.id)}
                {#if node.left}
                    {@const child = $bstNodes.find((n) => n.id === node.left)}
                    {#if child && isReachable(child.id)}
                        <line
                            x1={node.x}
                            y1={node.y + NODE_R}
                            x2={child.x}
                            y2={child.y - NODE_R - 6}
                            stroke="var(--border-bright)"
                            stroke-width="1.5"
                            marker-end="url(#arrow-bst-flow)"
                            style="transition: all 0.3s ease;"
                        />
                    {/if}
                {/if}
                {#if node.right}
                    {@const child = $bstNodes.find((n) => n.id === node.right)}
                    {#if child && isReachable(child.id)}
                        <line
                            x1={node.x}
                            y1={node.y + NODE_R}
                            x2={child.x}
                            y2={child.y - NODE_R - 6}
                            stroke="var(--border-bright)"
                            stroke-width="1.5"
                            marker-end="url(#arrow-bst-flow)"
                            style="transition: all 0.3s ease;"
                        />
                    {/if}
                {/if}
            {/each}
        </g>
    </svg>

    {#if $bstIsEmpty}
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
                {#if !$bstIsEmpty}
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
    .bst-decor {
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
