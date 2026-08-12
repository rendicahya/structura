<script>
    import { untrack, onMount } from "svelte";
    import { SvelteFlow, Background } from "@xyflow/svelte";
    import "@xyflow/svelte/dist/style.css";
    import QueueFlowNode from "../node/QueueFlowNode.svelte";
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
    import { ZOOM_MIN, ZOOM_MAX } from "../../utils/canvasConstants.js";

    const NODE_W = 80;
    const NODE_H = 70;
    const NODE_GAP = 4;
    const CANVAS_PAD_X = 60;
    const CANVAS_PAD_Y = 80;
    const ARROW_SIZE = 40;
    const ARROW_OFFSET = 16;
    const SLOT_Y = CANVAS_PAD_Y;

    let { zoom = $bindable(1) } = $props();

    const nodeTypes = { queue: QueueFlowNode };

    /** @type {HTMLDivElement} */
    let wrapperEl = $state();

    let viewport = $state({ x: 0, y: 0, zoom: 1 });
    let initialized = false;
    let centeredSlotsRef = null;
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
    let peekingIndex = $state(null);
    let animatingEnqueueIndex = $state(null);
    let animatingEnqueue = $state(null);
    let animatingDequeue = $state(null);

    let totalW = $derived($queueCapacity * (NODE_W + NODE_GAP) - NODE_GAP);

    let frontBadgeX = $state(null);
    let frontAnimating = $state(false);

    let rearBadgeX = $state(null);
    let rearAnimating = $state(false);

    let prevFrontPtr = $state(-1);
    let prevRearPtr = $state(-1);
    let prevSize = $state(-1);

    /** @type {{ x: number, y: number, type: 'canvas'|'slot', slotIndex?: number }|null} */
    let contextMenu = $state(null);

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

    function getSlotX(index) {
        return CANVAS_PAD_X + index * (NODE_W + NODE_GAP);
    }

    function isActiveSlot(index) {
        const size = $queueSize;
        const capacity = $queueCapacity;
        if (size === 0 || capacity === 0) return false;
        if (size >= capacity) return true;

        const distanceFromFront = (index - $frontPtr + capacity) % capacity;
        return distanceFromFront < size;
    }

    // Enqueue slide-in / dequeue fly-out / FRONT-REAR badge-slide animations,
    // ported verbatim from CanvasQueue.svelte's effect (index math unchanged,
    // only panX/panY -> viewport.x/y for the transform wrapper).
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

        if (currentSize > prevSize && cap > 0) {
            const targetIndex = currentRear;
            const newValue = slots[targetIndex]?.value;
            if (newValue !== undefined) {
                const targetX = getSlotX(targetIndex);
                const targetY = SLOT_Y;
                const startX =
                    CANVAS_PAD_X + totalW + 24 + ARROW_OFFSET + ARROW_SIZE / 2;
                const startY = SLOT_Y;

                animatingEnqueue = { value: newValue, x: startX, y: startY, opacity: 1 };
                animatingEnqueueIndex = targetIndex;

                const start = performance.now();
                const duration = 500;

                function step(now) {
                    const t = Math.min((now - start) / duration, 1);
                    const eased = 1 - Math.pow(1 - t, 3);

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

        if (currentSize < prevSize && prevSize > 0) {
            const dequeuedValue = slots[prevFrontPtr]?.value ?? null;
            if (dequeuedValue !== null) {
                const startX = getSlotX(prevFrontPtr);
                const startY = SLOT_Y;
                const targetX = CANVAS_PAD_X - 24 - ARROW_OFFSET - ARROW_SIZE / 2 - 100;
                const targetY = SLOT_Y;

                animatingDequeue = { value: dequeuedValue, x: startX, y: startY, opacity: 1 };

                const start = performance.now();
                const duration = 450;

                function step(now) {
                    const t = Math.min((now - start) / duration, 1);
                    const eased = 1 - Math.pow(1 - t, 3);

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

        if (currentSize > prevSize && currentSize > 1 && cap > 0) {
            const fromIndex = prevRearPtr;
            const toIndex = currentRear;
            const fromX = getSlotX(fromIndex) + NODE_W / 2;
            const toX = getSlotX(toIndex) + NODE_W / 2;
            const isWrap = Math.abs(toIndex - fromIndex) > 1;

            if (!isWrap) {
                rearBadgeX = fromX;
                rearAnimating = true;

                const start = performance.now();
                const duration = 350;

                function step(now) {
                    const t = Math.min((now - start) / duration, 1);
                    const eased = 1 - Math.pow(1 - t, 3);
                    rearBadgeX = fromX + (toX - fromX) * eased;

                    if (t < 1) {
                        requestAnimationFrame(step);
                    } else {
                        rearBadgeX = null;
                        rearAnimating = false;
                    }
                }
                requestAnimationFrame(step);
            }
        }

        if (currentSize < prevSize && prevSize > 1 && currentSize > 0 && cap > 0) {
            const fromIndex = prevFrontPtr;
            const toIndex = currentFront;
            const fromX = getSlotX(fromIndex) + NODE_W / 2;
            const toX = getSlotX(toIndex) + NODE_W / 2;
            const isWrap = Math.abs(toIndex - fromIndex) > 1;

            if (!isWrap) {
                frontBadgeX = fromX;
                frontAnimating = true;

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

        if (
            capacity > 0 &&
            wrapperEl &&
            (!initialized || (isFreshQueue && slots !== centeredSlotsRef))
        ) {
            requestAnimationFrame(() => {
                if (!wrapperEl || $queueCapacity === 0) return;
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
        if (!wrapperEl) return;
        const rect = wrapperEl.getBoundingClientRect();
        const queueW = $queueCapacity * (NODE_W + NODE_GAP) - NODE_GAP;
        viewport = {
            ...viewport,
            x: (rect.width - queueW) / 2 - CANVAS_PAD_X,
            y: (rect.height - NODE_H) / 2 - SLOT_Y,
        };
        flowGen++;
    }

    let flowNodes = $derived(
        Array.from({ length: $queueCapacity }, (_, index) => {
            const slot = $queueSlots[index];
            const active = isActiveSlot(index);
            return {
                id: `slot-${index}`,
                type: "queue",
                position: { x: getSlotX(index), y: SLOT_Y },
                draggable: false,
                selectable: false,
                connectable: false,
                data: {
                    index,
                    value: slot?.value ?? null,
                    isEmpty: slot === null,
                    isDequeued: slot !== null && !active,
                    isFront: index === $frontPtr && $queueSize > 0 && !frontAnimating,
                    isRear: index === $rearPtr && $queueSize > 0 && !rearAnimating,
                    isPeeking: peekingIndex === index,
                    isAnimIn: animatingEnqueueIndex === index,
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
        const index = Number(node.id.replace("slot-", ""));
        contextMenu = { x: event.clientX, y: event.clientY, type: "slot", slotIndex: index };
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

    onMount(() => {
        const onPeek = () => {
            peekingIndex = $frontPtr;
            setTimeout(() => {
                peekingIndex = null;
            }, 1500);
        };
        window.addEventListener("queue:peek", onPeek);
        return () => {
            window.removeEventListener("queue:peek", onPeek);
        };
    });
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
        </SvelteFlow>
    {/key}

    {#if $queueCapacity > 0}
        <svg class="queue-decor">
            <g
                style="transform: translate({viewport.x}px, {viewport.y}px) scale({viewport.zoom}); transform-origin: 0 0;"
            >
                <!-- Dequeue & Peek buttons (left) -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
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
                    <title>Dequeue front element (M)</title>
                    <rect
                        x={CANVAS_PAD_X - 24 - ARROW_OFFSET - ARROW_SIZE / 2 - 45}
                        y={SLOT_Y + NODE_H / 2 - 38}
                        width="58"
                        height="34"
                        rx="5"
                    />
                    <text
                        x={CANVAS_PAD_X - 24 - ARROW_OFFSET - ARROW_SIZE / 2 - 16}
                        y={SLOT_Y + NODE_H / 2 - 22}
                        text-anchor="middle"
                        font-family="var(--font-mono)"
                        font-size="9"
                        fill="var(--accent)"
                        font-weight="600">Dequeue</text
                    >
                    <line
                        x1={CANVAS_PAD_X - 24 - ARROW_OFFSET - 16}
                        y1={SLOT_Y + NODE_H / 2 - 13}
                        x2={CANVAS_PAD_X - 24 - ARROW_OFFSET - ARROW_SIZE - 16}
                        y2={SLOT_Y + NODE_H / 2 - 13}
                        stroke="var(--accent)"
                        stroke-width="1.8"
                    />
                    <polygon
                        points="
      {CANVAS_PAD_X - 24 - ARROW_OFFSET - ARROW_SIZE - 16},{SLOT_Y + NODE_H / 2 - 17}
      {CANVAS_PAD_X - 24 - ARROW_OFFSET - ARROW_SIZE - 6 - 16},{SLOT_Y + NODE_H / 2 - 13}
      {CANVAS_PAD_X - 24 - ARROW_OFFSET - ARROW_SIZE - 16},{SLOT_Y + NODE_H / 2 - 9}
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
                        x={CANVAS_PAD_X - 24 - ARROW_OFFSET - ARROW_SIZE / 2 - 45}
                        y={SLOT_Y + NODE_H / 2 + 2}
                        width="58"
                        height="34"
                        rx="5"
                    />
                    <text
                        x={CANVAS_PAD_X - 24 - ARROW_OFFSET - ARROW_SIZE / 2 - 16}
                        y={SLOT_Y + NODE_H / 2 + 22}
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

                <!-- FRONT / REAR badges -->
                {#if $queueSize > 0 && !frontAnimating && !rearAnimating && $frontPtr === $rearPtr}
                    {@const x = getSlotX($frontPtr)}
                    <rect x={x + NODE_W / 2 - 20} y={SLOT_Y - 52} width="40" height="20" rx="5" fill="rgba(192,132,252,0.15)" stroke="#c084fc" stroke-width="1.2" />
                    <text x={x + NODE_W / 2} y={SLOT_Y - 37} text-anchor="middle" font-family="var(--font-mono)" font-size="9" font-weight="700" fill="#c084fc" letter-spacing="0.8">REAR</text>
                    <line x1={x + NODE_W / 2} y1={SLOT_Y - 32} x2={x + NODE_W / 2} y2={SLOT_Y - 28} stroke="#c084fc" stroke-width="1.5" />

                    <rect x={x + NODE_W / 2 - 22} y={SLOT_Y - 28} width="44" height="20" rx="5" fill="rgba(78,204,163,0.15)" stroke="var(--success)" stroke-width="1.2" />
                    <text x={x + NODE_W / 2} y={SLOT_Y - 13} text-anchor="middle" font-family="var(--font-mono)" font-size="9" font-weight="700" fill="var(--success)" letter-spacing="0.8">FRONT</text>
                    <line x1={x + NODE_W / 2} y1={SLOT_Y - 8} x2={x + NODE_W / 2} y2={SLOT_Y - 2} stroke="var(--success)" stroke-width="1.5" />
                    <polygon points="{x + NODE_W / 2 - 4},{SLOT_Y - 4} {x + NODE_W / 2 + 4},{SLOT_Y - 4} {x + NODE_W / 2},{SLOT_Y}" fill="var(--success)" />
                {:else}
                    {#if $queueSize > 0 && !frontAnimating}
                        {@const x = getSlotX($frontPtr)}
                        <rect x={x + NODE_W / 2 - 22} y={SLOT_Y - 28} width="44" height="20" rx="5" fill="rgba(78,204,163,0.15)" stroke="var(--success)" stroke-width="1.2" />
                        <text x={x + NODE_W / 2} y={SLOT_Y - 13} text-anchor="middle" font-family="var(--font-mono)" font-size="9" font-weight="700" fill="var(--success)" letter-spacing="0.8">FRONT</text>
                        <line x1={x + NODE_W / 2} y1={SLOT_Y - 8} x2={x + NODE_W / 2} y2={SLOT_Y - 2} stroke="var(--success)" stroke-width="1.5" />
                        <polygon points="{x + NODE_W / 2 - 4},{SLOT_Y - 4} {x + NODE_W / 2 + 4},{SLOT_Y - 4} {x + NODE_W / 2},{SLOT_Y}" fill="var(--success)" />
                    {/if}
                    {#if $queueSize > 0 && !rearAnimating}
                        {@const x = getSlotX($rearPtr)}
                        <rect x={x + NODE_W / 2 - 20} y={SLOT_Y - 28} width="40" height="20" rx="5" fill="rgba(192,132,252,0.15)" stroke="#c084fc" stroke-width="1.2" />
                        <text x={x + NODE_W / 2} y={SLOT_Y - 13} text-anchor="middle" font-family="var(--font-mono)" font-size="9" font-weight="700" fill="#c084fc" letter-spacing="0.8">REAR</text>
                        <line x1={x + NODE_W / 2} y1={SLOT_Y - 8} x2={x + NODE_W / 2} y2={SLOT_Y - 2} stroke="#c084fc" stroke-width="1.5" />
                        <polygon points="{x + NODE_W / 2 - 4},{SLOT_Y - 4} {x + NODE_W / 2 + 4},{SLOT_Y - 4} {x + NODE_W / 2},{SLOT_Y}" fill="#c084fc" />
                    {/if}
                {/if}

                <!-- Animated FRONT pointer -->
                {#if frontAnimating && frontBadgeX !== null}
                    <rect x={frontBadgeX - 22} y={SLOT_Y - 28} width="44" height="20" rx="5" fill="rgba(78,204,163,0.15)" stroke="var(--success)" stroke-width="1.2" />
                    <text x={frontBadgeX} y={SLOT_Y - 13} text-anchor="middle" font-family="var(--font-mono)" font-size="9" font-weight="700" fill="var(--success)" letter-spacing="0.8">FRONT</text>
                    <line x1={frontBadgeX} y1={SLOT_Y - 8} x2={frontBadgeX} y2={SLOT_Y - 2} stroke="var(--success)" stroke-width="1.5" />
                    <polygon points="{frontBadgeX - 4},{SLOT_Y - 4} {frontBadgeX + 4},{SLOT_Y - 4} {frontBadgeX},{SLOT_Y}" fill="var(--success)" />
                {/if}

                <!-- Animated REAR pointer -->
                {#if rearAnimating && rearBadgeX !== null}
                    <rect x={rearBadgeX - 20} y={SLOT_Y - 28} width="40" height="20" rx="5" fill="rgba(192,132,252,0.15)" stroke="#c084fc" stroke-width="1.2" />
                    <text x={rearBadgeX} y={SLOT_Y - 13} text-anchor="middle" font-family="var(--font-mono)" font-size="9" font-weight="700" fill="#c084fc" letter-spacing="0.8">REAR</text>
                    <line x1={rearBadgeX} y1={SLOT_Y - 8} x2={rearBadgeX} y2={SLOT_Y - 2} stroke="#c084fc" stroke-width="1.5" />
                    <polygon points="{rearBadgeX - 4},{SLOT_Y - 4} {rearBadgeX + 4},{SLOT_Y - 4} {rearBadgeX},{SLOT_Y}" fill="#c084fc" />
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

                <!-- Enqueue button (right) -->
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
                    <title>Enqueue value (N)</title>
                    <rect
                        x={CANVAS_PAD_X + totalW + 24 + ARROW_OFFSET + ARROW_SIZE / 2 - 29 + 15}
                        y={SLOT_Y + NODE_H / 2 - 17}
                        width="58"
                        height="34"
                        rx="5"
                    />
                    <text
                        x={CANVAS_PAD_X + totalW + 24 + ARROW_OFFSET + ARROW_SIZE / 2 + 15}
                        y={SLOT_Y + NODE_H / 2 - 1}
                        text-anchor="middle"
                        font-family="var(--font-mono)"
                        font-size="9"
                        fill="var(--accent)"
                        font-weight="600">Enqueue</text
                    >
                    <line
                        x1={CANVAS_PAD_X + totalW + 24 + ARROW_OFFSET + ARROW_SIZE + 15}
                        y1={SLOT_Y + NODE_H / 2 + 8}
                        x2={CANVAS_PAD_X + totalW + 24 + ARROW_OFFSET + 15}
                        y2={SLOT_Y + NODE_H / 2 + 8}
                        stroke="var(--accent)"
                        stroke-width="1.8"
                    />
                    <polygon
                        points="
      {CANVAS_PAD_X + totalW + 24 + ARROW_OFFSET + 6 + 15},{SLOT_Y + NODE_H / 2 + 4}
      {CANVAS_PAD_X + totalW + 24 + ARROW_OFFSET + 15},{SLOT_Y + NODE_H / 2 + 8}
      {CANVAS_PAD_X + totalW + 24 + ARROW_OFFSET + 6 + 15},{SLOT_Y + NODE_H / 2 + 12}
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
                    <g style="transform: translate({animatingDequeue.x}px, {animatingDequeue.y}px);">
                        <rect
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
                    <g style="transform: translate({animatingEnqueue.x}px, {animatingEnqueue.y}px);">
                        <rect
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
    {/if}

    {#if contextMenu}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
            class="ctx-menu"
            style="left: {contextMenu.x}px; top: {contextMenu.y}px;"
            onmousedown={(e) => e.stopPropagation()}
        >
            <button class="ctx-item" onclick={handleEnqueueFromMenu} disabled={$queueIsFull}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <path d="M4 6.5h5M6.5 4l-2.5 2.5 2.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                Enqueue
            </button>
            <button class="ctx-item" onclick={handleDequeueFromMenu} disabled={$queueIsEmpty}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <path d="M4 6.5h5M6.5 4l-2.5 2.5 2.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                Dequeue
            </button>
        </div>
    {/if}

    {#if $queueCapacity === 0}
        <div class="empty-hint">
            <div class="empty-title">Queue not initialized</div>
            <div class="empty-sub">
                Click <strong>New Queue</strong> to get started
            </div>
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
    .queue-decor {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 5;
    }
    .queue-action-button {
        cursor: pointer;
        outline: none;
        pointer-events: auto;
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
    .queue-action-button:hover:not(.disabled) rect,
    .queue-action-button:focus-visible rect {
        fill: var(--surface2);
        stroke-width: 1.3;
    }
    .queue-action-button text,
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
</style>
