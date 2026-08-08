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

    function onPortMousedown(e) {
        e.stopPropagation();
        data.onPortMousedown?.(e);
    }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="graph-flow-node"
    class:is-start={data.isStart}
    class:traversal-current={data.isCurrent}
    class:traversal-visited={data.isVisited}
    ondblclick={startEdit}
    onmouseup={() => data.onNodeMouseup?.()}
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

    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="port nodrag" onmousedown={onPortMousedown}></div>
</div>

<style>
    .graph-flow-node {
        position: relative;
        width: 56px;
        height: 56px;
        box-sizing: border-box;
        border-radius: 50%;
        background: var(--node-bg);
        border: 1.5px solid var(--node-border);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2px;
        font-family: var(--font-mono);
        box-shadow: 2px 3px 0 rgba(0, 0, 0, 0.3);
    }
    .graph-flow-node.is-start {
        border-color: var(--accent);
        border-width: 2.5px;
    }
    .graph-flow-node.traversal-visited {
        background: var(--accent-glow);
    }
    .graph-flow-node.traversal-current {
        border-color: var(--warning);
        border-width: 2.5px;
        animation: graphFlowPulse 900ms ease-in-out infinite;
    }
    @keyframes graphFlowPulse {
        0%, 100% { filter: drop-shadow(0 0 0 rgba(240, 180, 41, 0)); }
        50% { filter: drop-shadow(0 0 6px var(--warning)); }
    }
    .var-name {
        font-size: 8px;
        color: var(--accent);
        font-weight: 500;
    }
    .value {
        font-size: 12px;
        color: var(--text);
        font-weight: 500;
    }
    .value-input {
        width: 40px;
        box-sizing: border-box;
        font-family: var(--font-mono);
        font-size: 11px;
        text-align: center;
        background: var(--surface2);
        border: 1px solid var(--accent);
        border-radius: 4px;
        color: var(--text);
        padding: 1px 2px;
        outline: none;
    }
    .port {
        position: absolute;
        bottom: -5px;
        left: 50%;
        transform: translateX(-50%);
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: var(--node-border);
        border: 1px solid var(--border-bright);
        cursor: crosshair;
    }
</style>
