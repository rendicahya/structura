<script>
    import { untrack } from "svelte";
    import { get } from "svelte/store";
    import { SvelteFlow, Background, Controls } from "@xyflow/svelte";
    import "@xyflow/svelte/dist/style.css";
    import StackFlowNode from "../node/StackFlowNode.svelte";
    import Tooltip from "../ui/Tooltip.svelte";
    import Icon from "../ui/Icon.svelte";
    import {
        stackItems,
        stackCapacity,
        stackIsFull,
        stackIsEmpty,
        topPtr,
        stackVarName,
        stackType,
    } from "../../stores/stack/graphStack.js";
    import { logOpStack } from "../../stores/shared/stackLog.js";
    import { ZOOM_MIN, ZOOM_MAX } from "../../utils/canvasConstants.js";

    const NODE_W = 160;
    const NODE_H = 50;
    const NODE_GAP = 4;
    const CANVAS_PAD_Y = 60;
    const STACK_X = 60;

    let { zoom = $bindable(1) } = $props();

    const nodeTypes = { stack: StackFlowNode };

    /** @type {HTMLDivElement} */
    let wrapperEl = $state();

    let viewport = $state({ x: 0, y: 0, zoom: 1 });
    let initialized = $state(false);
    // Svelte Flow's own pan/zoom gesture seeds its internal transform once,
    // at mount, from whatever `viewport` holds at that instant. Recentering
    // after mount (e.g. after navigating here or creating a new stack) only
    // updates the value we render from, not that internal transform, so the
    // next drag would otherwise snap back to a transform based on the stale
    // pre-center position. Remounting Svelte Flow whenever we recenter forces
    // it to reseed from the now-correct `viewport`, keeping the two in sync.
    // (See CanvasSLLFlow.svelte for why `initialViewport` is also wired
    // below: without it, the outgoing instance's own teardown resets
    // `viewport` back to the library default right before the new instance
    // reads it, clobbering our correction.)
    let flowGen = $state(0);
    // Only reseed automatically, before the user has touched this mounted
    // instance's pan/zoom directly — once they have, its internal transform
    // is live and trustworthy, and remounting on every toolbar zoom-in/out
    // click would flicker the canvas for no benefit.
    let userInteracted = false;

    /** @type {{ x: number, y: number, type: 'canvas' | 'item', itemId?: string } | null} */
    let contextMenu = $state(null);
    let peekingId = $state(null);

    /** @type {string|null} */
    let animatingInId = $state(null);
    /** @type {{ value: any, x: number, y: number, opacity: number } | null} */
    let animatingPop = $state(null);

    // Same one-way-reactive/one-way-event zoom sync as CanvasSLLFlow/CanvasDLLFlow:
    // the shared toolbar's zoom buttons (or a restored per-page zoom on
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

    function getItemY(index, capacity) {
        const stackHeight = capacity * (NODE_H + NODE_GAP);
        return CANVAS_PAD_Y + stackHeight - (index + 1) * (NODE_H + NODE_GAP);
    }

    function centerStack() {
        if (!wrapperEl) return;
        const rect = wrapperEl.getBoundingClientRect();
        const stackHeight = $stackCapacity * (NODE_H + NODE_GAP) + CANVAS_PAD_Y * 2;
        const stackWidth = NODE_W + 200; // NODE_W + TOP badge space + bracket
        viewport = {
            ...viewport,
            x: rect.width / 2 - stackWidth / 2 - 20,
            y: rect.height / 2 - stackHeight / 2,
        };
        flowGen++;
    }

    $effect(() => {
        if ($stackCapacity > 0 && !initialized && wrapperEl) {
            centerStack();
            initialized = true;
        }
        if ($stackCapacity === 0) initialized = false;
    });

    // Push/pop enter/exit animations, ported from the hand-rolled CanvasStack:
    // slots animate in via CSS (StackFlowNode's .anim-in), pops fly out via a
    // hand-rolled rAF loop rendered in the decoration overlay below.
    let prevTop = $state(-2); // -2 indicates uninitialized
    $effect(() => {
        const top = $topPtr;
        const items = $stackItems;
        if (prevTop === -2) {
            prevTop = top;
            return;
        }

        if (top > prevTop) {
            const newItem = items[top];
            if (newItem) {
                animatingInId = newItem.id;
                setTimeout(() => {
                    animatingInId = null;
                }, 800);
            }
        } else if (top < prevTop && prevTop >= 0) {
            const poppedItem = items[prevTop];
            if (poppedItem) {
                const startX = STACK_X;
                const startY = getItemY(prevTop, $stackCapacity);

                animatingPop = {
                    value: poppedItem.value,
                    x: startX,
                    y: startY,
                    opacity: 1,
                };

                const start = performance.now();
                const duration = 400;

                function step(now) {
                    const t = Math.min((now - start) / duration, 1);
                    const eased = 1 - Math.pow(1 - t, 3);

                    if (animatingPop) {
                        animatingPop.y = startY - 120 * eased;
                        animatingPop.opacity = 1 - eased;
                    }

                    if (t < 1) {
                        requestAnimationFrame(step);
                    } else {
                        animatingPop = null;
                    }
                }
                requestAnimationFrame(step);
            }
        }
        prevTop = top;
    });

    let flowNodes = $derived(
        Array.from({ length: $stackCapacity }, (_, index) => {
            const item = $stackItems[index];
            return {
                id: `slot-${index}`,
                type: "stack",
                position: { x: STACK_X, y: getItemY(index, $stackCapacity) },
                draggable: false,
                selectable: false,
                connectable: false,
                data: {
                    index,
                    value: item?.value ?? null,
                    isEmpty: !item,
                    isActive: index <= $topPtr,
                    isTop: index === $topPtr,
                    isPeeking: !!item && peekingId === item.id,
                    isAnimIn: !!item && animatingInId === item.id,
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
        if (node.data.isActive) {
            const item = $stackItems[node.data.index];
            contextMenu = {
                x: event.clientX,
                y: event.clientY,
                type: "item",
                itemId: item?.id,
            };
        } else {
            contextMenu = { x: event.clientX, y: event.clientY, type: "canvas" };
        }
    }

    function closeContextMenu() {
        contextMenu = null;
    }

    function handlePeek(itemId) {
        peekingId = itemId;

        const varName = get(stackVarName);
        const type = get(stackType);
        const top = get(topPtr);

        if (top !== -1) {
            logOpStack(
                `${type} peeked = ${varName}[top]; // peek`,
                `peeked = ${varName}[top]  # peek`,
            );
        }

        setTimeout(() => {
            peekingId = null;
        }, 1500);
        closeContextMenu();
    }

    function handlePushFromMenu() {
        closeContextMenu();
        window.dispatchEvent(new CustomEvent("stack:push"));
    }

    function handlePopFromMenu() {
        closeContextMenu();
        window.dispatchEvent(new CustomEvent("stack:pop"));
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

    {#if $stackCapacity > 0}
        <svg class="stack-decor">
            <g
                style="transform: translate({viewport.x}px, {viewport.y}px) scale({viewport.zoom}); transform-origin: 0 0;"
            >
                <!-- Array bracket kiri -->
                <path
                    d="M {STACK_X - 16} {CANVAS_PAD_Y - 4}
             L {STACK_X - 24} {CANVAS_PAD_Y - 4}
             L {STACK_X - 24} {CANVAS_PAD_Y +
                        $stackCapacity * (NODE_H + NODE_GAP) -
                        NODE_GAP +
                        4}
             L {STACK_X - 16} {CANVAS_PAD_Y +
                        $stackCapacity * (NODE_H + NODE_GAP) -
                        NODE_GAP +
                        4}"
                    fill="none"
                    stroke="var(--border-bright)"
                    stroke-width="2"
                    stroke-linecap="round"
                />

                <!-- Array bracket kanan -->
                <path
                    d="M {STACK_X + NODE_W + 16} {CANVAS_PAD_Y - 4}
             L {STACK_X + NODE_W + 24} {CANVAS_PAD_Y - 4}
             L {STACK_X + NODE_W + 24} {CANVAS_PAD_Y +
                        $stackCapacity * (NODE_H + NODE_GAP) -
                        NODE_GAP +
                        4}
             L {STACK_X + NODE_W + 16} {CANVAS_PAD_Y +
                        $stackCapacity * (NODE_H + NODE_GAP) -
                        NODE_GAP +
                        4}"
                    fill="none"
                    stroke="var(--border-bright)"
                    stroke-width="2"
                    stroke-linecap="round"
                />

                <!-- TOP badge -->
                {#if $topPtr !== -1}
                    <g
                        class="top-pointer"
                        style="transform: translateY({getItemY(
                            $topPtr,
                            $stackCapacity,
                        )}px);"
                    >
                        <line
                            x1={STACK_X + NODE_W + 50}
                            y1={NODE_H / 2}
                            x2={STACK_X + NODE_W + 2}
                            y2={NODE_H / 2}
                            stroke="var(--success)"
                            stroke-width="1.5"
                        />
                        <polygon
                            points="{STACK_X + NODE_W + 8},{NODE_H / 2 -
                                4} {STACK_X + NODE_W + 2},{NODE_H /
                                2} {STACK_X + NODE_W + 8},{NODE_H / 2 + 4}"
                            fill="var(--success)"
                        />
                        <rect
                            x={STACK_X + NODE_W + 50}
                            y={NODE_H / 2 - 12}
                            width="40"
                            height="20"
                            rx="5"
                            fill="rgba(78,204,163,0.15)"
                            stroke="var(--success)"
                            stroke-width="1.2"
                        />
                        <text
                            x={STACK_X + NODE_W + 70}
                            y={NODE_H / 2 + 1}
                            text-anchor="middle"
                            font-family="var(--font-mono)"
                            font-size="9"
                            font-weight="700"
                            fill="var(--success)"
                            letter-spacing="0.8">TOP</text
                        >
                    </g>
                {/if}

                {#if $stackIsFull}
                    <text
                        x={STACK_X + NODE_W / 2}
                        y={CANVAS_PAD_Y +
                            $stackCapacity * (NODE_H + NODE_GAP) +
                            24}
                        text-anchor="middle"
                        font-family="var(--font-ui)"
                        font-size="11"
                        fill="var(--danger)"
                        font-weight="700"
                        letter-spacing="0.5">STACK FULL</text
                    >
                {:else if $stackIsEmpty}
                    <text
                        x={STACK_X + NODE_W / 2}
                        y={CANVAS_PAD_Y +
                            $stackCapacity * (NODE_H + NODE_GAP) +
                            24}
                        text-anchor="middle"
                        font-family="var(--font-ui)"
                        font-size="11"
                        fill="var(--accent)"
                        font-weight="700"
                        letter-spacing="0.5">STACK EMPTY</text
                    >
                {/if}

                <!-- Pop animation element -->
                {#if animatingPop}
                    <g
                        style="transform: translate({animatingPop.x}px, {animatingPop.y}px); opacity: {animatingPop.opacity};"
                    >
                        <rect
                            width={NODE_W}
                            height={NODE_H}
                            rx="6"
                            fill="var(--node-bg)"
                            stroke="var(--accent)"
                            stroke-width="1.8"
                        />
                        <text
                            x={NODE_W / 2}
                            y={NODE_H / 2 + 5}
                            text-anchor="middle"
                            font-family="var(--font-mono)"
                            font-size="14"
                            fill="var(--text)"
                            font-weight="500">{animatingPop.value}</text
                        >
                    </g>
                {/if}
            </g>
        </svg>

        <div
            class="canvas-actions"
            style="
            left: {viewport.x + (STACK_X + NODE_W / 2) * viewport.zoom}px;
            top: {viewport.y + (CANVAS_PAD_Y - 42) * viewport.zoom}px;
            transform: translate(-50%, -50%) scale({viewport.zoom});
        "
        >
            <Tooltip
                text={$stackIsFull ? "Stack is full" : "Push value"}
                shortcut="N"
            >
                <button
                    class="btn-canvas btn-push"
                    onclick={handlePushFromMenu}
                    disabled={$stackIsFull}
                >
                    <Icon name="push" size={14} />
                    <span>Push</span>
                </button>
            </Tooltip>
            <Tooltip
                text={$stackIsEmpty ? "Stack is empty" : "Pop top element"}
                shortcut="M"
            >
                <button
                    class="btn-canvas btn-pop"
                    onclick={handlePopFromMenu}
                    disabled={$stackIsEmpty}
                >
                    <Icon name="pop" size={14} />
                    <span>Pop</span>
                </button>
            </Tooltip>
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
                <button class="ctx-item" onclick={handlePushFromMenu}>
                    <Icon name="push" size={13} />
                    Push
                </button>
                <button
                    class="ctx-item"
                    onclick={handlePopFromMenu}
                    disabled={$stackIsEmpty}
                >
                    <Icon name="pop" size={13} />
                    Pop
                </button>
                <div class="ctx-divider"></div>
                <button
                    class="ctx-item"
                    onclick={() => handlePeek(contextMenu?.itemId ?? "")}
                    disabled={$stackIsEmpty}
                >
                    <Icon name="walk" size={13} />
                    Peek
                </button>
            {:else}
                <button class="ctx-item" onclick={handlePopFromMenu}>
                    <Icon name="pop" size={13} />
                    Pop
                </button>
                <button
                    class="ctx-item"
                    onclick={() => handlePeek(contextMenu?.itemId ?? "")}
                >
                    <Icon name="walk" size={13} />
                    Peek
                </button>
            {/if}
        </div>
    {/if}

    {#if $stackCapacity === 0}
        <div class="empty-hint">
            <div class="empty-title">Stack not initialized</div>
            <div class="empty-sub">
                Click <strong>New Stack</strong> to get started
            </div>
        </div>
    {/if}
</div>

<style>
    .canvas-wrapper {
        position: relative;
        width: 100%;
        height: 100%;
        background: var(--bg);
        overflow: hidden;
    }
    :global(.svelte-flow) {
        background: var(--bg);
    }
    .stack-decor {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 5;
    }
    .top-pointer {
        transition: transform 0.4s cubic-bezier(0.25, 1, 0.5, 1);
    }

    /* Actions overlay */
    .canvas-actions {
        position: absolute;
        display: flex;
        gap: 8px;
        pointer-events: auto;
        z-index: 10;
        transition: transform 0.1s ease-out;
    }
    .btn-canvas {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 14px;
        border-radius: 8px;
        border: 1px solid var(--border-bright);
        background: var(--surface);
        color: var(--text);
        font-family: var(--font-ui);
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        transition: all 0.15s ease;
    }
    .btn-canvas:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
        border-color: var(--accent);
    }
    .btn-canvas:active:not(:disabled) {
        transform: translateY(0);
    }
    .btn-canvas:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    .btn-push {
        background: var(--accent);
        color: white;
        border: none;
    }
    .btn-push:hover:not(:disabled) {
        background: #6f9fff;
    }
    .btn-pop {
        background: var(--surface2);
        color: var(--text);
    }

    .empty-hint {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        text-align: center;
        pointer-events: none;
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
        margin-bottom: 8px;
    }
    .empty-sub {
        font-size: 13px;
        color: var(--text-muted);
    }
    .empty-sub strong {
        color: var(--accent);
    }
    .ctx-menu {
        position: fixed;
        z-index: 1000;
        background: var(--surface);
        border: 1px solid var(--border-bright);
        border-radius: 10px;
        padding: 6px;
        min-width: 150px;
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
