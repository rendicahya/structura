<script>
    import { Handle, Position } from "@xyflow/svelte";

    const { data } = $props();
</script>

<div
    class="dcl-node"
    class:is-head={data.isHead}
    class:is-tail={data.isTail}
    class:is-only={data.isHead && data.isTail}
    class:is-visiting={data.isVisiting}
    class:is-unreachable={data.isUnreachable}
    class:anim-in={data.isAnimIn}
>
    <!-- Non-interactive anchors for the Svelte Flow bezier edges. `next`
         links ride the upper handles, `prev` links the lower ones; the ring
         closers use the bottom (next) / top (prev) pair so they arc clear
         of the row. -->
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

    <span class="value" class:muted={!data.value}>{data.value || "null"}</span>
</div>

<style>
    .dcl-node {
        position: relative;
        width: 130px;
        height: 64px;
        box-sizing: border-box;
        border-radius: 10px;
        background: var(--node-bg);
        border: 1px solid var(--node-border);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 6px;
        font-family: var(--font-mono);
        transition:
            border-color 0.2s,
            box-shadow 0.2s;
    }
    .dcl-node.is-tail {
        border-color: #c084fc;
        border-width: 1.8px;
    }
    .dcl-node.is-head {
        border-color: var(--success);
        border-width: 1.8px;
    }
    .dcl-node.is-only {
        border-color: var(--accent);
    }
    .dcl-node.is-visiting {
        border-color: var(--warning);
        border-width: 1.8px;
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
        top: -20px;
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
        font-size: 13px;
        color: var(--text);
        font-weight: 500;
    }
    .value.muted,
    .dcl-node.is-unreachable .value {
        color: var(--text-muted);
        font-weight: 400;
    }
</style>
