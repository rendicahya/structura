<script>
    import { Handle, Position } from "@xyflow/svelte";

    const { data } = $props();

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
    class="dcl-node"
    class:is-head={data.isHead}
    class:is-tail={data.isTail}
    class:is-only={data.isHead && data.isTail}
    class:is-visiting={data.isVisiting}
    class:is-unreachable={data.isUnreachable}
    class:anim-in={data.isAnimIn}
    ondblclick={startEdit}
>
    <!-- Non-interactive anchors for the Svelte Flow bezier edges. `next`
         links ride the upper handles, `prev` links the lower ones; the ring
         closers use the bottom (next) / top (prev) pair so they arc clear
         of the row. Circular-list links are managed by the toolbar, not
         drawn by hand. -->
    <Handle type="target" position={Position.Left} id="next-in" isConnectable={false} style="top: 34%;" />
    <Handle type="source" position={Position.Right} id="next-out" isConnectable={false} style="top: 34%;" />
    <Handle type="source" position={Position.Left} id="prev-out" isConnectable={false} style="top: 66%;" />
    <Handle type="target" position={Position.Right} id="prev-in" isConnectable={false} style="top: 66%;" />
    <Handle type="source" position={Position.Bottom} id="nring-out" isConnectable={false} style="left: 35%;" />
    <Handle type="target" position={Position.Bottom} id="nring-in" isConnectable={false} style="left: 65%;" />
    <Handle type="source" position={Position.Top} id="pring-out" isConnectable={false} style="left: 35%;" />
    <Handle type="target" position={Position.Top} id="pring-in" isConnectable={false} style="left: 65%;" />

    {#if data.isHead || data.isTail}
        <div class="badges">
            {#if data.isHead}<span class="badge head">HEAD</span>{/if}
            {#if data.isTail}<span class="badge tail">TAIL</span>{/if}
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
</div>

<style>
    .dcl-node {
        position: relative;
        min-width: 110px;
        height: 43px;
        padding: 0 12px;
        box-sizing: border-box;
        border-radius: 10px;
        background: var(--node-bg);
        border: 1.5px solid var(--node-border);
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25);
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        font-family: var(--font-ui);
        transition:
            border-color 0.2s,
            box-shadow 0.2s;
    }
    .dcl-node.is-tail {
        border-color: #c084fc;
    }
    .dcl-node.is-head {
        border-color: var(--success);
    }
    .dcl-node.is-only {
        border-color: var(--accent);
    }
    .dcl-node.is-visiting {
        border-color: var(--warning);
        box-shadow: 0 0 14px var(--accent-glow);
    }
    .dcl-node.is-unreachable {
        opacity: 0.5;
        border-style: dashed;
    }
    .dcl-node.anim-in {
        animation: slideIn 0.3s ease-out;
    }
    @keyframes slideIn {
        from {
            opacity: 0;
            transform: translateX(30px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    :global(.dcl-node .svelte-flow__handle) {
        width: 1px;
        height: 1px;
        min-width: 1px;
        min-height: 1px;
        border: none;
        background: transparent;
        opacity: 0;
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
    .value {
        font-family: var(--font-mono);
        font-size: 13px;
        color: var(--text);
        font-weight: 500;
    }
    .is-unreachable .value {
        color: var(--text-muted);
        font-weight: 400;
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
