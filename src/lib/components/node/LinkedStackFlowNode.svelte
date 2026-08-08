<script>
    const { data } = $props();
</script>

<div
    class="ls-node"
    class:is-top={data.isTop}
    class:is-peeking={data.isPeeking}
    class:is-unreachable={data.isUnreachable}
    class:anim-in={data.isAnimIn}
>
    <span class="var-name">{data.varName}</span>
    <div class="divider"></div>
    <span class="value" class:muted={!data.value}>{data.value || "null"}</span>
</div>

<style>
    .ls-node {
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
    .ls-node.is-top {
        border-color: var(--success);
        border-width: 1.8px;
    }
    .ls-node.is-peeking {
        border-color: var(--warning);
        border-width: 1.8px;
    }
    .ls-node.is-unreachable {
        opacity: 0.5;
        border-style: dashed;
    }
    .ls-node.anim-in {
        animation: slideDown 0.3s ease-out;
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
    .ls-node.is-unreachable .var-name {
        color: var(--text-muted);
    }
    .value {
        font-size: 13px;
        color: var(--text);
        font-weight: 500;
    }
    .value.muted,
    .ls-node.is-unreachable .value {
        color: var(--text-muted);
        font-weight: 400;
    }
</style>
