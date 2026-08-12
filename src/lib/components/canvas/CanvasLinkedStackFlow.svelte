<script>
    import { untrack, onMount } from "svelte";
    import { SvelteFlow, Background } from "@xyflow/svelte";
    import "@xyflow/svelte/dist/style.css";
    import LinkedStackFlowNode from "../node/LinkedStackFlowNode.svelte";
    import {
        linkedStackNodes,
        topId,
        linkedStackIsEmpty,
        garbageCollectLinkedStack,
        peekLinkedStack,
    } from "../../stores/stack/graphLinkedStack.js";
    import { pushHistory } from "../../stores/shared/history.js";
    import { ZOOM_MIN, ZOOM_MAX } from "../../utils/canvasConstants.js";

    const NODE_W = 130;
    const NODE_H = 64;
    const NODE_GAP = 40;
    const GROUND_LEN = 22;
    const GROUND_LINES = [{ w: 14 }, { w: 9 }, { w: 4 }];

    let { zoom = $bindable(1) } = $props();

    const nodeTypes = { linkedstack: LinkedStackFlowNode };

    /** @type {HTMLDivElement} */
    let wrapperEl = $state();

    let viewport = $state({ x: 0, y: 0, zoom: 1 });
    let initialized = $state(false);
    let peekingId = $state(null);
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

    let animatingInId = $state(null);
    let prevLength = $linkedStackNodes.length;

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

    // Push entry animation, ported from CanvasLinkedStack.
    $effect(() => {
        const nodes = $linkedStackNodes;
        const currentLength = nodes.length;
        if (currentLength > prevLength && currentLength > 0) {
            animatingInId = nodes[currentLength - 1].id;
            setTimeout(() => {
                animatingInId = null;
            }, 500);
        }
        prevLength = currentLength;
    });

    function centerStack() {
        if (!wrapperEl) return;
        const rect = wrapperEl.getBoundingClientRect();
        viewport = { ...viewport, x: rect.width / 2 - NODE_W / 2, y: 120 };
        flowGen++;
    }

    $effect(() => {
        const nodes = $linkedStackNodes;
        if (nodes.length > 0 && !initialized && wrapperEl) {
            centerStack();
            initialized = true;
        } else if (nodes.length === 0) {
            initialized = false;
        }
    });

    // Node positions are index-in-array-derived (see getNodeIndex), same as
    // the hand-rolled CanvasLinkedStack — GC re-indexes the array, so we
    // suppress the position transition during GC to avoid a jarring reflow.
    let prevNodeCount = 0;
    let isGCing = $state(false);
    $effect.pre(() => {
        const currentCount = $linkedStackNodes.length;
        isGCing = currentCount < prevNodeCount && currentCount > 0;
        prevNodeCount = currentCount;
    });

    let stackNodeIds = $derived(
        (() => {
            const nodes = $linkedStackNodes;
            const currentTopId = $topId;
            if (!currentTopId) return [];
            const result = [];
            let currentId = currentTopId;
            const seen = new Set();
            while (currentId) {
                if (seen.has(currentId)) break;
                seen.add(currentId);
                result.push(currentId);
                const node = nodes.find((n) => n.id === currentId);
                currentId = node?.nextId ?? null;
            }
            return result;
        })(),
    );

    let unreachableIds = $derived(
        new Set(
            $linkedStackNodes
                .filter((n) => !stackNodeIds.includes(n.id))
                .map((n) => n.id),
        ),
    );

    function getNodeIndex(id) {
        return $linkedStackNodes.findIndex((n) => n.id === id);
    }

    function getNodeY(id) {
        const idx = getNodeIndex(id);
        return idx !== -1 ? -idx * (NODE_H + NODE_GAP) : 0;
    }

    let nodeTransition = $derived(
        `transition: ${isGCing ? "none" : "transform 0.4s ease-in-out"};`,
    );

    let flowNodes = $derived(
        $linkedStackNodes.map((node, idx) => ({
            id: node.id,
            type: "linkedstack",
            position: { x: 0, y: -idx * (NODE_H + NODE_GAP) },
            draggable: false,
            selectable: false,
            connectable: false,
            style: nodeTransition,
            data: {
                varName: node.varName,
                value: node.data,
                isTop: node.id === $topId,
                isUnreachable: unreachableIds.has(node.id),
                isPeeking: peekingId === node.id,
                isAnimIn: animatingInId === node.id,
            },
        })),
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

    function handlePushFromMenu() {
        closeContextMenu();
        window.dispatchEvent(new CustomEvent("linkedstack:push"));
    }

    function handlePopFromMenu() {
        closeContextMenu();
        window.dispatchEvent(new CustomEvent("linkedstack:pop"));
    }

    function handlePeekFromMenu(nodeId) {
        peekingId = nodeId ?? $topId;
        peekLinkedStack();
        setTimeout(() => {
            peekingId = null;
        }, 1500);
        closeContextMenu();
    }

    function handleGCFromMenu() {
        closeContextMenu();
        pushHistory();
        garbageCollectLinkedStack();
        pushHistory();
    }

    onMount(() => {
        const onPeek = () => {
            peekingId = $topId;
            setTimeout(() => {
                peekingId = null;
            }, 1500);
        };
        window.addEventListener("linkedstack:peek", onPeek);
        return () => {
            window.removeEventListener("linkedstack:peek", onPeek);
        };
    });
</script>

<div class="canvas-wrapper" bind:this={wrapperEl}>
    {#if $linkedStackIsEmpty && $linkedStackNodes.length === 0}
        <div class="empty-hint">
            <div class="empty-title">Stack is empty</div>
            <div class="empty-hints-list">
                <div class="empty-hint-item">
                    <kbd>Push</kbd> <span>to add a node</span>
                </div>
                <div class="empty-hint-item">
                    <kbd>Right click</kbd> <span>for options</span>
                </div>
            </div>
        </div>
    {/if}

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
        </SvelteFlow>
    {/key}

    <svg class="ls-decor">
        <defs>
            <marker id="arrow-ls-flow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="#5b8fff" />
            </marker>
        </defs>
        <g
            style="transform: translate({viewport.x}px, {viewport.y}px) scale({viewport.zoom}); transform-origin: 0 0;"
        >
            {#each $linkedStackNodes as node, idx (node.id)}
                {@const y = -idx * (NODE_H + NODE_GAP)}
                {@const isUnreachable = unreachableIds.has(node.id)}

                {#if node.nextId && !isUnreachable}
                    {@const nextY = getNodeY(node.nextId)}
                    {@const dy = nextY - y}
                    <line
                        x1={NODE_W / 2}
                        y1={y + NODE_H}
                        x2={NODE_W / 2}
                        y2={y + dy - 4}
                        stroke="var(--accent)"
                        stroke-width="1.8"
                        marker-end="url(#arrow-ls-flow)"
                        style={nodeTransition}
                    />
                {/if}

                {#if !node.nextId && !isUnreachable}
                    <line
                        x1={NODE_W / 2}
                        y1={y + NODE_H}
                        x2={NODE_W / 2}
                        y2={y + NODE_H + GROUND_LEN}
                        stroke="var(--text-muted)"
                        stroke-width="1.5"
                        style={nodeTransition}
                    />
                    {#each GROUND_LINES as gl, i}
                        <line
                            x1={NODE_W / 2 - gl.w / 2}
                            y1={y + NODE_H + GROUND_LEN + i * 7}
                            x2={NODE_W / 2 + gl.w / 2}
                            y2={y + NODE_H + GROUND_LEN + i * 7}
                            stroke="var(--text-muted)"
                            stroke-width="1.5"
                            style={nodeTransition}
                        />
                    {/each}
                {/if}
            {/each}

            {#if $topId}
                {@const ty = getNodeY($topId)}
                <g class="top-pointer" style="transform: translateY({ty}px); {nodeTransition}">
                    <rect
                        x={NODE_W + 10}
                        y={NODE_H / 2 - 10}
                        width="40"
                        height="20"
                        rx="5"
                        fill="rgba(78,204,163,0.15)"
                        stroke="var(--success)"
                        stroke-width="1.2"
                    />
                    <text
                        x={NODE_W + 30}
                        y={NODE_H / 2 + 4}
                        text-anchor="middle"
                        font-family="var(--font-mono)"
                        font-size="9"
                        font-weight="700"
                        fill="var(--success)"
                        letter-spacing="0.8">TOP</text
                    >
                    <line
                        x1={NODE_W + 10}
                        y1={NODE_H / 2}
                        x2={NODE_W + 1}
                        y2={NODE_H / 2}
                        stroke="var(--success)"
                        stroke-width="1.5"
                    />
                    <polygon
                        points="{NODE_W + 7},{NODE_H / 2 - 4} {NODE_W + 1},{NODE_H / 2} {NODE_W + 7},{NODE_H / 2 + 4}"
                        fill="var(--success)"
                    />
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
                <button class="ctx-item" onclick={handlePushFromMenu}>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 9V4M4 6.5l2.5 2.5 2.5-2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    Push
                    <kbd class="ctx-shortcut">N</kbd>
                </button>
                <button class="ctx-item" onclick={handlePopFromMenu} disabled={$linkedStackIsEmpty}>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 4v5M4 6.5l2.5-2.5 2.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    Pop
                    <kbd class="ctx-shortcut">M</kbd>
                </button>
                <div class="ctx-divider"></div>
                <button class="ctx-item" onclick={handleGCFromMenu}>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 2C4.3 2 2.5 3.8 2.5 6s1.8 4 4 4 4-1.8 4-4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M8.5 2h2.5v2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M8.5 4.5l2.5-2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
                    Run GC
                </button>
            {:else}
                {@const isTop = contextMenu.nodeId === $topId}
                {@const isUnreachable = unreachableIds.has(contextMenu.nodeId)}
                {#if !isUnreachable}
                    <button class="ctx-item" onclick={handlePopFromMenu} disabled={!isTop}>
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 4v5M4 6.5l2.5-2.5 2.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        Pop {!isTop ? "(top only)" : ""}
                    </button>
                    <button class="ctx-item" onclick={() => handlePeekFromMenu(contextMenu?.nodeId)}>
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="4" stroke="currentColor" stroke-width="1.3"/><circle cx="6.5" cy="6.5" r="1.5" fill="currentColor"/></svg>
                        Peek
                    </button>
                {:else}
                    <button class="ctx-item" onclick={handleGCFromMenu}>
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 2C4.3 2 2.5 3.8 2.5 6s1.8 4 4 4 4-1.8 4-4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M8.5 2h2.5v2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M8.5 4.5l2.5-2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
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
    .ls-decor {
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
    .ctx-shortcut {
        margin-left: auto;
        font-family: var(--font-mono);
        font-size: 10px;
        color: var(--text-muted);
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 4px;
        padding: 1px 5px;
    }
    .ctx-divider {
        height: 1px;
        background: var(--border);
        margin: 4px 0;
    }
</style>
