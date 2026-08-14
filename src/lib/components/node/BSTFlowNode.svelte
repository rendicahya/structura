<script>
    const { data } = $props();
</script>

<div
    class="bst-flow-node"
    class:is-root={data.isRoot}
    class:unreachable={!data.reachable}
    class:traversal-current={data.isCurrent}
    class:traversal-visited={data.isVisited}
    class:traversal-found={data.isFound}
    class:traversal-not-found={data.isNotFound}
>
    <div class="var-name">{data.varName}</div>
    <div class="value">{data.value || "null"}</div>
    {#if !data.reachable}
        <div class="unreachable-label">unreachable</div>
    {/if}
</div>

<style>
    .bst-flow-node {
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
    .bst-flow-node.is-root {
        border-color: var(--success);
        border-width: 2px;
    }
    .bst-flow-node.unreachable {
        opacity: 0.5;
        border-style: dashed;
        border-color: var(--border);
    }
    .bst-flow-node.traversal-visited {
        background: var(--accent-glow);
    }
    .bst-flow-node.traversal-current {
        border-color: var(--warning);
        border-width: 2.5px;
        animation: bstFlowPulse 900ms ease-in-out infinite;
    }
    @keyframes bstFlowPulse {
        0%, 100% { filter: drop-shadow(0 0 0 rgba(240, 180, 41, 0)); }
        50% { filter: drop-shadow(0 0 6px var(--warning)); }
    }
    .bst-flow-node.traversal-found {
        border-color: var(--success);
        border-width: 2.5px;
        background: color-mix(in srgb, var(--success) 18%, var(--node-bg));
        filter: drop-shadow(0 0 6px var(--success));
    }
    .bst-flow-node.traversal-not-found {
        border-color: var(--danger);
        border-width: 2.5px;
        background: color-mix(in srgb, var(--danger) 18%, var(--node-bg));
        filter: drop-shadow(0 0 6px var(--danger));
    }
    .var-name {
        font-size: 8.5px;
        color: var(--accent);
        font-weight: 500;
    }
    .unreachable .var-name {
        color: var(--text-muted);
    }
    .value {
        font-size: 13px;
        color: var(--text);
        font-weight: 500;
    }
    .unreachable .value {
        color: var(--text-muted);
        font-weight: 400;
    }
    .unreachable-label {
        position: absolute;
        bottom: -18px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 8px;
        font-style: italic;
        color: var(--text-muted);
        white-space: nowrap;
    }
</style>
