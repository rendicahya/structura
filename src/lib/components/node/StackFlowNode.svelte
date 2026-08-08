<script>
    const { data } = $props();
</script>

<div
    class="stack-slot-node"
    class:is-empty={data.isEmpty}
    class:is-top={data.isTop}
    class:is-peeking={data.isPeeking}
    class:is-inactive={!data.isEmpty && !data.isActive}
    class:anim-in={data.isAnimIn}
>
    <span class="index-label">{data.index}</span>
    {#if !data.isEmpty}
        <span class="value" class:muted={!data.value}>{data.value || "0"}</span>
    {/if}
</div>

<style>
    .stack-slot-node {
        position: relative;
        width: 160px;
        height: 50px;
        box-sizing: border-box;
        border-radius: 6px;
        background: var(--node-bg);
        border: 1px solid var(--node-border);
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: var(--font-mono);
    }
    .stack-slot-node.is-empty {
        background: var(--surface);
        border-style: dashed;
        border-color: var(--border);
    }
    .stack-slot-node.is-top {
        border-color: var(--accent);
        border-width: 1.8px;
    }
    .stack-slot-node.is-peeking {
        border-color: var(--warning);
        border-width: 1.8px;
        filter: drop-shadow(0 0 6px rgba(240, 180, 41, 0.5));
    }
    .stack-slot-node.is-inactive {
        opacity: 0.35;
    }
    .stack-slot-node.anim-in {
        animation: slideDown 0.6s cubic-bezier(0.25, 1, 0.5, 1);
    }
    @keyframes slideDown {
        from {
            opacity: 0;
            transform: translateY(-100px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    .index-label {
        position: absolute;
        right: 100%;
        margin-right: 8px;
        font-size: 10px;
        color: var(--text-muted);
        white-space: nowrap;
    }
    .value {
        font-size: 14px;
        font-weight: 500;
        color: var(--text);
    }
    .value.muted {
        color: var(--text-muted);
    }
</style>
