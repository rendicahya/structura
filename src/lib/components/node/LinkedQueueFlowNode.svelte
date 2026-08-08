<script>
    const { data } = $props();
</script>

<div
    class="lq-node"
    class:is-head={data.isHead}
    class:is-tail={data.isTail}
    class:is-peeking={data.isPeeking}
    class:is-unreachable={data.isUnreachable}
    class:anim-in={data.isAnimIn}
>
    <span class="var-name">{data.varName}</span>
    <div class="divider"></div>
    <span class="value" class:muted={!data.value}>{data.value || "null"}</span>
</div>

<style>
    .lq-node {
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
    }
    .lq-node.is-tail {
        border-color: #c084fc;
        border-width: 1.8px;
    }
    .lq-node.is-head {
        border-color: var(--success);
        border-width: 1.8px;
    }
    .lq-node.is-peeking {
        border-color: var(--warning);
        border-width: 1.8px;
    }
    .lq-node.is-unreachable {
        opacity: 0.5;
        border-style: dashed;
    }
    .lq-node.anim-in {
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
    .divider {
        width: calc(100% - 24px);
        height: 1px;
        background: var(--border);
    }
    .var-name {
        font-size: 10px;
        color: var(--accent);
        font-weight: 500;
    }
    .lq-node.is-unreachable .var-name {
        color: var(--text-muted);
    }
    .value {
        font-size: 13px;
        color: var(--text);
        font-weight: 500;
    }
    .value.muted,
    .lq-node.is-unreachable .value {
        color: var(--text-muted);
        font-weight: 400;
    }
</style>
