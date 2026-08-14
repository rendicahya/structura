<script>
    const { data } = $props();
</script>

<div
    class="hash-bucket-node"
    class:is-empty={data.chainLength === 0}
    class:has-collision={data.chainLength > 1}
>
    <span class="index-label">[{data.index}]</span>
    {#if data.chainLength > 1}
        <span class="chain-badge">×{data.chainLength}</span>
    {/if}
</div>

<style>
    .hash-bucket-node {
        position: relative;
        width: 56px;
        height: 44px;
        box-sizing: border-box;
        border-radius: 6px;
        background: var(--node-bg);
        border: 1.5px solid var(--node-border);
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: var(--font-mono);
    }
    .hash-bucket-node.is-empty {
        background: var(--surface);
        border-style: dashed;
        border-color: var(--border);
    }
    .hash-bucket-node.has-collision {
        border-color: var(--warning);
        border-width: 2px;
    }
    .index-label {
        font-size: 12px;
        font-weight: 600;
        color: var(--text-dim);
    }
    .is-empty .index-label {
        color: var(--text-muted);
    }
    .chain-badge {
        position: absolute;
        top: -8px;
        right: -8px;
        font-size: 9px;
        font-weight: 700;
        color: #fff;
        background: var(--warning);
        border-radius: 8px;
        padding: 1px 5px;
        line-height: 1.4;
    }
</style>
