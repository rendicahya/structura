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
    class="sll-flow-node"
    class:selected
    class:connecting
    class:is-head={data.isHead}
    class:is-tail={data.isTail}
    class:is-walk={data.isWalk}
    class:is-input={data.isInput}
    ondblclick={startEdit}
>
    <Handle type="target" position={Position.Left} class="drop-target" />

    {#if data.isHead || data.isTail || data.isWalk || data.isInput}
        <div class="badges">
            {#if data.isHead}<span class="badge head">HEAD</span>{/if}
            {#if data.isTail}<span class="badge tail">TAIL</span>{/if}
            {#if data.isWalk}<span class="badge walk">WALK</span>{/if}
            {#if data.isInput}<span class="badge input">INPUT</span>{/if}
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
        position={Position.Right}
        class="drag-source"
        style="left: auto; right: 0; top: 0; width: 20%; height: 100%; transform: none;"
    />

    {#if !data.hasNext}
        <svg class="ground-symbol" width="26" height="26" viewBox="0 0 26 26" fill="none">
            <line x1="0" y1="4" x2="13" y2="4" stroke="var(--text-muted)" stroke-width="1.5" />
            <line x1="13" y1="4" x2="13" y2="10" stroke="var(--text-muted)" stroke-width="1.5" />
            <line x1="5" y1="10" x2="21" y2="10" stroke="var(--text-muted)" stroke-width="1.5" />
            <line x1="8" y1="15" x2="18" y2="15" stroke="var(--text-muted)" stroke-width="1.5" />
            <line x1="11" y1="20" x2="15" y2="20" stroke="var(--text-muted)" stroke-width="1.5" />
        </svg>
    {/if}
</div>

<style>
    .sll-flow-node {
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
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25);
        text-align: center;
        font-family: var(--font-ui);
    }
    /* Drag-start hit area for the "next" pointer: the interactive Handle is
       stretched to cover the right 20% of the node so grabbing it doesn't
       require pinpointing a 10px circle. The visible dot is centered inside
       that same box (not pinned to the node's edge) because xyflow anchors
       the in-progress connection line to the handle element's own center —
       keeping the dot there is what makes the line start from where the
       user is actually dragging. */
    :global(.sll-flow-node .svelte-flow__handle.drag-source) {
        border-radius: 0 10px 10px 0;
        background: transparent;
        border: none;
    }
    :global(.sll-flow-node .svelte-flow__handle.drag-source::after) {
        content: "";
        position: absolute;
        right: 50%;
        top: 50%;
        transform: translate(50%, -50%);
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: var(--accent);
        border: 2px solid var(--surface);
        pointer-events: none;
    }
    .sll-flow-node.is-input {
        border-color: #f472b6;
    }
    .sll-flow-node.is-walk {
        border-color: #fb923c;
    }
    .sll-flow-node.is-tail {
        border-color: #c084fc;
    }
    .sll-flow-node.is-head {
        border-color: var(--success);
    }
    .sll-flow-node.connecting {
        border-color: var(--warning);
    }
    .sll-flow-node.selected {
        border-color: var(--accent);
        box-shadow:
            0 0 0 3px var(--accent-glow),
            0 4px 10px rgba(0, 0, 0, 0.25);
    }
    .ground-symbol {
        position: absolute;
        right: -25px;
        /* The wire stub inside the icon sits at local y=4, not at the
           viewBox's vertical center, so align by that point rather than
           centering the whole 26px box — otherwise the wire misses the
           node's port height and the icon reads as floating/detached. */
        top: calc(50% - 4px);
        pointer-events: none;
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
    .badge.input {
        background: rgba(244, 114, 182, 0.15);
        color: #f472b6;
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
