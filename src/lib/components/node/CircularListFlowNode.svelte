<script>
    const { data } = $props();
</script>

<div
    class="cl-node"
    class:is-head={data.isHead}
    class:is-tail={data.isTail}
    class:is-only={data.isHead && data.isTail}
    class:is-visiting={data.isVisiting}
    class:is-unreachable={data.isUnreachable}
    class:anim-in={data.isAnimIn}
>
    <span class="value" class:muted={!data.value}>{data.value || "null"}</span>
</div>

<style>
    .cl-node {
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
    .cl-node.is-tail {
        border-color: #c084fc;
        border-width: 1.8px;
    }
    .cl-node.is-head {
        border-color: var(--success);
        border-width: 1.8px;
    }
    .cl-node.is-only {
        border-color: var(--accent);
    }
    .cl-node.is-visiting {
        border-color: var(--warning);
        border-width: 1.8px;
        box-shadow: 0 0 14px var(--accent-glow);
    }
    .cl-node.is-unreachable {
        opacity: 0.5;
        border-style: dashed;
    }
    .cl-node.anim-in {
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
    .value {
        font-size: 13px;
        color: var(--text);
        font-weight: 500;
    }
    .value.muted,
    .cl-node.is-unreachable .value {
        color: var(--text-muted);
        font-weight: 400;
    }
</style>
