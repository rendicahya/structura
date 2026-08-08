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
    ondblclick={startEdit}
>
    <Handle type="target" position={Position.Left} />

    {#if data.isHead || data.isTail || data.isWalk}
        <div class="badges">
            {#if data.isHead}<span class="badge head">HEAD</span>{/if}
            {#if data.isTail}<span class="badge tail">TAIL</span>{/if}
            {#if data.isWalk}<span class="badge walk">WALK</span>{/if}
        </div>
    {/if}

    <div class="var-name">{data.varName}</div>

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

    <Handle type="source" position={Position.Right} />

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
        padding: 8px 12px;
        border-radius: 10px;
        background: var(--node-bg);
        border: 1.5px solid var(--node-border);
        text-align: center;
        font-family: var(--font-ui);
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
        box-shadow: 0 0 0 3px var(--accent-glow);
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
    .var-name {
        font-family: var(--font-mono);
        font-size: 9px;
        color: var(--accent);
        font-weight: 600;
        margin-bottom: 2px;
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
