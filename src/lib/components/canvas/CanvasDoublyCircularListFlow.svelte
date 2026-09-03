<script>
    import { onMount } from "svelte";
    import { SvelteFlow, Background, Controls } from "@xyflow/svelte";
    import "@xyflow/svelte/dist/style.css";
    import DoublyCircularListFlowNode from "../node/DoublyCircularListFlowNode.svelte";
    import {
        dclNodes,
        dclIsEmpty,
        dclRing,
        unreachableDCLNodes,
        dclHeadNode,
        dclTailNode,
        garbageCollectDCL,
    } from "../../stores/list/graphDoublyCircularList.js";
    import { pushHistory } from "../../stores/shared/history.js";
    import { ZOOM_MIN, ZOOM_MAX } from "../../utils/canvasConstants.js";
    import { createFlowViewportSync } from "../../utils/flowViewportSync.svelte.js";

    const NODE_W = 130;
    const NODE_H = 64;
    const NODE_GAP = 60;

    const NEXT_COLOR = "var(--accent)";
    const PREV_COLOR = "#c792ea";

    let { zoom = $bindable(1) } = $props();

    const nodeTypes = { doublycircularlist: DoublyCircularListFlowNode };

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
    let prevRingLength = $dclRing.length;

    let visitingId = $state(null);
    let traverseTimer = null;

    $effect(() => {
        const ring = $dclRing;
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
        const nodes = $dclNodes;
        if (nodes.length > 0 && !initialized && wrapperEl) {
            centerList();
            initialized = true;
        } else if (nodes.length === 0) {
            initialized = false;
        }
    });

    // Node positions are index-in-array-derived — GC re-indexes the array,
    // so we suppress the position transition during GC to avoid a jarring
    // reflow (same treatment as CanvasCircularListFlow).
    let prevNodeCount = 0;
    let isGCing = $state(false);
    $effect.pre(() => {
        const currentCount = $dclNodes.length;
        isGCing = currentCount < prevNodeCount && currentCount > 0;
        prevNodeCount = currentCount;
    });

    function getNodeIndex(id) {
        return $dclNodes.findIndex((n) => n.id === id);
    }

    function getNodeX(id) {
        const idx = getNodeIndex(id);
        return idx !== -1 ? idx * (NODE_W + NODE_GAP) : 0;
    }

    let nodeTransition = $derived(
        `transition: ${isGCing ? "none" : "transform 0.4s ease-in-out"};`,
    );

    let flowNodes = $derived(
        $dclNodes.map((node, idx) => ({
            id: node.id,
            type: "doublycircularlist",
            position: { x: idx * (NODE_W + NODE_GAP), y: 0 },
            draggable: false,
            selectable: false,
            connectable: false,
            style: nodeTransition,
            data: {
                varName: node.varName,
                value: node.data,
                isHead: node.id === $dclHeadNode?.id,
                isTail: node.id === $dclTailNode?.id,
                isUnreachable: $unreachableDCLNodes.some((n) => n.id === node.id),
                isVisiting: visitingId === node.id,
                isAnimIn: animatingInId === node.id,
            },
        })),
    );

    // Ring-closing `next` edge from tail back to head: a single node loops
    // back on itself below the node; two or more nodes get a wide arc
    // dipping below the whole row so it never crosses the forward chain.
    function nextRingPath(headX, tailX) {
        if (headX === tailX) {
            const left = headX + 20;
            const right = headX + NODE_W - 20;
            const botY = NODE_H + 6;
            const loopY = NODE_H + 40;
            return `M ${left} ${botY} C ${left - 30} ${loopY}, ${right + 30} ${loopY}, ${right} ${botY}`;
        }
        const startX = tailX + NODE_W - 16;
        const endX = headX + 16;
        const y = NODE_H + 6;
        const dipY = NODE_H + 60;
        return `M ${startX} ${y} C ${startX} ${dipY}, ${endX} ${dipY}, ${endX} ${y}`;
    }

    // Ring-closing `prev` edge from head back to tail — a deeper arc, also
    // below the row (staying clear of the HEAD/TAIL badges above), nested
    // outside the `next` ring closer and pointing the opposite way.
    function prevRingPath(headX, tailX) {
        if (headX === tailX) {
            const left = headX + 14;
            const right = headX + NODE_W - 14;
            const botY = NODE_H + 6;
            const loopY = NODE_H + 84;
            return `M ${right} ${botY} C ${right + 40} ${loopY}, ${left - 40} ${loopY}, ${left} ${botY}`;
        }
        const startX = headX + 16;
        const endX = tailX + NODE_W - 16;
        const y = NODE_H + 6;
        const dipY = NODE_H + 108;
        return `M ${startX} ${y} C ${startX} ${dipY}, ${endX} ${dipY}, ${endX} ${y}`;
    }

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
        window.dispatchEvent(new CustomEvent("dcl:insert-head"));
    }

    function handleInsertTailFromMenu() {
        closeContextMenu();
        window.dispatchEvent(new CustomEvent("dcl:insert-tail"));
    }

    function handleDeleteHeadFromMenu() {
        closeContextMenu();
        window.dispatchEvent(new CustomEvent("dcl:delete-head"));
    }

    function handleDeleteTailFromMenu() {
        closeContextMenu();
        window.dispatchEvent(new CustomEvent("dcl:delete-tail"));
    }

    function handleGCFromMenu() {
        closeContextMenu();
        pushHistory();
        garbageCollectDCL();
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
        window.addEventListener("dcl:traverse-play", onTraverse);
        return () => {
            window.removeEventListener("dcl:traverse-play", onTraverse);
            if (traverseTimer) clearInterval(traverseTimer);
        };
    });
</script>

<div class="canvas-wrapper" bind:this={wrapperEl}>
    {#if $dclIsEmpty && $dclNodes.length === 0}
        <div class="empty-hint">
            <div class="empty-title">Doubly circular list is empty</div>
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

    <svg class="dcl-decor">
        <defs>
            <marker id="arrow-dcl-next" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="#5b8fff" />
            </marker>
            <marker id="arrow-dcl-next-ring" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="var(--warning)" />
            </marker>
            <marker id="arrow-dcl-prev" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="#c792ea" />
            </marker>
        </defs>
        <g
            style="transform: translate({flow.viewport.x}px, {flow.viewport.y}px) scale({flow.viewport.zoom}); transform-origin: 0 0;"
        >
            {#each $dclNodes as node, idx (node.id)}
                {@const x = idx * (NODE_W + NODE_GAP)}
                {@const isUnreachable = $unreachableDCLNodes.some((n) => n.id === node.id)}

                {#if node.nextId && node.nextId !== $dclHeadNode?.id && !isUnreachable}
                    {@const nextX = getNodeX(node.nextId)}
                    <line
                        x1={x + NODE_W}
                        y1={NODE_H / 2 - 8}
                        x2={nextX - 4}
                        y2={NODE_H / 2 - 8}
                        stroke={NEXT_COLOR}
                        stroke-width="1.8"
                        marker-end="url(#arrow-dcl-next)"
                        style={nodeTransition}
                    />
                {/if}

                {#if node.prevId && node.prevId !== $dclTailNode?.id && !isUnreachable}
                    {@const prevX = getNodeX(node.prevId)}
                    <line
                        x1={x}
                        y1={NODE_H / 2 + 8}
                        x2={prevX + NODE_W + 4}
                        y2={NODE_H / 2 + 8}
                        stroke={PREV_COLOR}
                        stroke-width="1.6"
                        marker-end="url(#arrow-dcl-prev)"
                        style={nodeTransition}
                    />
                {/if}
            {/each}

            {#if $dclHeadNode && $dclTailNode}
                {@const hx = getNodeX($dclHeadNode.id)}
                {@const tx = getNodeX($dclTailNode.id)}
                <path
                    d={nextRingPath(hx, tx)}
                    fill="none"
                    stroke="var(--warning)"
                    stroke-width="1.6"
                    stroke-dasharray="3 3"
                    marker-end="url(#arrow-dcl-next-ring)"
                    style={nodeTransition}
                />
                <path
                    d={prevRingPath(hx, tx)}
                    fill="none"
                    stroke={PREV_COLOR}
                    stroke-width="1.5"
                    stroke-dasharray="3 3"
                    marker-end="url(#arrow-dcl-prev)"
                    style={nodeTransition}
                />
            {/if}

            {#if $dclHeadNode}
                {@const hx = getNodeX($dclHeadNode.id)}
                <g class="pointer-group" style="transform: translateX({hx}px); {nodeTransition}">
                    <rect x={NODE_W / 2 - 22} y="-28" width="44" height="20" rx="5" fill="rgba(78,204,163,0.15)" stroke="var(--success)" stroke-width="1.2" />
                    <text x={NODE_W / 2} y="-13" text-anchor="middle" font-family="var(--font-mono)" font-size="9" font-weight="700" fill="var(--success)" letter-spacing="0.8">HEAD</text>
                    <line x1={NODE_W / 2} y1="-8" x2={NODE_W / 2} y2="-2" stroke="var(--success)" stroke-width="1.5" />
                    <polygon points="{NODE_W / 2 - 4},-4 {NODE_W / 2 + 4},-4 {NODE_W / 2},0" fill="var(--success)" />
                </g>
            {/if}

            {#if $dclTailNode}
                {@const tx = getNodeX($dclTailNode.id)}
                {@const isStacked = $dclHeadNode?.id === $dclTailNode?.id}
                <g class="pointer-group" style="transform: translateX({tx}px) translateY({isStacked ? -26 : 0}px); {nodeTransition}">
                    <rect x={NODE_W / 2 - 18} y="-28" width="36" height="20" rx="5" fill="rgba(192,132,252,0.15)" stroke="#c084fc" stroke-width="1.2" />
                    <text x={NODE_W / 2} y="-13" text-anchor="middle" font-family="var(--font-mono)" font-size="9" font-weight="700" fill="#c084fc" letter-spacing="0.8">TAIL</text>
                    <line x1={NODE_W / 2} y1="-8" x2={NODE_W / 2} y2="-2" stroke="#c084fc" stroke-width="1.5" />
                    <polygon points="{NODE_W / 2 - 4},-4 {NODE_W / 2 + 4},-4 {NODE_W / 2},0" fill="#c084fc" />
                </g>
            {/if}
        </g>
    </svg>

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
                {@const isUnreachable = $unreachableDCLNodes.some((n) => n.id === contextMenu.nodeId)}
                {@const isHeadNode = contextMenu.nodeId === $dclHeadNode?.id}
                {@const isTailNode = contextMenu.nodeId === $dclTailNode?.id}
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
    .dcl-decor {
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
