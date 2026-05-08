<script>
    import { get } from "svelte/store";

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
    import Tooltip from "../ui/Tooltip.svelte";
    import Icon from "../ui/Icon.svelte";

    const NODE_W = 160;
    const NODE_H = 50;
    const NODE_GAP = 4;
    const CANVAS_PAD_Y = 60;
    const { zoom = 1 } = $props();

    /** @type {SVGSVGElement} */
    let svgEl = $state();

    /** @type {{ x: number, y: number, type: 'canvas' | 'item', itemId?: string } | null} */
    let contextMenu = $state(null);
    let peekingId = $state(null);

    /** @type {string|null} */
    let animatingInId = $state(null);
    let panX = $state(0);
    let panY = $state(0);
    let panning = $state(false);
    let panStartX = 0;
    let panStartY = 0;
    let initialized = $state(false);

    let prevTop = $state(-2); // -2 indicates uninitialized
    $effect(() => {
        const top = $topPtr;
        if (prevTop === -2) {
            prevTop = top;
            return;
        }

        if (top > prevTop) {
            const newItem = $stackItems[top];
            if (newItem) {
                animatingInId = newItem.id;
                setTimeout(() => {
                    animatingInId = null;
                }, 400);
            }
        }
        prevTop = top;
    });

    $effect(() => {
        if ($stackCapacity > 0 && !initialized && svgEl) {
            centerStack();
            initialized = true;
        }
        if ($stackCapacity === 0) initialized = false;
    });

    function onSVGContextMenu(e) {
        e.preventDefault();
        contextMenu = { x: e.clientX, y: e.clientY, type: "canvas" };
    }

    function onItemContextMenu(e, itemId) {
        e.preventDefault();
        e.stopPropagation();
        contextMenu = { x: e.clientX, y: e.clientY, type: "item", itemId };
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

    function centerStack() {
        const rect = svgEl.getBoundingClientRect();
        const stackHeight =
            $stackCapacity * (NODE_H + NODE_GAP) + CANVAS_PAD_Y * 2;
        const stackWidth = NODE_W + 200; // NODE_W + ruang badge TOP + bracket

        panX = rect.width / 2 - stackWidth / 2 - 20;
        panY = rect.height / 2 - stackHeight / 2;
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

    /**
     * @param {number} index
     */
    function getItemY(index) {
        const stackHeight = $stackCapacity * (NODE_H + NODE_GAP);
        return CANVAS_PAD_Y + stackHeight - (index + 1) * (NODE_H + NODE_GAP);
    }

    const STACK_X = 60; // ruang untuk bracket kiri + index label
</script>

<svelte:window onmousemove={onWindowMousemove} onmouseup={onWindowMouseup} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="stack-canvas">
    {#if $stackCapacity === 0}
        <div class="empty-hint">
            <div class="empty-title">Stack not initialized</div>
            <div class="empty-sub">
                Click <strong>New Stack</strong> to get started
            </div>
        </div>
    {:else}
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <svg
            bind:this={svgEl}
            class="stack-svg"
            class:panning
            onmousedown={onSVGMousedown}
            oncontextmenu={onSVGContextMenu}
        >
            <defs>
                <pattern
                    id="grid-stack"
                    width="28"
                    height="28"
                    patternUnits="userSpaceOnUse"
                >
                    <circle cx="14" cy="14" r="0.8" fill="var(--border)" />
                </pattern>
            </defs>

            <rect width="100%" height="100%" fill="url(#grid-stack)" />

            <g
                style="transform: translate({panX}px, {panY}px) scale({zoom}); transform-origin: 0 0;"
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

                <!-- Item slots -->
                {#each $stackItems as item, index (item?.id || `empty-${index}`)}
                    {@const y = getItemY(index)}
                    {@const isActive = index <= $topPtr}
                    {@const isTop = index === $topPtr}
                    {@const isAnimIn = isActive && animatingInId === item?.id}
                    {@const isPeeking = isActive && peekingId === item?.id}

                    {#if !item}
                        <!-- Slot benar-benar kosong -->
                        <rect
                            x={STACK_X}
                            {y}
                            width={NODE_W}
                            height={NODE_H}
                            rx="6"
                            fill="var(--surface)"
                            stroke="var(--border)"
                            stroke-width="1"
                            stroke-dasharray="4 3"
                        />
                    {:else}
                        <!-- Item yang ada (aktif atau poppped) -->
                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                        <g
                            class="stack-item"
                            class:anim-in={isAnimIn}
                            class:peeking={isPeeking}
                            style={!isActive ? "opacity: 0.35;" : ""}
                            oncontextmenu={(e) =>
                                isActive && onItemContextMenu(e, item.id)}
                        >
                            <rect
                                x={STACK_X}
                                {y}
                                width={NODE_W}
                                height={NODE_H}
                                rx="6"
                                fill="var(--node-bg)"
                                stroke={isPeeking
                                    ? "var(--warning)"
                                    : isTop
                                      ? "var(--accent)"
                                      : "var(--node-border)"}
                                stroke-width={isPeeking || isTop ? 1.8 : 1}
                            />
                            {#if isTop && !isPeeking}
                                <rect
                                    x={STACK_X + 1}
                                    y={y + 1}
                                    width={NODE_W - 2}
                                    height="3"
                                    rx="2"
                                    fill="var(--accent)"
                                    opacity="0.8"
                                />
                            {/if}
                            {#if isPeeking}
                                <rect
                                    x={STACK_X + 1}
                                    y={y + 1}
                                    width={NODE_W - 2}
                                    height="3"
                                    rx="2"
                                    fill="var(--warning)"
                                    opacity="0.8"
                                />
                            {/if}
                            <text
                                x={STACK_X + NODE_W / 2}
                                y={y + NODE_H / 2 + 5}
                                text-anchor="middle"
                                font-family="var(--font-mono)"
                                font-size="14"
                                fill={item.value
                                    ? "#e8ecf5"
                                    : "var(--text-muted)"}
                                font-weight="500">{item.value || "0"}</text
                            >
                        </g>
                    {/if}

                    <!-- Index label selalu ada -->
                    <text
                        x={STACK_X - 8}
                        y={y + NODE_H / 2 + 4}
                        text-anchor="end"
                        font-family="var(--font-mono)"
                        font-size="10"
                        fill="var(--text-muted)">{index}</text
                    >
                {/each}

                <!-- TOP badge (Ditingkatkan dengan animasi transisi vertikal) -->
                {#if $topPtr !== -1}
                    <g
                        class="top-pointer"
                        style="transform: translateY({getItemY($topPtr)}px);"
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
            </g>
        </svg>

        {#if $stackCapacity > 0}
            <div
                class="canvas-actions"
                style="
                left: {panX + (STACK_X + NODE_W / 2) * zoom}px; 
                top: {panY + (CANVAS_PAD_Y - 42) * zoom}px;
                transform: translate(-50%, -50%) scale({zoom});
            "
            >
                <Tooltip text={$stackIsFull ? "Stack is full" : "Push value"}>
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
    {/if}
</div>

<style>
    .stack-canvas {
        position: relative;
        width: 100%;
        height: 100%;
        background: var(--bg);
        overflow: hidden;
    }
    .stack-svg {
        display: block;
        width: 100%;
        height: 100%;
        cursor: grab;
        user-select: none;
    }
    .stack-svg.panning {
        cursor: grabbing;
    }

    /* Actions Overlay */
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

    .stack-item {
        transition: transform 0.3s ease;
    }
    .stack-item.anim-in {
        animation: slideDown 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    @keyframes slideDown {
        from {
            opacity: 0;
            transform: translateY(-30px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    .empty-hint {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        text-align: center;
        pointer-events: none;
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
    .peeking {
        filter: drop-shadow(0 0 6px rgba(240, 180, 41, 0.5));
    }

    /* TOP Pointer Animation */
    .top-pointer {
        transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
</style>
