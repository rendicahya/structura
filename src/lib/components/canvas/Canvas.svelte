<script>
    import { onMount } from "svelte";
    import NodeComponent from "../node/NodeComponent.svelte";
    import EdgeComponent from "../node/EdgeComponent.svelte";
    import ContextMenu from "../ui/ContextMenu.svelte";
    import EmptyStateSLL from "../ui/EmptyStateSLL.svelte";
    import { pushHistory, undo, redo } from "../../stores/shared/history.js";
    import {
        fitToViewTrigger,
    } from "../../stores/shared/canvasControl.js";
    import {
        nodes,
        edges,
        updateNode,
        removeNodeFromList,
        connectNodes,
        disconnectNode,
        headId,
        tailId,
        walkId,
        setHead,
        setTail,
        setWalk,
        createNode,
        addNode,
    } from "../../stores/sll/graph.js";

    import { createCanvasLogic } from "../../utils/canvasLogic.js";

    const NODE_W = 130;
    const NODE_H = 64;

    let { zoom = $bindable(1) } = $props();
    let svgEl = $state();
    let panX = $state(0);
    let panY = $state(0);
    let panning = $state(false);
    let pendingFrom = $state(null);
    let pendingX = $state(0);
    let pendingY = $state(0);
    let contextMenu = $state(null);
    let canvasContextMenu = $state(null);
    let selectedNodeId = $state(null);
    let inlineEdit = $state(null);
    let inlineInputEl = $state();

    const logic = createCanvasLogic({
        getZoom: () => zoom,
        setZoom: (z) => {
            zoom = z;
        },
        getNodes: () => $nodes,
        updateNodeFn:
            /** @param {string} id @param {any} patch @param {boolean} [silent] */ (
                id,
                patch,
                silent,
            ) => updateNode(id, patch, silent),
    });

    $effect(() => {
        if ($fitToViewTrigger === 0) return;
        fitToView();
    });

    function syncPan() {
        panX = logic.getPanX();
        panY = logic.getPanY();
        panning = logic.isPanning();
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
        if (pendingFrom !== null) {
            pendingFrom = null;
        }
    }

    /** @param {MouseEvent} e */
    function onSVGMousedown(e) {
        canvasContextMenu = null;
        if (e.button !== 0) return;
        if (logic.isBackground(e.target)) {
            selectedNodeId = null;
            contextMenu = null;
            commitInlineEdit();
            logic.startPan(e.clientX, e.clientY);
            syncPan();
        }
    }

    /** @param {MouseEvent} e */
    function onSVGContextMenu(e) {
        e.preventDefault();
        contextMenu = null;
        const pt = logic.getSVGPoint(e.clientX, e.clientY);
        canvasContextMenu = {
            clientX: e.clientX,
            clientY: e.clientY,
            svgX: pt.x,
            svgY: pt.y,
        };
    }

    function onCanvasAddNode() {
        pushHistory();
        const node = createNode(
            canvasContextMenu.svgX - NODE_W / 2,
            canvasContextMenu.svgY - NODE_H / 2,
        );
        addNode(node);
        pushHistory();
        canvasContextMenu = null;
    }

    /** @param {{e: MouseEvent, nodeId: string}} param0 */
    function onNodeDragstart({ e, nodeId }) {
        e.stopPropagation();
        contextMenu = null;
        canvasContextMenu = null;
        selectedNodeId = nodeId;
        logic.startDrag(nodeId, e.clientX, e.clientY);
    }

    /** @param {{e: MouseEvent, nodeId: string}} param0 */
    function onPortDragstart({ e, nodeId }) {
        e.stopPropagation();
        const pt = logic.getSVGPoint(e.clientX, e.clientY);
        pendingFrom = nodeId;
        pendingX = pt.x;
        pendingY = pt.y;
    }

    /** @param {{nodeId: string}} param0 */
    function onConnectTarget({ nodeId }) {
        if (pendingFrom !== null && pendingFrom !== nodeId) {
            pushHistory();
            connectNodes(pendingFrom, nodeId);
            pushHistory();
        }
        pendingFrom = null;
    }

    /** @param {{e: MouseEvent, node: any}} param0 */
    function onContextMenu({ e, node }) {
        e.preventDefault();
        commitInlineEdit();
        canvasContextMenu = null;
        contextMenu = { x: e.clientX, y: e.clientY, node };
        selectedNodeId = node.id;
    }

    /** @param {{node: any}} param0 */
    function onNodeDblClick({ node }) {
        commitInlineEdit();
        contextMenu = null;
        selectedNodeId = node.id;
        const pos = logic.getInlineEditPos(node);
        inlineEdit = { nodeId: node.id, x: pos.x, y: pos.y, value: node.data };
        setTimeout(() => {
            inlineInputEl?.focus();
            inlineInputEl?.select();
        }, 10);
    }

    function commitInlineEdit() {
        if (!inlineEdit) return;
        const edit = inlineEdit;
        inlineEdit = null;
        inlineInputEl = undefined;
        pushHistory();
        updateNode(edit.nodeId, { data: edit.value });
        pushHistory();
    }

    function cancelInlineEdit() {
        inlineEdit = null;
    }

    /** @param {KeyboardEvent} e */
    function onInlineKeydown(e) {
        if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            commitInlineEdit();
        }
        if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            cancelInlineEdit();
        }
    }

    function onMenuClose() {
        contextMenu = null;
    }

    /** @param {{varName: string}} param0 */
    function onMenuRename({ varName }) {
        pushHistory();
        updateNode(contextMenu.node.id, { varName });
        pushHistory();
        contextMenu = null;
    }

    /** @param {{data: any}} param0 */
    function onMenuEditData({ data }) {
        pushHistory();
        updateNode(contextMenu.node.id, { data });
        pushHistory();
        contextMenu = null;
    }

    function onMenuDisconnect() {
        pushHistory();
        disconnectNode(contextMenu.node.id);
        pushHistory();
        contextMenu = null;
    }

    function onMenuSetHead() {
        pushHistory();
        setHead($headId === contextMenu.node.id ? null : contextMenu.node.id);
        pushHistory();
        contextMenu = null;
    }

    function onMenuSetTail() {
        pushHistory();
        setTail($tailId === contextMenu.node.id ? null : contextMenu.node.id);
        pushHistory();
        contextMenu = null;
    }

    function onMenuSetWalk() {
        pushHistory();
        setWalk($walkId === contextMenu.node.id ? null : contextMenu.node.id);
        pushHistory();
        contextMenu = null;
    }

    function onMenuUnlink() {
        pushHistory();
        removeNodeFromList(contextMenu.node.id);
        pushHistory();
        contextMenu = null;
    }

    /** @param {any} edge @param {any[]} ns */
    function edgePos(edge, ns) {
        const from = ns.find((n) => n.id === edge.from);
        const to = ns.find((n) => n.id === edge.to);
        if (!from || !to) return null;
        return {
            fromX: from.x + NODE_W - 8,
            fromY: from.y + NODE_H / 2,
            toX: to.x,
            toY: to.y + NODE_H / 2,
        };
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

    /** @param {BeforeUnloadEvent} e */
    function onBeforeUnload(e) {
        if ($nodes.length > 0) {
            e.preventDefault();
            e.returnValue = "";
        }
    }

    /** @param {WheelEvent} e */
    function handleWheel(e) {
        logic.onWheel(e);
        requestAnimationFrame(() => syncPan());
    }

    function fitToView() {
        if ($nodes.length === 0 || !svgEl) {
            zoom = 1;
            panX = 0;
            panY = 0;
            logic.setPan(0, 0);
            return;
        }

        const rect = svgEl.getBoundingClientRect();
        const padding = 80;

        const minX = Math.min(...$nodes.map((n) => n.x));
        const minY = Math.min(...$nodes.map((n) => n.y));
        const maxX = Math.max(...$nodes.map((n) => n.x + NODE_W));
        const maxY = Math.max(...$nodes.map((n) => n.y + NODE_H));

        const contentW = maxX - minX;
        const contentH = maxY - minY;

        const scaleX = (rect.width - padding * 2) / contentW;
        const scaleY = (rect.height - padding * 2) / contentH;
        zoom = Math.min(Math.min(scaleX, scaleY), 1);

        panX = (rect.width - contentW * zoom) / 2 - minX * zoom;
        panY = (rect.height - contentH * zoom) / 2 - minY * zoom;
        logic.setPan(panX, panY); // ← sync ke logic
    }

    onMount(() => {
        logic.setSvgEl(svgEl);
        window.addEventListener("keydown", onKeydown);
        window.addEventListener("beforeunload", onBeforeUnload);
        svgEl.addEventListener("wheel", handleWheel, { passive: false });
        return () => {
            window.removeEventListener("keydown", onKeydown);
            window.removeEventListener("beforeunload", onBeforeUnload);
            svgEl?.removeEventListener("wheel", handleWheel);
        };
    });
</script>

<svelte:window onmousemove={onWindowMousemove} onmouseup={onWindowMouseup} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="canvas-wrapper">
    <svg
        bind:this={svgEl}
        class="canvas-svg"
        class:panning
        role="application"
        onmousedown={onSVGMousedown}
        oncontextmenu={onSVGContextMenu}
    >
        <defs>
            <pattern
                id="grid"
                width={28}
                height={28}
                patternUnits="userSpaceOnUse"
                patternTransform="translate({panX}, {panY}) scale({zoom})"
            >
                <circle cx="14" cy="14" r="0.8" fill="var(--border)" />
            </pattern>

            <marker
                id="arrow-solid"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
            >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#5b8fff" />
            </marker>

            <marker
                id="arrow-pending"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
            >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#f0b429" />
            </marker>
        </defs>

        <rect width="100%" height="100%" fill="url(#grid)" />

        <g
            style="transform: translate({panX}px, {panY}px) scale({zoom}); transform-origin: 0 0; will-change: transform;"
        >
            {#each $edges as edge (edge.from + "-" + edge.to)}
                {#if edgePos(edge, $nodes)}
                    {@const pos = edgePos(edge, $nodes)}
                    <EdgeComponent {...pos} />
                {/if}
            {/each}

            {#if pendingFrom !== null}
                {#if $nodes.find((n) => n.id === pendingFrom)}
                    {@const from = $nodes.find((n) => n.id === pendingFrom)}
                    <EdgeComponent
                        fromX={from.x + NODE_W - 8}
                        fromY={from.y + NODE_H / 2}
                        toX={pendingX}
                        toY={pendingY}
                        pending={true}
                    />
                {/if}
            {/if}

            {#each $nodes as node (node.id)}
                <NodeComponent
                    {node}
                    selected={selectedNodeId === node.id}
                    connecting={pendingFrom === node.id}
                    isHead={$headId === node.id}
                    isTail={$tailId === node.id}
                    isWalk={$walkId === node.id}
                    ondragstart={onNodeDragstart}
                    onportdragstart={onPortDragstart}
                    onconnecttarget={onConnectTarget}
                    oncontextmenu={onContextMenu}
                    ondblclick={onNodeDblClick}
                />
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

    {#if $nodes.length === 0}
        <div class="empty-hint">
            <EmptyStateSLL />

            <div class="empty-title">Canvas is empty</div>
            <div class="empty-hints-list">
                <div class="empty-hint-item">
                    <kbd>Click</kbd> <span>Add Node in toolbar</span>
                </div>
                <div class="empty-hint-item">
                    <kbd>Right click</kbd> <span>anywhere on canvas</span>
                </div>
            </div>
        </div>
    {/if}
</div>

{#if contextMenu}
    <ContextMenu
        x={contextMenu.x}
        y={contextMenu.y}
        node={$nodes.find((n) => n.id === contextMenu.node.id)}
        isHead={$headId === contextMenu.node.id}
        isTail={$tailId === contextMenu.node.id}
        isWalk={$walkId === contextMenu.node.id}
        hasNext={!!$nodes.find((n) => n.id === contextMenu.node.id)?.nextId}
        hasPrev={false}
        onclose={onMenuClose}
        onrename={onMenuRename}
        oneditData={onMenuEditData}
        ondisconnectNext={onMenuDisconnect}
        ondisconnectPrev={() => {}}
        onsetHead={onMenuSetHead}
        onsetTail={onMenuSetTail}
        onsetWalk={onMenuSetWalk}
        onunlink={onMenuUnlink}
    />
{/if}

{#if canvasContextMenu}
    <div
        class="canvas-ctx-menu"
        style="left: {canvasContextMenu.clientX}px; top: {canvasContextMenu.clientY}px;"
    >
        <button class="ctx-item" onclick={onCanvasAddNode}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
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
            Add a node
        </button>
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
</style>
