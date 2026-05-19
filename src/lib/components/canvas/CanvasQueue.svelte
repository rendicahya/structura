<script>
    // Stores
    import {
        queueSlots,
        queueCapacity,
        frontPtr,
        rearPtr,
        queueIsFull,
        queueIsEmpty,
        queueSize,
        peekQueue,
    } from "../../stores/queue/graphQueue.js";
    import { toast } from "../../stores/shared/toast.js";

    const NODE_W = 80;
    const NODE_H = 70;
    const NODE_GAP = 4;
    const CANVAS_PAD_X = 60;
    const CANVAS_PAD_Y = 80;
    const ARROW_SIZE = 40;
    const ARROW_OFFSET = 16;

    const { zoom = 1 } = $props();

    /** @type {SVGSVGElement} */
    let svgEl = $state();

    let panX = $state(0);
    let panY = $state(0);
    let panning = $state(false);
    let panStartX = 0;
    let panStartY = 0;
    let initialized = false;
    let centeredSlotsRef = null;
    let peekingIndex = $state(null);
    let animatingEnqueueIndex = $state(null);
    let animatingEnqueue = $state(null);
    let animatingDequeueIndex = $state(null);
    let animatingDequeue = $state(null);
    let totalW = $derived($queueCapacity * (NODE_W + NODE_GAP) - NODE_GAP);

    let frontBadgeX = $state(null);
    let frontAnimating = $state(false);
    let animatingFrontTo = $state(null);

    let rearBadgeX = $state(null);
    let rearAnimating = $state(false);
    let animatingRearTo = $state(null);

    let prevFrontPtr = $state(-1);
    let prevRearPtr = $state(-1);
    let prevSize = $state(-1);

    $effect(() => {
        const currentFront = $frontPtr;
        const currentRear = $rearPtr;
        const currentSize = $queueSize;
        const cap = $queueCapacity;
        const slots = $queueSlots;

        if (prevSize === -1) {
            prevFrontPtr = currentFront;
            prevRearPtr = currentRear;
            prevSize = currentSize;
            return;
        }

        // Animasi Enqueue meluncur dari kanan
        if (currentSize > prevSize && cap > 0) {
            const targetIndex = (currentRear - 1 + cap) % cap;
            const newValue = slots[targetIndex]?.value;
            if (newValue !== undefined) {
                const targetX = getSlotX(targetIndex);
                const targetY = SLOT_Y;
                const startX = CANVAS_PAD_X + totalW + 24 + ARROW_OFFSET + ARROW_SIZE / 2;
                const startY = SLOT_Y;

                animatingEnqueue = {
                    value: newValue,
                    x: startX,
                    y: startY,
                    opacity: 1
                };
                animatingEnqueueIndex = targetIndex;

                const start = performance.now();
                const duration = 500;

                function step(now) {
                    const t = Math.min((now - start) / duration, 1);
                    const eased = 1 - Math.pow(1 - t, 3); // cubic ease out

                    if (animatingEnqueue) {
                        animatingEnqueue.x = startX + (targetX - startX) * eased;
                        animatingEnqueue.y = startY + (targetY - startY) * eased;
                    }

                    if (t < 1) {
                        requestAnimationFrame(step);
                    } else {
                        animatingEnqueue = null;
                        animatingEnqueueIndex = null;
                    }
                }
                requestAnimationFrame(step);
            }
        }

        // Animasi Dequeue bergeser ke kiri
        if (currentSize < prevSize && prevSize > 0) {
            const dequeuedValue = slots[prevFrontPtr]?.value ?? null;
            if (dequeuedValue !== null) {
                const startX = getSlotX(prevFrontPtr);
                const startY = SLOT_Y;
                const targetX =
                    CANVAS_PAD_X - 24 - ARROW_OFFSET - ARROW_SIZE / 2 - 100;
                const targetY = SLOT_Y;

                animatingDequeue = {
                    value: dequeuedValue,
                    x: startX,
                    y: startY,
                    opacity: 1,
                };

                const start = performance.now();
                const duration = 450;

                function step(now) {
                    const t = Math.min((now - start) / duration, 1);
                    const eased = 1 - Math.pow(1 - t, 3); // cubic ease out

                    if (animatingDequeue) {
                        animatingDequeue.x = startX + (targetX - startX) * eased;
                        animatingDequeue.y = startY + (targetY - startY) * eased;
                        animatingDequeue.opacity = 1 - eased;
                    }

                    if (t < 1) {
                        requestAnimationFrame(step);
                    } else {
                        animatingDequeue = null;
                    }
                }
                requestAnimationFrame(step);
            }
        }

        // Animasi REAR bergerak saat Enqueue
        if (currentSize > prevSize && currentSize > 1 && cap > 0) {
            const fromIndex = (prevRearPtr - 1 + cap) % cap;
            const toIndex = (currentRear - 1 + cap) % cap;

            const fromX = getSlotX(fromIndex) + NODE_W / 2;
            const toX = getSlotX(toIndex) + NODE_W / 2;

            // Handle wrap-around animation (jangan melompat balik kalau bisa, tapi untuk sekarang linear aja)
            // Jika loncat jauh (wrap), matikan animasi atau buat khusus.
            const isWrap = Math.abs(toIndex - fromIndex) > 1;

            if (!isWrap) {
                rearBadgeX = fromX;
                rearAnimating = true;
                animatingRearTo = toIndex;

                const start = performance.now();
                const duration = 350;

                function step(now) {
                    const t = Math.min((now - start) / duration, 1);
                    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
                    rearBadgeX = fromX + (toX - fromX) * eased;

                    if (t < 1) {
                        requestAnimationFrame(step);
                    } else {
                        rearBadgeX = null;
                        rearAnimating = false;
                        animatingRearTo = null;
                    }
                }
                requestAnimationFrame(step);
            }
        }

        // Animasi FRONT bergerak saat Dequeue
        if (currentSize < prevSize && prevSize > 1 && currentSize > 0 && cap > 0) {
            const fromIndex = prevFrontPtr;
            const toIndex = currentFront;

            const fromX = getSlotX(fromIndex) + NODE_W / 2;
            const toX = getSlotX(toIndex) + NODE_W / 2;

            const isWrap = Math.abs(toIndex - fromIndex) > 1;

            if (!isWrap) {
                frontBadgeX = fromX;
                frontAnimating = true;
                animatingFrontTo = toIndex;

                const start = performance.now();
                const duration = 350;

                function step(now) {
                    const t = Math.min((now - start) / duration, 1);
                    const eased = 1 - Math.pow(1 - t, 3);
                    frontBadgeX = fromX + (toX - fromX) * eased;

                    if (t < 1) {
                        requestAnimationFrame(step);
                    } else {
                        frontBadgeX = null;
                        frontAnimating = false;
                        animatingFrontTo = null;
                    }
                }
                requestAnimationFrame(step);
            }
        }

        prevFrontPtr = currentFront;
        prevRearPtr = currentRear;
        prevSize = currentSize;
    });

    $effect(() => {
        const capacity = $queueCapacity;
        const slots = $queueSlots;
        const isFreshQueue =
            slots.length === capacity && slots.every((slot) => slot === null);

        if (isFreshQueue) {
            // No-op
        }

        if (
            capacity > 0 &&
            svgEl &&
            (!initialized || (isFreshQueue && slots !== centeredSlotsRef))
        ) {
            requestAnimationFrame(() => {
                if (!svgEl || $queueCapacity === 0) return;
                centerQueue();
                initialized = true;
                centeredSlotsRef = slots;
            });
        }

        if (capacity === 0) {
            initialized = false;
            centeredSlotsRef = null;
        }
    });

    function centerQueue() {
        if (!svgEl) return;
        const rect = svgEl.getBoundingClientRect();
        const queueW = $queueCapacity * (NODE_W + NODE_GAP) - NODE_GAP;
        panX = (rect.width - queueW) / 2 - CANVAS_PAD_X;
        panY = (rect.height - NODE_H) / 2 - SLOT_Y;
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

    /** @type {{ x: number, y: number, type: 'canvas'|'slot', slotIndex?: number }|null} */
    let contextMenu = $state(null);

    function onSVGContextMenu(e) {
        e.preventDefault();
        contextMenu = { x: e.clientX, y: e.clientY, type: "canvas" };
    }

    function onSlotContextMenu(e, index) {
        e.preventDefault();
        e.stopPropagation();
        contextMenu = {
            x: e.clientX,
            y: e.clientY,
            type: "slot",
            slotIndex: index,
        };
    }

    function closeContextMenu() {
        contextMenu = null;
    }

    function handleEnqueueFromMenu() {
        closeContextMenu();
        window.dispatchEvent(new CustomEvent("queue:enqueue"));
    }

    function handleDequeueFromMenu() {
        closeContextMenu();
        window.dispatchEvent(new CustomEvent("queue:dequeue"));
    }

    function handlePeekFromMenu() {
        peekingIndex = $frontPtr;
        peekQueue();
        setTimeout(() => {
            peekingIndex = null;
        }, 1500);
        closeContextMenu();
    }

    function getSlotX(index) {
        return CANVAS_PAD_X + index * (NODE_W + NODE_GAP);
    }

    function isFrontSlot(index) {
        return index === $frontPtr && $queueSize > 0;
    }

    function isActiveSlot(index) {
        const size = $queueSize;
        const capacity = $queueCapacity;
        if (size === 0 || capacity === 0) return false;
        if (size >= capacity) return true;

        const distanceFromFront = (index - $frontPtr + capacity) % capacity;
        return distanceFromFront < size;
    }

    function isRearSlot(index) {
        return (
            index === ($rearPtr === 0 ? $queueCapacity - 1 : $rearPtr - 1) &&
            $queueSize > 0
        );
    }

    const SLOT_Y = CANVAS_PAD_Y;
</script>

<svelte:window onmousemove={onWindowMousemove} onmouseup={onWindowMouseup} />

<div class="canvas-wrapper">
    {#if $queueCapacity === 0}
        <div class="empty-hint">
            <div class="empty-title">Queue not initialized</div>
            <div class="empty-sub">
                Click <strong>New Queue</strong> to get started
            </div>
        </div>
    {:else}
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
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
                    id="grid-queue"
                    width="28"
                    height="28"
                    patternUnits="userSpaceOnUse"
                >
                    <circle cx="14" cy="14" r="0.8" fill="var(--border)" />
                </pattern>
            </defs>

            <rect width="100%" height="100%" fill="url(#grid-queue)" />

            <g
                style="transform: translate({panX}px, {panY}px) scale({zoom}); transform-origin: 0 0;"
            >
                <!-- Panah DEQUEUE di kiri (elemen keluar dari FRONT) -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <!-- Dequeue & Peek di kiri (stacked) -->
                <g
                    class="queue-action-button accent"
                    class:disabled={$queueIsEmpty}
                    role="button"
                    tabindex={$queueIsEmpty ? -1 : 0}
                    aria-label="Dequeue"
                    aria-disabled={$queueIsEmpty}
                    onclick={(e) => {
                        e.stopPropagation();
                        if (!$queueIsEmpty) handleDequeueFromMenu();
                    }}
                    onkeydown={(e) => {
                        if (e.key !== "Enter" && e.key !== " ") return;
                        e.preventDefault();
                        e.stopPropagation();
                        if (!$queueIsEmpty) handleDequeueFromMenu();
                    }}
                    onmousedown={(e) => e.stopPropagation()}
                >
                    <rect
                        x={CANVAS_PAD_X - 24 - ARROW_OFFSET - ARROW_SIZE / 2 - 29}
                        y={SLOT_Y + NODE_H / 2 - 40}
                        width="58"
                        height="34"
                        rx="5"
                    />
                    <text
                        x={CANVAS_PAD_X - 24 - ARROW_OFFSET - ARROW_SIZE / 2}
                        y={SLOT_Y + NODE_H / 2 - 24}
                        text-anchor="middle"
                        font-family="var(--font-mono)"
                        font-size="9"
                        fill="var(--accent)"
                        font-weight="600">Dequeue</text
                    >
                    <!-- Garis dari bracket kiri ke ujung kiri -->
                    <line
                        x1={CANVAS_PAD_X - 24 - ARROW_OFFSET}
                        y1={SLOT_Y + NODE_H / 2 - 15}
                        x2={CANVAS_PAD_X - 24 - ARROW_OFFSET - ARROW_SIZE}
                        y2={SLOT_Y + NODE_H / 2 - 15}
                        stroke="var(--accent)"
                        stroke-width="1.8"
                    />
                    <!-- Arrowhead mengarah ke kiri -->
                    <polygon
                        points="
      {CANVAS_PAD_X - 24 - ARROW_OFFSET - ARROW_SIZE},{SLOT_Y + NODE_H / 2 - 19}
      {CANVAS_PAD_X - 24 - ARROW_OFFSET - ARROW_SIZE - 6},{SLOT_Y + NODE_H / 2 - 15}
      {CANVAS_PAD_X - 24 - ARROW_OFFSET - ARROW_SIZE},{SLOT_Y + NODE_H / 2 - 11}
    "
                        fill="var(--accent)"
                    />
                </g>

                <g
                    class="queue-action-button accent"
                    class:disabled={$queueIsEmpty}
                    role="button"
                    tabindex={$queueIsEmpty ? -1 : 0}
                    aria-label="Peek"
                    aria-disabled={$queueIsEmpty}
                    onclick={(e) => {
                        e.stopPropagation();
                        if (!$queueIsEmpty) handlePeekFromMenu();
                    }}
                    onkeydown={(e) => {
                        if (e.key !== "Enter" && e.key !== " ") return;
                        e.preventDefault();
                        e.stopPropagation();
                        if (!$queueIsEmpty) handlePeekFromMenu();
                    }}
                    onmousedown={(e) => e.stopPropagation()}
                >
                    <rect
                        x={CANVAS_PAD_X - 24 - ARROW_OFFSET - ARROW_SIZE / 2 - 29}
                        y={SLOT_Y + NODE_H / 2 + 6}
                        width="58"
                        height="34"
                        rx="5"
                    />
                    <text
                        x={CANVAS_PAD_X - 24 - ARROW_OFFSET - ARROW_SIZE / 2}
                        y={SLOT_Y + NODE_H / 2 + 27}
                        text-anchor="middle"
                        font-family="var(--font-mono)"
                        font-size="9"
                        fill="var(--accent)"
                        font-weight="600">Peek</text
                    >
                </g>

                <!-- Array bracket kiri -->
                <path
                    d="M {CANVAS_PAD_X - 16} {SLOT_Y - 4}
       L {CANVAS_PAD_X - 24} {SLOT_Y - 4}
       L {CANVAS_PAD_X - 24} {SLOT_Y + NODE_H + 4}
       L {CANVAS_PAD_X - 16} {SLOT_Y + NODE_H + 4}"
                    fill="none"
                    stroke="var(--border-bright)"
                    stroke-width="2"
                    stroke-linecap="round"
                />

                <!-- Slots -->
                {#each $queueSlots as slot, index}
                    {@const x = getSlotX(index)}
                    {@const isActive = isActiveSlot(index)}
                    {@const isFront = isFrontSlot(index) && !frontAnimating}
                    {@const isRear = isRearSlot(index) && !rearAnimating}
                    {@const isPeeking = peekingIndex === index}
                    {@const isEmpty = slot === null}
                    {@const isDequeued = slot !== null && !isActive}
                    {@const isAnimIn = animatingEnqueueIndex === index}
                    {@const isAnimOut = animatingDequeueIndex === index}

                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <g
                        class="slot-group"
                        class:anim-in={isAnimIn}
                        class:anim-out={isAnimOut}
                        oncontextmenu={(e) => onSlotContextMenu(e, index)}
                    >
                        <rect
                            {x}
                            y={SLOT_Y}
                            width={NODE_W}
                            height={NODE_H}
                            rx="6"
                            fill={isEmpty || isDequeued
                                ? "var(--surface)"
                                : "var(--node-bg)"}
                            stroke={isPeeking
                                ? "var(--warning)"
                                : isFront
                                  ? "var(--success)"
                                  : isRear
                                    ? "#c084fc"
                                    : isEmpty || isDequeued
                                      ? "var(--border)"
                                      : "var(--node-border)"}
                            stroke-width={isPeeking || isFront || isRear
                                ? 1.8
                                : 1}
                            stroke-dasharray={isEmpty || isDequeued
                                ? "4 3"
                                : "none"}
                        />

                        {#if !isEmpty && !isDequeued && (isFront || isRear) && !isPeeking}
                            <rect
                                x={x + 1}
                                y={SLOT_Y + 1}
                                width={NODE_W - 2}
                                height="3"
                                rx="2"
                                fill={isFront ? "var(--success)" : "#c084fc"}
                                opacity="0.8"
                            />
                        {/if}

                        {#if isPeeking}
                            <rect
                                x={x + 1}
                                y={SLOT_Y + 1}
                                width={NODE_W - 2}
                                height="3"
                                rx="2"
                                fill="var(--warning)"
                                opacity="0.8"
                            />
                        {/if}

                        <text
                            x={x + NODE_W / 2}
                            y={SLOT_Y + NODE_H / 2 + 5}
                            text-anchor="middle"
                            font-family="var(--font-mono)"
                            font-size="14"
                            fill={isEmpty || isDequeued || isAnimIn
                                ? "var(--text-muted)"
                                : "var(--text)"}
                            font-weight={isEmpty || isDequeued || isAnimIn ? "400" : "500"}
                            >{isEmpty || isAnimIn ? "null" : slot.value}</text
                        >

                        <text
                            x={x + NODE_W / 2}
                            y={SLOT_Y + NODE_H + 16}
                            text-anchor="middle"
                            font-family="var(--font-mono)"
                            font-size="10"
                            fill="var(--text-muted)">{index}</text
                        >

                        <!-- FRONT badge -->
                        {#if isFront && !isRear}
                            <rect
                                x={x + NODE_W / 2 - 22}
                                y={SLOT_Y - 28}
                                width="44"
                                height="20"
                                rx="5"
                                fill="rgba(78,204,163,0.15)"
                                stroke="var(--success)"
                                stroke-width="1.2"
                            />
                            <text
                                x={x + NODE_W / 2}
                                y={SLOT_Y - 13}
                                text-anchor="middle"
                                font-family="var(--font-mono)"
                                font-size="9"
                                font-weight="700"
                                fill="var(--success)"
                                letter-spacing="0.8">FRONT</text
                            >
                            <line
                                x1={x + NODE_W / 2}
                                y1={SLOT_Y - 8}
                                x2={x + NODE_W / 2}
                                y2={SLOT_Y - 2}
                                stroke="var(--success)"
                                stroke-width="1.5"
                            />
                            <polygon
                                points="{x + NODE_W / 2 - 4},{SLOT_Y - 4} {x +
                                    NODE_W / 2 +
                                    4},{SLOT_Y - 4} {x + NODE_W / 2},{SLOT_Y}"
                                fill="var(--success)"
                            />
                        {/if}

                        <!-- REAR badge -->
                        {#if isRear && !isFront}
                            <rect
                                x={x + NODE_W / 2 - 20}
                                y={SLOT_Y - 28}
                                width="40"
                                height="20"
                                rx="5"
                                fill="rgba(192,132,252,0.15)"
                                stroke="#c084fc"
                                stroke-width="1.2"
                            />
                            <text
                                x={x + NODE_W / 2}
                                y={SLOT_Y - 13}
                                text-anchor="middle"
                                font-family="var(--font-mono)"
                                font-size="9"
                                font-weight="700"
                                fill="#c084fc"
                                letter-spacing="0.8">REAR</text
                            >
                            <line
                                x1={x + NODE_W / 2}
                                y1={SLOT_Y - 8}
                                x2={x + NODE_W / 2}
                                y2={SLOT_Y - 2}
                                stroke="#c084fc"
                                stroke-width="1.5"
                            />
                            <polygon
                                points="{x + NODE_W / 2 - 4},{SLOT_Y - 4} {x +
                                    NODE_W / 2 +
                                    4},{SLOT_Y - 4} {x + NODE_W / 2},{SLOT_Y}"
                                fill="#c084fc"
                            />
                        {/if}

                        <!-- FRONT dan REAR bertumpuk kalau sama -->
                        {#if isFront && isRear}
                            <rect
                                x={x + NODE_W / 2 - 20}
                                y={SLOT_Y - 52}
                                width="40"
                                height="20"
                                rx="5"
                                fill="rgba(192,132,252,0.15)"
                                stroke="#c084fc"
                                stroke-width="1.2"
                            />
                            <text
                                x={x + NODE_W / 2}
                                y={SLOT_Y - 37}
                                text-anchor="middle"
                                font-family="var(--font-mono)"
                                font-size="9"
                                font-weight="700"
                                fill="#c084fc"
                                letter-spacing="0.8">REAR</text
                            >
                            <line
                                x1={x + NODE_W / 2}
                                y1={SLOT_Y - 32}
                                x2={x + NODE_W / 2}
                                y2={SLOT_Y - 28}
                                stroke="#c084fc"
                                stroke-width="1.5"
                            />

                            <rect
                                x={x + NODE_W / 2 - 22}
                                y={SLOT_Y - 28}
                                width="44"
                                height="20"
                                rx="5"
                                fill="rgba(78,204,163,0.15)"
                                stroke="var(--success)"
                                stroke-width="1.2"
                            />
                            <text
                                x={x + NODE_W / 2}
                                y={SLOT_Y - 13}
                                text-anchor="middle"
                                font-family="var(--font-mono)"
                                font-size="9"
                                font-weight="700"
                                fill="var(--success)"
                                letter-spacing="0.8">FRONT</text
                            >
                            <line
                                x1={x + NODE_W / 2}
                                y1={SLOT_Y - 8}
                                x2={x + NODE_W / 2}
                                y2={SLOT_Y - 2}
                                stroke="var(--success)"
                                stroke-width="1.5"
                            />
                            <polygon
                                points="{x + NODE_W / 2 - 4},{SLOT_Y - 4} {x +
                                    NODE_W / 2 +
                                    4},{SLOT_Y - 4} {x + NODE_W / 2},{SLOT_Y}"
                                fill="var(--success)"
                            />
                        {/if}
                    </g>
                {/each}

                <!-- Animated FRONT pointer -->
                {#if frontAnimating && frontBadgeX !== null}
                    <rect
                        x={frontBadgeX - 22}
                        y={SLOT_Y - 28}
                        width="44"
                        height="20"
                        rx="5"
                        fill="rgba(78,204,163,0.15)"
                        stroke="var(--success)"
                        stroke-width="1.2"
                    />
                    <text
                        x={frontBadgeX}
                        y={SLOT_Y - 13}
                        text-anchor="middle"
                        font-family="var(--font-mono)"
                        font-size="9"
                        font-weight="700"
                        fill="var(--success)"
                        letter-spacing="0.8">FRONT</text
                    >
                    <line
                        x1={frontBadgeX}
                        y1={SLOT_Y - 8}
                        x2={frontBadgeX}
                        y2={SLOT_Y - 2}
                        stroke="var(--success)"
                        stroke-width="1.5"
                    />
                    <polygon
                        points="{frontBadgeX - 4},{SLOT_Y - 4} {frontBadgeX +
                            4},{SLOT_Y - 4} {frontBadgeX},{SLOT_Y}"
                        fill="var(--success)"
                    />
                {/if}

                <!-- Animated REAR pointer -->
                {#if rearAnimating && rearBadgeX !== null}
                    <rect
                        x={rearBadgeX - 20}
                        y={SLOT_Y - 28}
                        width="40"
                        height="20"
                        rx="5"
                        fill="rgba(192,132,252,0.15)"
                        stroke="#c084fc"
                        stroke-width="1.2"
                    />
                    <text
                        x={rearBadgeX}
                        y={SLOT_Y - 13}
                        text-anchor="middle"
                        font-family="var(--font-mono)"
                        font-size="9"
                        font-weight="700"
                        fill="#c084fc"
                        letter-spacing="0.8">REAR</text
                    >
                    <line
                        x1={rearBadgeX}
                        y1={SLOT_Y - 8}
                        x2={rearBadgeX}
                        y2={SLOT_Y - 2}
                        stroke="#c084fc"
                        stroke-width="1.5"
                    />
                    <polygon
                        points="{rearBadgeX - 4},{SLOT_Y - 4} {rearBadgeX +
                            4},{SLOT_Y - 4} {rearBadgeX},{SLOT_Y}"
                        fill="#c084fc"
                    />
                {/if}

                <!-- Array bracket kanan -->
                <path
                    d="M {CANVAS_PAD_X + totalW + 16} {SLOT_Y - 4}
       L {CANVAS_PAD_X + totalW + 24} {SLOT_Y - 4}
       L {CANVAS_PAD_X + totalW + 24} {SLOT_Y + NODE_H + 4}
       L {CANVAS_PAD_X + totalW + 16} {SLOT_Y + NODE_H + 4}"
                    fill="none"
                    stroke="var(--border-bright)"
                    stroke-width="2"
                    stroke-linecap="round"
                />

                <!-- Panah ENQUEUE di kanan (elemen masuk dari REAR) -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <g
                    class="queue-action-button accent"
                    class:disabled={$queueIsFull}
                    role="button"
                    tabindex={$queueIsFull ? -1 : 0}
                    aria-label="Enqueue"
                    aria-disabled={$queueIsFull}
                    onclick={(e) => {
                        e.stopPropagation();
                        if (!$queueIsFull) handleEnqueueFromMenu();
                    }}
                    onkeydown={(e) => {
                        if (e.key !== "Enter" && e.key !== " ") return;
                        e.preventDefault();
                        e.stopPropagation();
                        if (!$queueIsFull) handleEnqueueFromMenu();
                    }}
                    onmousedown={(e) => e.stopPropagation()}
                >
                    <rect
                        x={CANVAS_PAD_X +
                            totalW +
                            24 +
                            ARROW_OFFSET +
                            ARROW_SIZE / 2 -
                            29}
                        y={SLOT_Y + NODE_H / 2 - 17}
                        width="58"
                        height="34"
                        rx="5"
                    />
                    <text
                        x={CANVAS_PAD_X +
                            totalW +
                            24 +
                            ARROW_OFFSET +
                            ARROW_SIZE / 2}
                        y={SLOT_Y + NODE_H / 2 - 1}
                        text-anchor="middle"
                        font-family="var(--font-mono)"
                        font-size="9"
                        fill="var(--accent)"
                        font-weight="600">Enqueue</text
                    >
                    <line
                        x1={CANVAS_PAD_X +
                            totalW +
                            24 +
                            ARROW_OFFSET +
                            ARROW_SIZE}
                        y1={SLOT_Y + NODE_H / 2 + 8}
                        x2={CANVAS_PAD_X + totalW + 24 + ARROW_OFFSET}
                        y2={SLOT_Y + NODE_H / 2 + 8}
                        stroke="var(--accent)"
                        stroke-width="1.8"
                    />
                    <polygon
                        points="
      {CANVAS_PAD_X + totalW + 24 + ARROW_OFFSET + 6},{SLOT_Y + NODE_H / 2 + 4}
      {CANVAS_PAD_X + totalW + 24 + ARROW_OFFSET},{SLOT_Y + NODE_H / 2 + 8}
      {CANVAS_PAD_X + totalW + 24 + ARROW_OFFSET + 6},{SLOT_Y + NODE_H / 2 + 12}
    "
                        fill="var(--accent)"
                    />
                </g>

                <!-- Queue state indicator -->
                {#if $queueIsFull || $queueIsEmpty}
                    <text
                        x={CANVAS_PAD_X + totalW / 2}
                        y={SLOT_Y + NODE_H + 46}
                        text-anchor="middle"
                        font-family="var(--font-mono)"
                        font-size="10"
                        fill={$queueIsFull ? "var(--danger)" : "var(--accent)"}
                        font-weight="600"
                        >{$queueIsFull ? "QUEUE FULL" : "QUEUE EMPTY"}</text
                    >
                {/if}

                <!-- Element yang sedang di-dequeue (animasi terbang) -->
                {#if animatingDequeue}
                    <g
                        style="transform: translate({animatingDequeue.x}px, {animatingDequeue.y}px);"
                    >
                        <rect
                            x={0}
                            y={0}
                            width={NODE_W}
                            height={NODE_H}
                            rx="6"
                            fill="var(--node-bg)"
                            stroke="var(--success)"
                            stroke-width="1.8"
                            style="opacity: {animatingDequeue.opacity}"
                        />
                        <text
                            x={NODE_W / 2}
                            y={NODE_H / 2 + 5}
                            text-anchor="middle"
                            font-family="var(--font-mono)"
                            font-size="14"
                            fill="var(--text)"
                            font-weight="600"
                            style="opacity: {animatingDequeue.opacity}">{animatingDequeue.value}</text
                        >
                    </g>
                {/if}

                <!-- Element yang sedang di-enqueue (animasi terbang) -->
                {#if animatingEnqueue}
                    <g
                        style="transform: translate({animatingEnqueue.x}px, {animatingEnqueue.y}px);"
                    >
                        <rect
                            x={0}
                            y={0}
                            width={NODE_W}
                            height={NODE_H}
                            rx="6"
                            fill="var(--node-bg)"
                            stroke="#c084fc"
                            stroke-width="1.8"
                        />
                        <text
                            x={NODE_W / 2}
                            y={NODE_H / 2 + 5}
                            text-anchor="middle"
                            font-family="var(--font-mono)"
                            font-size="14"
                            fill="var(--text)"
                            font-weight="600">{animatingEnqueue.value}</text
                        >
                    </g>
                {/if}
            </g>
        </svg>

        <!-- Context menu -->
        {#if contextMenu}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
                class="ctx-menu"
                style="left: {contextMenu.x}px; top: {contextMenu.y}px;"
                onmousedown={(e) => e.stopPropagation()}
            >
                <button
                    class="ctx-item"
                    onclick={handleEnqueueFromMenu}
                    disabled={$queueIsFull}
                >
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                        <path
                            d="M4 6.5h5M6.5 4l-2.5 2.5 2.5 2.5"
                            stroke="currentColor"
                            stroke-width="1.3"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        />
                    </svg>
                    Enqueue
                </button>
                <button
                    class="ctx-item"
                    onclick={handleDequeueFromMenu}
                    disabled={$queueIsEmpty}
                >
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                        <path
                            d="M4 6.5h5M6.5 4l-2.5 2.5 2.5 2.5"
                            stroke="currentColor"
                            stroke-width="1.3"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        />
                    </svg>
                    Dequeue
                </button>
                <div class="ctx-divider"></div>
                <button
                    class="ctx-item"
                    onclick={handlePeekFromMenu}
                    disabled={$queueIsEmpty}
                >
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                        <circle
                            cx="6.5"
                            cy="6.5"
                            r="4"
                            stroke="currentColor"
                            stroke-width="1.3"
                        />
                        <circle cx="6.5" cy="6.5" r="1.5" fill="currentColor" />
                    </svg>
                    Peek
                </button>
            </div>
        {/if}
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
    .queue-action-button {
        cursor: pointer;
        outline: none;
    }
    .queue-action-button rect {
        fill: color-mix(in srgb, var(--surface2) 72%, transparent);
        stroke-width: 1;
        transition:
            fill 0.12s,
            stroke 0.12s,
            opacity 0.12s;
    }
    .queue-action-button.accent rect {
        stroke: color-mix(in srgb, var(--accent) 55%, transparent);
    }
    .queue-action-button.secondary rect {
        stroke: color-mix(in srgb, var(--border-bright) 70%, transparent);
    }
    .queue-action-button:hover:not(.disabled) rect,
    .queue-action-button:focus-visible rect {
        fill: var(--surface2);
        stroke-width: 1.3;
    }
    .queue-action-button text,
    .queue-action-button circle,
    .queue-action-button line,
    .queue-action-button polygon {
        pointer-events: none;
    }
    .queue-action-button.disabled {
        cursor: not-allowed;
        opacity: 0.4;
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
</style>
