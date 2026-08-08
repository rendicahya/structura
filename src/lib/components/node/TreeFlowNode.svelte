<script>
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
    class="tree-flow-node"
    class:is-root={data.isRoot}
    class:unreachable={!data.reachable}
    class:traversal-current={data.isCurrent}
    class:traversal-visited={data.isVisited}
    class:traversal-found={data.isFound}
    class:traversal-not-found={data.isNotFound}
    ondblclick={startEdit}
>
    <div class="var-name">{data.varName}</div>
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
    {#if !data.reachable}
        <div class="unreachable-label">unreachable</div>
    {/if}
</div>

<style>
    .tree-flow-node {
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
    .tree-flow-node.is-root {
        border-color: var(--success);
        border-width: 2px;
    }
    .tree-flow-node.unreachable {
        opacity: 0.5;
        border-style: dashed;
        border-color: var(--border);
    }
    .tree-flow-node.traversal-visited {
        background: var(--accent-glow);
    }
    .tree-flow-node.traversal-current {
        border-color: var(--warning);
        border-width: 2.5px;
        animation: treeFlowPulse 900ms ease-in-out infinite;
    }
    @keyframes treeFlowPulse {
        0%, 100% { filter: drop-shadow(0 0 0 rgba(240, 180, 41, 0)); }
        50% { filter: drop-shadow(0 0 6px var(--warning)); }
    }
    .tree-flow-node.traversal-found {
        border-color: var(--success);
        border-width: 2.5px;
        background: color-mix(in srgb, var(--success) 18%, var(--node-bg));
        filter: drop-shadow(0 0 6px var(--success));
    }
    .tree-flow-node.traversal-not-found {
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
    .value-input {
        width: 46px;
        box-sizing: border-box;
        font-family: var(--font-mono);
        font-size: 12px;
        text-align: center;
        background: var(--surface2);
        border: 1px solid var(--accent);
        border-radius: 4px;
        color: var(--text);
        padding: 1px 2px;
        outline: none;
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
