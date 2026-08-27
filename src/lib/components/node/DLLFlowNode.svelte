<script>
    import { Handle, Position, useConnection } from "@xyflow/svelte";

    const { id, data, selected } = $props();

    const connection = useConnection();
    let connecting = $derived(
        connection.current.inProgress && connection.current.fromNode?.id === id,
    );

    let editing = $state(false);
    let editValue = $state("");
    let inputEl = $state();

    function startEdit(e) {
        e.stopPropagation();
        editValue = data.value ?? "";
        editing = true;
        setTimeout(() => {
            inputEl?.focus();
            inputEl?.select();
        }, 10);
    }

    function commitEdit() {
        if (!editing) return;
        editing = false;
        data.onEdit?.(editValue);
    }

    function onKeydown(e) {
        if (e.key === "Enter") {
            e.preventDefault();
            commitEdit();
        }
        if (e.key === "Escape") {
            e.preventDefault();
            editing = false;
        }
    }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="dll-flow-node"
    class:selected
    class:connecting
    class:is-head={data.isHead}
    class:is-tail={data.isTail}
    class:is-walk={data.isWalk}
    ondblclick={startEdit}
>
    <Handle
        type="target"
        id="next-target"
        position={Position.Left}
        class="handle-next drop-target"
        style="top: 38%;"
    />
    <Handle
        type="source"
        id="prev-source"
        position={Position.Left}
        class="handle-prev drag-source drag-source-left"
        style="right: auto; left: 0; top: 50%; width: 20%; height: 50%; transform: none;"
    />

    {#if data.isHead || data.isTail || data.isWalk}
        <div class="badges">
            {#if data.isHead}<span class="badge head">HEAD</span>{/if}
            {#if data.isTail}<span class="badge tail">TAIL</span>{/if}
            {#if data.isWalk}<span class="badge walk">WALK</span>{/if}
        </div>
    {/if}

    {#if editing}
        <input
            class="nodrag value-input"
            bind:this={inputEl}
            bind:value={editValue}
            onkeydown={onKeydown}
            onblur={commitEdit}
            spellcheck="false"
        />
    {:else}
        <div class="value">{data.value || "null"}</div>
    {/if}

    <Handle
        type="source"
        id="next-source"
        position={Position.Right}
        class="handle-next drag-source drag-source-right"
        style="left: auto; right: 0; top: 0; width: 20%; height: 50%; transform: none;"
    />
    <Handle
        type="target"
        id="prev-target"
        position={Position.Right}
        class="handle-prev drop-target"
        style="top: 62%;"
    />

    {#if !data.hasNext}
        <svg
            class="ground-symbol ground-right"
            width="26"
            height="26"
            viewBox="0 0 26 26"
            fill="none"
        >
            <line x1="0" y1="4" x2="13" y2="4" stroke="var(--text-muted)" stroke-width="1.5" />
            <line x1="13" y1="4" x2="13" y2="10" stroke="var(--text-muted)" stroke-width="1.5" />
            <line x1="5" y1="10" x2="21" y2="10" stroke="var(--text-muted)" stroke-width="1.5" />
            <line x1="8" y1="15" x2="18" y2="15" stroke="var(--text-muted)" stroke-width="1.5" />
            <line x1="11" y1="20" x2="15" y2="20" stroke="var(--text-muted)" stroke-width="1.5" />
        </svg>
    {/if}

    {#if !data.hasPrev}
        <svg
            class="ground-symbol ground-left"
            width="26"
            height="26"
            viewBox="0 0 26 26"
            fill="none"
        >
            <line x1="0" y1="4" x2="13" y2="4" stroke="var(--text-muted)" stroke-width="1.5" />
            <line x1="13" y1="4" x2="13" y2="10" stroke="var(--text-muted)" stroke-width="1.5" />
            <line x1="5" y1="10" x2="21" y2="10" stroke="var(--text-muted)" stroke-width="1.5" />
            <line x1="8" y1="15" x2="18" y2="15" stroke="var(--text-muted)" stroke-width="1.5" />
            <line x1="11" y1="20" x2="15" y2="20" stroke="var(--text-muted)" stroke-width="1.5" />
        </svg>
    {/if}
</div>

<style>
    .dll-flow-node {
        position: relative;
        min-width: 110px;
        height: 43px;
        padding: 0 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 10px;
        background: var(--node-bg);
        border: 1.5px solid var(--node-border);
        text-align: center;
        font-family: var(--font-ui);
    }
    .dll-flow-node.is-walk {
        border-color: #fb923c;
    }
    .dll-flow-node.is-tail {
        border-color: #c084fc;
    }
    .dll-flow-node.is-head {
        border-color: var(--success);
    }
    .dll-flow-node.connecting {
        border-color: var(--warning);
    }
    .dll-flow-node.selected {
        border-color: var(--accent);
        box-shadow: 0 0 0 3px var(--accent-glow);
    }
    :global(.dll-flow-node .handle-next) {
        background: var(--accent);
        border-color: #6f9fff;
    }
    :global(.dll-flow-node .handle-prev) {
        background: #c792ea;
        border-color: #a855f7;
    }
    /* Drag-start hit areas for the next/prev pointers: the interactive
       Handle is stretched to cover 20% of the node's width on its edge
       (across the half of the node's height it owns) so grabbing it
       doesn't require pinpointing a 10px circle. The visible dot is
       centered inside that same box (not pinned to the node's edge)
       because xyflow anchors the in-progress connection line to the
       handle element's own center — keeping the dot there is what makes
       the line start from where the user is actually dragging. */
    :global(.dll-flow-node .svelte-flow__handle.drag-source-right) {
        border-radius: 0 10px 0 0;
        background: transparent;
        border: none;
    }
    :global(.dll-flow-node .svelte-flow__handle.drag-source-right::after) {
        content: "";
        position: absolute;
        right: 50%;
        top: 50%;
        transform: translate(50%, -50%);
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: var(--accent);
        border: 2px solid #6f9fff;
        pointer-events: none;
    }
    :global(.dll-flow-node .svelte-flow__handle.drag-source-left) {
        border-radius: 0 0 0 10px;
        background: transparent;
        border: none;
    }
    :global(.dll-flow-node .svelte-flow__handle.drag-source-left::after) {
        content: "";
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #c792ea;
        border: 2px solid #a855f7;
        pointer-events: none;
    }
    .ground-symbol {
        position: absolute;
        /* The wire stub inside the icon sits at local y=4, not at the
           viewBox's vertical center, so align by that point rather than
           centering the whole 26px box — otherwise the wire misses the
           node's port height and the icon reads as floating/detached. */
        top: calc(50% - 4px);
        pointer-events: none;
    }
    .ground-symbol.ground-right {
        right: -25px;
    }
    .ground-symbol.ground-left {
        left: -25px;
        transform: scaleX(-1);
    }
    .badges {
        position: absolute;
        top: -22px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        gap: 4px;
        white-space: nowrap;
    }
    .badge {
        font-family: var(--font-mono);
        font-size: 9px;
        font-weight: 700;
        padding: 2px 5px;
        border-radius: 3px;
        letter-spacing: 0.5px;
    }
    .badge.head {
        background: rgba(78, 204, 163, 0.15);
        color: var(--success);
    }
    .badge.tail {
        background: rgba(192, 132, 252, 0.15);
        color: #c084fc;
    }
    .badge.walk {
        background: rgba(251, 146, 60, 0.15);
        color: #fb923c;
    }
    .value {
        font-family: var(--font-mono);
        font-size: 13px;
        color: var(--text);
        font-weight: 500;
    }
    .value-input {
        width: 100%;
        box-sizing: border-box;
        font-family: var(--font-mono);
        font-size: 13px;
        text-align: center;
        background: var(--surface2);
        border: 1px solid var(--accent);
        border-radius: 4px;
        color: var(--text);
        padding: 2px 4px;
        outline: none;
    }
</style>
