<script>
    import { onMount } from "svelte";
    import { SvelteFlow, Background, Controls, MarkerType } from "@xyflow/svelte";
    import "@xyflow/svelte/dist/style.css";
    import CircularListFlowNode from "../node/CircularListFlowNode.svelte";
    import {
        circularListNodes,
        circularListIsEmpty,
        listRing,
        unreachableListNodes,
        headNode,
        tailNode,
        garbageCollectCircularList,
    } from "../../stores/list/graphCircularList.js";
    import { pushHistory } from "../../stores/shared/history.js";
    import { ZOOM_MIN, ZOOM_MAX, LIST_EDGE } from "../../utils/canvasConstants.js";
    import { createFlowViewportSync } from "../../utils/flowViewportSync.svelte.js";

    const NODE_W = 130;
    const NODE_H = 64;
    const NODE_GAP = 60;

    let { zoom = $bindable(1) } = $props();

    const nodeTypes = { circularlist: CircularListFlowNode };

    /** @type {HTMLDivElement} */
    let wrapperEl = $state();

    let initialized = $state(false);
    // See CanvasSLLFlow.svelte: remount Svelte Flow whenever we recenter or
    // push an externally-driven zoom so its internal pan/zoom transform
    // reseeds from the corrected viewport.
    const flow = createFlowViewportSync({
        getZoom: () => zoom,
        setZoom: (z) => (zoom = z),
    });

    /** @type {{ x: number, y: number, type: 'canvas'|'node', nodeId?: string }|null} */
    let contextMenu = $state(null);

    let animatingInId = $state(null);
    let prevRingLength = $listRing.length;

    let visitingId = $state(null);
    let traverseTimer = null;

    $effect(() => {
        const ring = $listRing;
        if (ring.length > prevRingLength && ring.length > 0) {
            animatingInId = ring[ring.length - 1].id;
            setTimeout(() => {
                animatingInId = null;
            }, 400);
        }
        prevRingLength = ring.length;
    });

    function centerList() {
        if (!wrapperEl) return;
        const rect = wrapperEl.getBoundingClientRect();
        flow.viewport = { ...flow.viewport, x: 60, y: rect.height / 2 - NODE_H / 2 - 30 };
        flow.remount();
    }

    $effect(() => {
        const nodes = $circularListNodes;
        if (nodes.length > 0 && !initialized && wrapperEl) {
            centerList();
            initialized = true;
        } else if (nodes.length === 0) {
            initialized = false;
        }
    });

    // Node positions are index-in-array-derived — GC re-indexes the array,
    // so we suppress the position transition during GC to avoid a jarring
    // reflow (same treatment as CanvasLinkedQueueFlow).
    let prevNodeCount = 0;
    let isGCing = $state(false);
    $effect.pre(() => {
        const currentCount = $circularListNodes.length;
        isGCing = currentCount < prevNodeCount && currentCount > 0;
        prevNodeCount = currentCount;
    });

    let nodeTransition = $derived(
        `transition: ${isGCing ? "none" : "transform 0.4s ease-in-out"};`,
    );

    let flowNodes = $derived(
        $circularListNodes.map((node, idx) => ({
            id: node.id,
            type: "circularlist",
            position: { x: idx * (NODE_W + NODE_GAP), y: 0 },
            draggable: false,
            selectable: false,
            connectable: false,
            style: nodeTransition,
            data: {
                varName: node.varName,
                value: node.data,
                isHead: node.id === $headNode?.id,
                isTail: node.id === $tailNode?.id,
                isUnreachable: $unreachableListNodes.some((n) => n.id === node.id),
                isVisiting: visitingId === node.id,
                isAnimIn: animatingInId === node.id,
            },
        })),
    );

    // One Svelte Flow bezier edge per ring hop. The last hop (tail → head)
    // uses the pair of bottom handles so the closing link arcs cleanly
    // below the row instead of cutting back through every node.
    let flowEdges = $derived.by(() => {
        const ring = $listRing;
        if (ring.length === 0) return [];
        return ring.map((from, i) => {
            const to = ring[(i + 1) % ring.length];
            const isCloser = i === ring.length - 1;
            return {
                id: `next-${from.id}-${to.id}`,
                source: from.id,
                target: to.id,
                sourceHandle: isCloser ? "ring-out" : "out",
                targetHandle: isCloser ? "ring-in" : "in",
                markerEnd: { type: MarkerType.ArrowClosed, color: LIST_EDGE.NEXT_COLOR },
                style: `stroke: ${LIST_EDGE.NEXT_COLOR};`,
            };
        });
    });

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

    function handleInsertHeadFromMenu() {
        closeContextMenu();
        window.dispatchEvent(new CustomEvent("circularlist:insert-head"));
    }

    function handleInsertTailFromMenu() {
        closeContextMenu();
        window.dispatchEvent(new CustomEvent("circularlist:insert-tail"));
    }

    function handleDeleteHeadFromMenu() {
        closeContextMenu();
        window.dispatchEvent(new CustomEvent("circularlist:delete-head"));
    }

    function handleDeleteTailFromMenu() {
        closeContextMenu();
        window.dispatchEvent(new CustomEvent("circularlist:delete-tail"));
    }

    function handleGCFromMenu() {
        closeContextMenu();
        pushHistory();
        garbageCollectCircularList();
        pushHistory();
    }

    onMount(() => {
        const onTraverse = (e) => {
            const order = e.detail ?? [];
            if (traverseTimer) clearInterval(traverseTimer);
            let i = 0;
            visitingId = order[0] ?? null;
            traverseTimer = setInterval(() => {
                i++;
                if (i >= order.length) {
                    clearInterval(traverseTimer);
                    traverseTimer = null;
                    setTimeout(() => (visitingId = null), 300);
                    return;
                }
                visitingId = order[i];
            }, 550);
        };
        window.addEventListener("circularlist:traverse-play", onTraverse);
        return () => {
            window.removeEventListener("circularlist:traverse-play", onTraverse);
            if (traverseTimer) clearInterval(traverseTimer);
        };
    });
</script>

<div class="canvas-wrapper" bind:this={wrapperEl}>
    {#if $circularListIsEmpty && $circularListNodes.length === 0}
        <div class="empty-hint">
            <div class="empty-title">Circular list is empty</div>
            <div class="empty-hints-list">
                <div class="empty-hint-item">
                    <kbd>Insert Head/Tail</kbd> <span>to add a node</span>
                </div>
                <div class="empty-hint-item">
                    <kbd>Right click</kbd> <span>for options</span>
                </div>
            </div>
        </div>
    {/if}

    {#key flow.flowGen}
        <SvelteFlow
            nodes={flowNodes}
            edges={flowEdges}
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

    {#if contextMenu}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
            class="ctx-menu"
            style="left: {contextMenu.x}px; top: {contextMenu.y}px;"
            onmousedown={(e) => e.stopPropagation()}
        >
            {#if contextMenu.type === "canvas"}
                <button class="ctx-item" onclick={handleInsertHeadFromMenu}>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M9 6.5H4M6.5 4l-2.5 2.5 2.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" /></svg>
                    Insert Head
                </button>
                <button class="ctx-item" onclick={handleInsertTailFromMenu}>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M4 6.5h5M6.5 4l2.5 2.5-2.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" /></svg>
                    Insert Tail
                </button>
                <div class="ctx-divider"></div>
                <button class="ctx-item" onclick={handleGCFromMenu}>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 2C4.3 2 2.5 3.8 2.5 6s1.8 4 4 4 4-1.8 4-4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /><path d="M8.5 2h2.5v2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" /><path d="M8.5 4.5l2.5-2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /></svg>
                    Run GC
                </button>
            {:else}
                {@const isUnreachable = $unreachableListNodes.some((n) => n.id === contextMenu.nodeId)}
                {@const isHeadNode = contextMenu.nodeId === $headNode?.id}
                {@const isTailNode = contextMenu.nodeId === $tailNode?.id}
                {#if !isUnreachable}
                    <button class="ctx-item" onclick={handleDeleteHeadFromMenu} disabled={!isHeadNode}>
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M4 6.5h5M6.5 4l-2.5 2.5 2.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" /></svg>
                        Delete Head {!isHeadNode ? "(head only)" : ""}
                    </button>
                    <button class="ctx-item" onclick={handleDeleteTailFromMenu} disabled={!isTailNode}>
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M4 6.5h5M6.5 4l2.5 2.5-2.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" /></svg>
                        Delete Tail {!isTailNode ? "(tail only)" : ""}
                    </button>
                {:else}
                    <button class="ctx-item" onclick={handleGCFromMenu}>
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 2C4.3 2 2.5 3.8 2.5 6s1.8 4 4 4 4-1.8 4-4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /><path d="M8.5 2h2.5v2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" /><path d="M8.5 4.5l2.5-2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /></svg>
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
        gap: 12px;
        animation: fadeIn 0.4s ease;
        z-index: 5;
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
</style>
