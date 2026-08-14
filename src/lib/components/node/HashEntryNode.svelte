<script>
    const { data } = $props();
</script>

<div
    class="hash-entry-node"
    class:is-found={data.isFound}
    class:is-not-found={data.isNotFound}
>
    <div class="var-name">{data.varName}</div>
    <div class="value">{data.value}</div>
</div>

<style>
    .hash-entry-node {
        position: relative;
        min-width: 110px;
        box-sizing: border-box;
        padding: 8px 12px;
        border-radius: 10px;
        background: var(--node-bg);
        border: 1.5px solid var(--node-border);
        text-align: center;
        font-family: var(--font-mono);
    }
    .hash-entry-node.is-found {
        border-color: var(--success);
        border-width: 2px;
        background: color-mix(in srgb, var(--success) 18%, var(--node-bg));
        filter: drop-shadow(0 0 6px var(--success));
    }
    .hash-entry-node.is-not-found {
        border-color: var(--danger);
        border-width: 2px;
        background: color-mix(in srgb, var(--danger) 18%, var(--node-bg));
        filter: drop-shadow(0 0 6px var(--danger));
    }
    .var-name {
        font-size: 9px;
        color: var(--accent);
        font-weight: 500;
    }
    .value {
        font-size: 13px;
        color: var(--text);
        font-weight: 500;
    }
</style>
