<script>
    const { data } = $props();
</script>

<div
    class="heap-flow-node"
    class:is-root={data.isRoot}
    class:is-peeking={data.isPeeking}
>
    <div class="index-badge">[{data.index}]</div>
    <div class="value">{data.value}</div>
</div>

<style>
    .heap-flow-node {
        position: relative;
        width: 68px;
        height: 68px;
        box-sizing: border-box;
        border-radius: 50%;
        background: var(--node-bg);
        border: 1.5px solid var(--node-border);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 3px;
        font-family: var(--font-mono);
        box-shadow: 2px 3px 0 rgba(0, 0, 0, 0.3);
    }
    .heap-flow-node.is-root {
        border-color: var(--success);
        border-width: 2px;
    }
    .heap-flow-node.is-peeking {
        border-color: var(--warning);
        border-width: 2px;
        filter: drop-shadow(0 0 6px rgba(240, 180, 41, 0.5));
    }
    .index-badge {
        font-size: 8.5px;
        color: var(--accent);
        font-weight: 500;
    }
    .value {
        font-size: 13px;
        color: var(--text);
        font-weight: 500;
    }
</style>
