<script>
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
    import {
        fitToViewTrigger,
        canvasZoom,
    } from "../../stores/shared/canvasControl.js";

    const NODE_R = 28; // radius node lingkaran
    const ZOOM_STEP = 0.1;
    const ZOOM_MIN = 0.3;
    const ZOOM_MAX = 2;

    const props = $props();
    let zoom = $state(props.zoom ?? 1);
    $effect(() => {
        zoom = props.zoom ?? 1;
    });
    $effect(() => {
        canvasZoom.set(zoom);
    });

    /** @type {SVGSVGElement} */
    let svgEl = $state();

    let panX = $state(0);
    let panY = $state(0);
    let panning = $state(false);
    let panStartX = 0;
    let panStartY = 0;
    let initialized = $state(false);

    /** @type {{ x: number, y: number, type: 'canvas'|'node', nodeId?: string }|null} */
    let contextMenu = $state(null);

    /** @type {{ nodeId: string, x: number, y: number, value: string }|null} */
    let inlineEdit = $state(null);
    let inlineInputEl = $state();

    // Center saat pertama ada node
    $effect(() => {
        if ($treeNodes.length > 0 && !initialized && svgEl) {
            centerTree();
            initialized = true;
        }
        if ($treeNodes.length === 0) initialized = false;
    });

    $effect(() => {
        if ($fitToViewTrigger === 0) return;
        centerTree();
    });

    function centerTree() {
        if (!svgEl || $treeNodes.length === 0) return;
        const rect = svgEl.getBoundingClientRect();
        const padding = 80;
        const minX = Math.min(...$treeNodes.map((n) => n.x - NODE_R));
        const maxX = Math.max(...$treeNodes.map((n) => n.x + NODE_R));
        const minY = Math.min(...$treeNodes.map((n) => n.y - NODE_R));
        const maxY = Math.max(...$treeNodes.map((n) => n.y + NODE_R));
        const contentW = maxX - minX;
        const contentH = maxY - minY;
        const scaleX = (rect.width - padding * 2) / contentW;
        const scaleY = (rect.height - padding * 2) / contentH;
        zoom = Math.min(Math.min(scaleX, scaleY), 1);
        panX = (rect.width - contentW * zoom) / 2 - minX * zoom;
        panY = (rect.height - contentH * zoom) / 2 - minY * zoom + padding / 2;
    }

    function onSVGMousedown(e) {
        contextMenu = null;
        if (e.button !== 0) return;
        panning = true;
        panStartX = e.clientX - panX;
        panStartY = e.clientY - panY;
    }

    function onWindowMousemove(e) {
        if (!panning) return;
        panX = e.clientX - panStartX;
        panY = e.clientY - panStartY;
    }

    function onWindowMouseup() {
        panning = false;
    }

    function onSVGContextMenu(e) {
        e.preventDefault();
        contextMenu = { x: e.clientX, y: e.clientY, type: "canvas" };
    }

    function onNodeContextMenu(e, nodeId) {
        e.preventDefault();
        e.stopPropagation();
        contextMenu = { x: e.clientX, y: e.clientY, type: "node", nodeId };
    }

    function closeContextMenu() {
        contextMenu = null;
    }

    function handleAddRoot() {
        pushHistory();
        addTreeNode(null, null);
        pushHistory();
        closeContextMenu();
    }

    function handleAddLeft() {
        pushHistory();
        addTreeNode(contextMenu?.nodeId ?? null, "left");
        pushHistory();
        closeContextMenu();
    }

    function handleAddRight() {
        pushHistory();
        addTreeNode(contextMenu?.nodeId ?? null, "right");
        pushHistory();
        closeContextMenu();
    }

    function handleRemove() {
        pushHistory();
        removeTreeNode(contextMenu?.nodeId ?? "");
        pushHistory();
        closeContextMenu();
    }

    function handleGC() {
        pushHistory();
        garbageCollectTree();
        pushHistory();
        closeContextMenu();
    }

    function onNodeDblClick(nodeId) {
        const node = $treeNodes.find((n) => n.id === nodeId);
        if (!node || !svgEl) return;
        contextMenu = null;
        const rect = svgEl.getBoundingClientRect();
        inlineEdit = {
            nodeId,
            x: rect.left + node.x * zoom + panX,
            y: rect.top + node.y * zoom + panY,
            value: node.data,
        };
        setTimeout(() => {
            inlineInputEl?.focus();
            inlineInputEl?.select();
        }, 10);
    }

    function commitInlineEdit() {
        if (!inlineEdit) return;
        pushHistory();
        updateTreeNode(inlineEdit.nodeId, { data: inlineEdit.value });
        pushHistory();
        inlineEdit = null;
    }

    function cancelInlineEdit() {
        inlineEdit = null;
    }

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

    // Get edges between nodes
    let edges = $derived(
        $treeNodes.flatMap((node) => {
            const result = [];
            if (node.left) {
                const child = $treeNodes.find((n) => n.id === node.left);
                if (child) result.push({ from: node, to: child });
            }
            if (node.right) {
                const child = $treeNodes.find((n) => n.id === node.right);
                if (child) result.push({ from: node, to: child });
            }
            return result;
        }),
    );

    // Reachable nodes from root
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

    function canAddLeft(nodeId) {
        const node = $treeNodes.find((n) => n.id === nodeId);
        return node && !node.left;
    }

    function canAddRight(nodeId) {
        const node = $treeNodes.find((n) => n.id === nodeId);
        return node && !node.right;
    }

    let wheelFrame = null;
    function onWheel(e) {
        e.preventDefault();
        if (wheelFrame) return;
        wheelFrame = requestAnimationFrame(() => {
            wheelFrame = null;
            if (!svgEl) return;
            const rect = svgEl.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
            const newZoom = Math.min(
                ZOOM_MAX,
                Math.max(ZOOM_MIN, +(zoom + delta).toFixed(2)),
            );
            panX = mouseX - (mouseX - panX) * (newZoom / zoom);
            panY = mouseY - (mouseY - panY) * (newZoom / zoom);
            zoom = newZoom;
        });
    }

    import { onMount } from "svelte";
    onMount(() => {
        svgEl.addEventListener("wheel", onWheel, { passive: false });
        return () => svgEl?.removeEventListener("wheel", onWheel);
    });
</script>

<svelte:window onmousemove={onWindowMousemove} onmouseup={onWindowMouseup} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="canvas-wrapper">
    {#if $treeIsEmpty}
        <div class="empty-hint">
            <div class="empty-title">Tree is empty</div>
            <div class="empty-hints-list">
                <div class="empty-hint-item">
                    <kbd>Right click</kbd> <span>canvas to add root node</span>
                </div>
            </div>
        </div>
    {/if}

    <svg
        bind:this={svgEl}
        class="canvas-svg"
        class:panning
        role="application"
        onmousedown={onSVGMousedown}
        oncontextmenu={onSVGContextMenu}
    >
        <defs>
            <marker
                id="arrow-tree"
                markerWidth="8"
                markerHeight="6"
                refX="7"
                refY="3"
                orient="auto"
            >
                <polygon points="0 0, 8 3, 0 6" fill="var(--border-bright)" />
            </marker>
            <pattern
                id="grid-tree"
                width="28"
                height="28"
                patternUnits="userSpaceOnUse"
            >
                <circle cx="14" cy="14" r="0.8" fill="var(--border)" />
            </pattern>
        </defs>

        <rect width="100%" height="100%" fill="url(#grid-tree)" />

        <g
            style="transform: translate({panX}px, {panY}px) scale({zoom}); transform-origin: 0 0;"
        >
            <!-- Edges -->
            {#each edges as edge}
                <line
                    x1={edge.from.x}
                    y1={edge.from.y + NODE_R}
                    x2={edge.to.x}
                    y2={edge.to.y - NODE_R}
                    stroke="var(--border-bright)"
                    stroke-width="1.5"
                />
            {/each}

            <!-- Nodes -->
            {#each $treeNodes as node (node.id)}
                {@const reachable = isReachable(node.id)}
                {@const isRoot = node.id === $rootId}

                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <g
                    class="tree-node"
                    class:unreachable={!reachable}
                    oncontextmenu={(e) => onNodeContextMenu(e, node.id)}
                    ondblclick={() => onNodeDblClick(node.id)}
                >
                    <!-- Shadow -->
                    <circle
                        cx={node.x + 2}
                        cy={node.y + 3}
                        r={NODE_R}
                        fill="rgba(0,0,0,0.3)"
                    />

                    <!-- Main circle -->
                    <circle
                        cx={node.x}
                        cy={node.y}
                        r={NODE_R}
                        fill="var(--node-bg)"
                        stroke={isRoot
                            ? "var(--success)"
                            : reachable
                              ? "var(--node-border)"
                              : "var(--border)"}
                        stroke-width={isRoot ? 2 : 1.5}
                        stroke-dasharray={reachable ? "none" : "4 3"}
                        opacity={reachable ? 1 : 0.5}
                    />

                    <!-- Data -->
                    <text
                        x={node.x}
                        y={node.y + 5}
                        text-anchor="middle"
                        font-family="var(--font-mono)"
                        font-size="13"
                        fill={reachable
                            ? node.data
                                ? "var(--text)"
                                : "var(--text-muted)"
                            : "var(--text-muted)"}
                        font-weight={node.data ? "500" : "400"}
                        >{node.data || "null"}</text
                    >

                    <!-- varName label di bawah node -->
                    <text
                        x={node.x}
                        y={node.y + NODE_R + 14}
                        text-anchor="middle"
                        font-family="var(--font-mono)"
                        font-size="9"
                        fill={reachable ? "var(--accent)" : "var(--text-muted)"}
                        >{node.varName}</text
                    >

                    <!-- Unreachable label -->
                    {#if !reachable}
                        <text
                            x={node.x}
                            y={node.y + NODE_R + 26}
                            text-anchor="middle"
                            font-family="var(--font-mono)"
                            font-size="8"
                            fill="var(--text-muted)"
                            font-style="italic">unreachable</text
                        >
                    {/if}
                </g>
            {/each}
        </g>
    </svg>

    <!-- Inline edit -->
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

    <!-- Context menu -->
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
                        <svg
                            width="13"
                            height="13"
                            viewBox="0 0 13 13"
                            fill="none"
                        >
                            <circle
                                cx="6.5"
                                cy="6.5"
                                r="5"
                                stroke="currentColor"
                                stroke-width="1.3"
                            />
                            <path
                                d="M6.5 4v5M4 6.5h5"
                                stroke="currentColor"
                                stroke-width="1.3"
                                stroke-linecap="round"
                            />
                        </svg>
                        Add root node
                    </button>
                {:else}
                    <button class="ctx-item" onclick={handleGC}>
                        <svg
                            width="13"
                            height="13"
                            viewBox="0 0 13 13"
                            fill="none"
                        >
                            <path
                                d="M6.5 2C4.3 2 2.5 3.8 2.5 6s1.8 4 4 4 4-1.8 4-4"
                                stroke="currentColor"
                                stroke-width="1.3"
                                stroke-linecap="round"
                            />
                            <path
                                d="M8.5 2h2.5v2.5"
                                stroke="currentColor"
                                stroke-width="1.3"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            />
                            <path
                                d="M8.5 4.5l2.5-2.5"
                                stroke="currentColor"
                                stroke-width="1.3"
                                stroke-linecap="round"
                            />
                        </svg>
                        Run GC
                    </button>
                {/if}
            {:else}
                {@const node = $treeNodes.find(
                    (n) => n.id === contextMenu.nodeId,
                )}
                {@const reachable = isReachable(contextMenu.nodeId ?? "")}

                {#if reachable && node}
                    {#if canAddLeft(contextMenu.nodeId ?? "")}
                        <button class="ctx-item" onclick={handleAddLeft}>
                            <svg
                                width="13"
                                height="13"
                                viewBox="0 0 13 13"
                                fill="none"
                            >
                                <circle
                                    cx="6.5"
                                    cy="6.5"
                                    r="5"
                                    stroke="currentColor"
                                    stroke-width="1.3"
                                />
                                <path
                                    d="M6.5 4v5M4 6.5h5"
                                    stroke="currentColor"
                                    stroke-width="1.3"
                                    stroke-linecap="round"
                                />
                            </svg>
                            Add left child
                        </button>
                    {/if}

                    {#if canAddRight(contextMenu.nodeId ?? "")}
                        <button class="ctx-item" onclick={handleAddRight}>
                            <svg
                                width="13"
                                height="13"
                                viewBox="0 0 13 13"
                                fill="none"
                            >
                                <circle
                                    cx="6.5"
                                    cy="6.5"
                                    r="5"
                                    stroke="currentColor"
                                    stroke-width="1.3"
                                />
                                <path
                                    d="M6.5 4v5M4 6.5h5"
                                    stroke="currentColor"
                                    stroke-width="1.3"
                                    stroke-linecap="round"
                                />
                            </svg>
                            Add right child
                        </button>
                    {/if}

                    {#if canAddLeft(contextMenu.nodeId ?? "") || canAddRight(contextMenu.nodeId ?? "")}
                        <div class="ctx-divider"></div>
                    {/if}

                    <button class="ctx-item danger" onclick={handleRemove}>
                        <svg
                            width="13"
                            height="13"
                            viewBox="0 0 13 13"
                            fill="none"
                        >
                            <path
                                d="M2 6.5h2.5M8.5 6.5H11"
                                stroke="currentColor"
                                stroke-width="1.3"
                                stroke-linecap="round"
                            />
                        </svg>
                        Remove node
                    </button>
                {:else}
                    <div class="ctx-label">Unreachable — waiting for GC</div>
                    <button class="ctx-item" onclick={handleGC}>
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
    .canvas-svg {
        display: block;
        width: 100%;
        height: 100%;
        cursor: grab;
        user-select: none;
    }
    .canvas-svg.panning {
        cursor: grabbing;
    }
    .tree-node {
        cursor: pointer;
    }
    .tree-node.unreachable {
        opacity: 0.5;
    }
    .inline-edit {
        position: fixed;
        transform: translate(-50%, -50%);
        width: 80px;
        background: var(--surface2);
        border: 1.5px solid var(--accent);
        border-radius: 50px;
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
        gap: 12px;
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
        min-width: 170px;
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
