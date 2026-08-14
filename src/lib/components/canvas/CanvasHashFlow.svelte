<script>
    import { untrack } from "svelte";
    import { SvelteFlow, Background, Controls } from "@xyflow/svelte";
    import "@xyflow/svelte/dist/style.css";
    import HashBucketNode from "../node/HashBucketNode.svelte";
    import HashEntryNode from "../node/HashEntryNode.svelte";
    import {
        hashCapacity,
        hashEntries,
        hashIsEmpty,
        hashSearchState,
        deleteHashEntry,
    } from "../../stores/hash/graphHash.js";
    import { pushHistory } from "../../stores/shared/history.js";
    import { ZOOM_MIN, ZOOM_MAX } from "../../utils/canvasConstants.js";

    const BUCKET_X = 60;
    const BUCKET_W = 56;
    const BUCKET_H = 44;
    const ROW_H = 74;
    const ENTRY_START_X = BUCKET_X + BUCKET_W + 60;
    const ENTRY_STEP = 180;

    let { zoom = $bindable(1) } = $props();

    const nodeTypes = { bucket: HashBucketNode, entry: HashEntryNode };

    /** @type {HTMLDivElement} */
    let wrapperEl = $state();

    let viewport = $state({ x: 0, y: 0, zoom: 1 });
    let initialized = false;
    let flowGen = $state(0);
    let userInteracted = false;

    /** @type {{ x: number, y: number, type: 'canvas'|'entry', entryId?: string }|null} */
    let contextMenu = $state(null);

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

    function centerTable() {
        if (!wrapperEl || $hashCapacity === 0) return false;
        const rect = wrapperEl.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;

        const maxChain = Math.max(0, ...bucketChainLengths());
        const padding = 60;
        const contentW = ENTRY_START_X + Math.max(1, maxChain) * ENTRY_STEP;
        const contentH = $hashCapacity * ROW_H;
        const scaleX = (rect.width - padding * 2) / contentW;
        const scaleY = (rect.height - padding * 2) / contentH;
        const newZoom = Math.min(Math.min(scaleX, scaleY), 1);

        zoom = newZoom;
        viewport = {
            x: (rect.width - contentW * newZoom) / 2,
            y: (rect.height - contentH * newZoom) / 2,
            zoom: newZoom,
        };
        flowGen++;
        return true;
    }

    function bucketChainLengths() {
        const counts = new Array($hashCapacity).fill(0);
        for (const e of $hashEntries) counts[e.bucketIndex]++;
        return counts;
    }

    $effect(() => {
        const cap = $hashCapacity;
        if (cap > 0 && !initialized && wrapperEl) {
            untrack(() => {
                const attemptCenter = () => {
                    if (centerTable()) {
                        initialized = true;
                    } else if (!initialized) {
                        requestAnimationFrame(attemptCenter);
                    }
                };
                attemptCenter();
            });
        } else if (cap === 0) {
            initialized = false;
        }
    });

    let chainPositions = $derived(() => {
        /** @type {Map<string, number>} */
        const positions = new Map();
        for (let i = 0; i < $hashCapacity; i++) {
            const chain = $hashEntries.filter((e) => e.bucketIndex === i);
            chain.forEach((e, idx) => positions.set(e.id, idx));
        }
        return positions;
    });

    let flowNodes = $derived(
        (() => {
            const counts = bucketChainLengths();
            const positions = chainPositions();
            /** @type {any[]} */
            const nodes = [];

            for (let i = 0; i < $hashCapacity; i++) {
                nodes.push({
                    id: `bucket-${i}`,
                    type: "bucket",
                    position: { x: BUCKET_X, y: i * ROW_H },
                    draggable: false,
                    selectable: false,
                    connectable: false,
                    data: { index: i, chainLength: counts[i] },
                });
            }

            for (const entry of $hashEntries) {
                const chainPos = positions.get(entry.id) ?? 0;
                const search = $hashSearchState;
                const isFound = !!search && search.foundId === entry.id;
                const isNotFound =
                    !!search && !search.foundId && search.bucketIndex === entry.bucketIndex;
                nodes.push({
                    id: entry.id,
                    type: "entry",
                    position: {
                        x: ENTRY_START_X + chainPos * ENTRY_STEP,
                        y: entry.bucketIndex * ROW_H - 8,
                    },
                    draggable: false,
                    selectable: false,
                    connectable: false,
                    style: "transition: transform 0.3s ease;",
                    data: { varName: entry.varName, value: entry.value, isFound, isNotFound },
                });
            }

            return nodes;
        })(),
    );

    function nodeCenter(node) {
        if (node.type === "bucket") {
            return { x: BUCKET_X + BUCKET_W, y: node.position.y + BUCKET_H / 2 };
        }
        return { x: node.position.x, y: node.position.y + 26 };
    }

    let edgeLines = $derived(
        (() => {
            const nodesById = new Map(flowNodes.map((n) => [n.id, n]));
            /** @type {{ x1: number, y1: number, x2: number, y2: number }[]} */
            const lines = [];

            for (let i = 0; i < $hashCapacity; i++) {
                const chain = $hashEntries.filter((e) => e.bucketIndex === i);
                if (chain.length === 0) continue;
                const bucketNode = nodesById.get(`bucket-${i}`);
                const firstNode = nodesById.get(chain[0].id);
                if (bucketNode && firstNode) {
                    const from = nodeCenter(bucketNode);
                    lines.push({ x1: from.x, y1: from.y, x2: firstNode.position.x, y2: firstNode.position.y + 26 });
                }
                for (let c = 0; c < chain.length - 1; c++) {
                    const fromNode = nodesById.get(chain[c].id);
                    const toNode = nodesById.get(chain[c + 1].id);
                    if (fromNode && toNode) {
                        lines.push({
                            x1: fromNode.position.x + 110,
                            y1: fromNode.position.y + 26,
                            x2: toNode.position.x,
                            y2: toNode.position.y + 26,
                        });
                    }
                }
            }
            return lines;
        }),
    );

    function onPaneContextMenu({ event }) {
        event.preventDefault();
        contextMenu = { x: event.clientX, y: event.clientY, type: "canvas" };
    }

    function onNodeContextMenu({ node, event }) {
        event.preventDefault();
        if (node.type !== "entry") return;
        contextMenu = { x: event.clientX, y: event.clientY, type: "entry", entryId: node.id };
    }

    function closeContextMenu() {
        contextMenu = null;
    }

    function handleInsertFromMenu() {
        closeContextMenu();
        window.dispatchEvent(new CustomEvent("hash:insert"));
    }

    function handleDelete() {
        closeContextMenu();
        pushHistory();
        deleteHashEntry(contextMenu?.entryId ?? "");
        pushHistory();
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

    <svg class="hash-decor">
        <defs>
            <marker id="arrow-hash-flow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="var(--border-bright)" />
            </marker>
        </defs>
        <g
            style="transform: translate({viewport.x}px, {viewport.y}px) scale({viewport.zoom}); transform-origin: 0 0;"
        >
            {#each edgeLines() as line}
                <line
                    x1={line.x1}
                    y1={line.y1}
                    x2={line.x2}
                    y2={line.y2}
                    stroke="var(--border-bright)"
                    stroke-width="1.5"
                    marker-end="url(#arrow-hash-flow)"
                    style="transition: all 0.3s ease;"
                />
            {/each}
        </g>
    </svg>

    {#if $hashCapacity > 0}
        <div class="size-badge">
            {$hashEntries.length} entries / {$hashCapacity} buckets, load factor {($hashEntries.length / $hashCapacity).toFixed(2)}
        </div>
    {/if}

    {#if $hashCapacity === 0}
        <div class="empty-hint">
            <div class="empty-title">Hash table not initialized</div>
            <div class="empty-hints-list">
                <div class="empty-hint-item">
                    <span>Click <strong>New</strong> to create a hash table</span>
                </div>
            </div>
        </div>
    {:else if $hashIsEmpty}
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
            {:else}
                <button class="ctx-item danger" onclick={handleDelete}>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 6.5h2.5M8.5 6.5H11" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /></svg>
                    Delete entry
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
    .hash-decor {
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
</style>
