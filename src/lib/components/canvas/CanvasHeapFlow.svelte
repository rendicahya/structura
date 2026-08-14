<script>
    import { untrack } from "svelte";
    import { get } from "svelte/store";
    import { SvelteFlow, Background, Controls } from "@xyflow/svelte";
    import "@xyflow/svelte/dist/style.css";
    import HeapFlowNode from "../node/HeapFlowNode.svelte";
    import {
        heapItems,
        heapCapacity,
        heapMode,
        heapVarName,
        heapIsEmpty,
        heapIsFull,
        heapNodePosition,
    } from "../../stores/heap/graphHeap.js";
    import { logOpHeap } from "../../stores/shared/heapLog.js";
    import { ZOOM_MIN, ZOOM_MAX } from "../../utils/canvasConstants.js";
    import { createFlowViewportSync } from "../../utils/flowViewportSync.svelte.js";

    const NODE_R = 34;

    let { zoom = $bindable(1) } = $props();

    const nodeTypes = { heap: HeapFlowNode };

    /** @type {HTMLDivElement} */
    let wrapperEl = $state();

    let initialized = false;
    // Same remount trick as CanvasBSTFlow.svelte — Svelte Flow's own
    // pan/zoom transform only reseeds from `viewport` at mount, so
    // recentering (or an externally-driven zoom) after mount requires
    // remounting to take effect.
    const flow = createFlowViewportSync({
        getZoom: () => zoom,
        setZoom: (z) => (zoom = z),
    });

    /** @type {{ x: number, y: number }|null} */
    let contextMenu = $state(null);

    /** @type {string|null} */
    let peekingId = $state(null);

    function centerHeap() {
        if (!wrapperEl || $heapItems.length === 0) return false;
        const rect = wrapperEl.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;

        const total = $heapItems.length;
        const positions = $heapItems.map((_, i) => heapNodePosition(i, total));
        const padding = 80;
        const minX = Math.min(...positions.map((p) => p.x - NODE_R));
        const maxX = Math.max(...positions.map((p) => p.x + NODE_R));
        const minY = Math.min(...positions.map((p) => p.y - NODE_R));
        const maxY = Math.max(...positions.map((p) => p.y + NODE_R));
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
        const items = $heapItems;
        if (items.length > 0 && !initialized && wrapperEl) {
            untrack(() => {
                const attemptCenter = () => {
                    if (centerHeap()) {
                        initialized = true;
                    } else if (!initialized) {
                        requestAnimationFrame(attemptCenter);
                    }
                };
                attemptCenter();
            });
        } else if (items.length === 0) {
            initialized = false;
        }
    });

    let flowNodes = $derived(
        $heapItems.map((item, index) => {
            const pos = heapNodePosition(index, $heapItems.length);
            return {
                id: item.id,
                type: "heap",
                position: { x: pos.x - NODE_R, y: pos.y - NODE_R },
                draggable: false,
                selectable: false,
                connectable: false,
                style: "transition: transform 0.3s ease;",
                data: {
                    index,
                    value: item.value,
                    isRoot: index === 0,
                    isPeeking: item.id === peekingId,
                },
            };
        }),
    );

    function openContextMenu({ event }) {
        event.preventDefault();
        if ($heapCapacity === 0) return;
        contextMenu = { x: event.clientX, y: event.clientY };
    }

    function closeContextMenu() {
        contextMenu = null;
    }

    function handleInsertFromMenu() {
        closeContextMenu();
        window.dispatchEvent(new CustomEvent("heap:insert"));
    }

    function handleExtractFromMenu() {
        closeContextMenu();
        window.dispatchEvent(new CustomEvent("heap:extract"));
    }

    // Read-only, non-mutating — implemented entirely here rather than in
    // graphHeap.js or bridged to the toolbar, mirroring how
    // CanvasStackFlow.svelte's Peek context-menu item is self-contained
    // (no pushHistory, no toolbar button — see ToolbarStack.svelte, which
    // has no Peek button either).
    function handlePeekFromMenu() {
        closeContextMenu();
        const items = get(heapItems);
        if (items.length === 0) return;

        const root = items[0];
        const varName = get(heapVarName);
        const mode = get(heapMode);

        peekingId = root.id;
        setTimeout(() => {
            peekingId = null;
        }, 1500);

        logOpHeap(
            `int peeked = ${varName}[0]; // peek ${mode === "min" ? "min" : "max"} = ${root.value}`,
            `peeked = ${varName}[0]  # peek ${mode === "min" ? "min" : "max"} = ${root.value}`,
            `int peeked = ${varName}[0]; // peek ${mode === "min" ? "min" : "max"} = ${root.value}`
        );
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
            onnodecontextmenu={openContextMenu}
            onpanecontextmenu={openContextMenu}
            onpaneclick={closeContextMenu}
            onmoveend={flow.onMoveEnd}
        >
            <Background />
            <Controls />
        </SvelteFlow>
    {/key}

    <svg class="heap-decor">
        <defs>
            <marker id="arrow-heap-flow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="var(--border-bright)" />
            </marker>
        </defs>
        <g
            style="transform: translate({flow.viewport.x}px, {flow.viewport.y}px) scale({flow.viewport.zoom}); transform-origin: 0 0;"
        >
            {#each $heapItems as item, index (item.id)}
                {@const pos = heapNodePosition(index, $heapItems.length)}
                {#each [2 * index + 1, 2 * index + 2] as childIndex}
                    {#if childIndex < $heapItems.length}
                        {@const childPos = heapNodePosition(childIndex, $heapItems.length)}
                        <line
                            x1={pos.x}
                            y1={pos.y + NODE_R}
                            x2={childPos.x}
                            y2={childPos.y - NODE_R - 6}
                            stroke="var(--border-bright)"
                            stroke-width="1.5"
                            marker-end="url(#arrow-heap-flow)"
                            style="transition: all 0.3s ease;"
                        />
                    {/if}
                {/each}
            {/each}
        </g>
    </svg>

    {#if $heapCapacity > 0}
        <div class="size-badge" class:full={$heapIsFull}>
            {$heapItems.length} / {$heapCapacity}
            {#if $heapIsFull}<span class="full-label">HEAP FULL</span>{/if}
        </div>
    {/if}

    {#if $heapCapacity === 0}
        <div class="empty-hint">
            <div class="empty-title">Heap not initialized</div>
            <div class="empty-hints-list">
                <div class="empty-hint-item">
                    <span>Click <strong>New</strong> to create a heap</span>
                </div>
            </div>
        </div>
    {:else if $heapIsEmpty}
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
            <button class="ctx-item" onclick={handleInsertFromMenu} disabled={$heapIsFull}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.3" /><path d="M6.5 4v5M4 6.5h5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /></svg>
                Insert value
            </button>
            {#if !$heapIsEmpty}
                <button class="ctx-item" onclick={handleExtractFromMenu}>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 2v7M4 6.5l2.5 2.5 2.5-2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" /></svg>
                    Extract {$heapMode === "min" ? "Min" : "Max"}
                </button>
                <button class="ctx-item" onclick={handlePeekFromMenu}>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="4" stroke="currentColor" stroke-width="1.3" /><circle cx="6.5" cy="6.5" r="1.5" fill="currentColor" /></svg>
                    Peek {$heapMode === "min" ? "Min" : "Max"}
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
    .heap-decor {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 5;
    }
    .size-badge {
        position: absolute;
        top: 16px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10;
        display: flex;
        align-items: center;
        gap: 8px;
        font-family: var(--font-mono);
        font-size: 12px;
        font-weight: 600;
        color: var(--text-dim);
        background: var(--surface);
        border: 1px solid var(--border-bright);
        border-radius: 8px;
        padding: 5px 12px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }
    .size-badge.full {
        border-color: var(--danger);
        color: var(--danger);
    }
    .full-label {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.5px;
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
    .ctx-item:hover:not(:disabled) {
        background: var(--surface2);
        color: var(--text);
    }
    .ctx-item:disabled {
        opacity: 0.35;
        cursor: not-allowed;
    }
</style>
