<script>
    import { onMount, onDestroy } from "svelte";
    import Icon from "./Icon.svelte";

    const {
        x = 0,
        y = 0,
        node = null,
        isHead = false,
        isTail = false,
        isWalk = false,
        hasNext = false,
        hasPrev = false,
        onclose,
        onrename,
        oneditData,
        ondisconnectNext,
        ondisconnectPrev,
        onsetHead,
        onsetTail,
        onsetWalk,
        onunlink,
    } = $props();

    let menuEl;
    let varNameInput = $state();
    let dataInput = $state();
    let editingVarName = $state(false);
    let editingData = $state(false);
    let tmpVarName = $state("");
    let tmpData = $state("");

    $effect(() => {
        tmpVarName = node?.varName ?? "";
        tmpData = node?.data ?? "";
    });

    function close() {
        onclose?.();
    }
    function handleRename() {
        editingVarName = true;
        setTimeout(() => varNameInput?.focus(), 10);
    }
    function handleEditData() {
        editingData = true;
        setTimeout(() => dataInput?.focus(), 10);
    }

    function commitVarName() {
        if (tmpVarName.trim()) onrename?.({ varName: tmpVarName.trim() });
        editingVarName = false;
        close();
    }

    function commitData() {
        oneditData?.({ data: tmpData });
        editingData = false;
        close();
    }

    function handleDisconnectNext() {
        ondisconnectNext?.();
        close();
    }
    function handleDisconnectPrev() {
        ondisconnectPrev?.();
        close();
    }
    function handleSetHead() {
        onsetHead?.();
        close();
    }
    function handleSetTail() {
        onsetTail?.();
        close();
    }
    function handleSetWalk() {
        onsetWalk?.();
        close();
    }
    function handleUnlink() {
        onunlink?.();
        close();
    }

    function handleKeydown(e) {
        if (e.key === "Escape") close();
    }

    function handleOutsideClick(e) {
        if (menuEl && !menuEl.contains(e.target)) close();
    }

    onMount(() => {
        window.addEventListener("keydown", handleKeydown);
        setTimeout(
            () => window.addEventListener("mousedown", handleOutsideClick),
            0,
        );

        const rect = menuEl.getBoundingClientRect();
        if (rect.right > window.innerWidth)
            menuEl.style.left = x - rect.width + "px";
        if (rect.bottom > window.innerHeight)
            menuEl.style.top = y - rect.height + "px";
    });

    onDestroy(() => {
        window.removeEventListener("keydown", handleKeydown);
        window.removeEventListener("mousedown", handleOutsideClick);
    });
</script>

<div class="context-menu" bind:this={menuEl} style="left: {x}px; top: {y}px;">
    <div class="menu-header">
        <span class="menu-node-label">{node?.varName ?? "Node"}</span>
        <div class="menu-badges">
            {#if isHead}<span class="badge head">HEAD</span>{/if}
            {#if isTail}<span class="badge tail">TAIL</span>{/if}
            {#if isWalk}<span class="badge walk">WALK</span>{/if}
        </div>
    </div>

    {#if editingVarName}
        <div class="menu-input-row">
            <label>
                Variable name
                <input
                    bind:this={varNameInput}
                    bind:value={tmpVarName}
                    onkeydown={(e) => e.key === "Enter" && commitVarName()}
                    placeholder="varName"
                    spellcheck="false"
                />
            </label>
            <button class="btn-confirm" onclick={commitVarName}>Apply</button>
        </div>
    {:else if editingData}
        <div class="menu-input-row">
            <label>
                Data value
                <input
                    bind:this={dataInput}
                    bind:value={tmpData}
                    onkeydown={(e) => e.key === "Enter" && commitData()}
                    placeholder="value"
                    spellcheck="false"
                />
            </label>
            <button class="btn-confirm" onclick={commitData}>Apply</button>
        </div>
    {:else}
        <button class="menu-item" onclick={handleRename}>
            <Icon name="rename" size={13} />
            Rename variable
        </button>

        <button class="menu-item" onclick={handleEditData}>
            <Icon name="edit" size={13} />
            Edit data
        </button>

        <div class="menu-divider"></div>

        <button class="menu-item head-item" onclick={handleSetHead}>
            <Icon name="head" size={13} />
            {isHead ? "✓ Head (unset)" : "Set as head"}
        </button>

        <button class="menu-item tail-item" onclick={handleSetTail}>
            <Icon name="tail" size={13} />
            {isTail ? "✓ Tail (unset)" : "Set as tail"}
        </button>

        <button class="menu-item walk-item" onclick={handleSetWalk}>
            <Icon name="walk" size={13} />
            {isWalk ? "✓ Walk (unset)" : "Set as walk"}
        </button>

        {#if hasNext || hasPrev}
            <div class="menu-divider"></div>
            {#if hasNext}
                <button class="menu-item" onclick={handleDisconnectNext}>
                    <Icon name="disconnect" size={13} />
                    Disconnect next
                </button>
            {/if}
            {#if hasPrev}
                <button class="menu-item" onclick={handleDisconnectPrev}>
                    <Icon name="disconnect" size={13} />
                    Disconnect prev
                </button>
            {/if}
        {/if}

        <div class="menu-divider"></div>

        <button class="menu-item danger" onclick={handleUnlink}>
            <Icon name="unlink" size={13} />
            Unlink node
        </button>
    {/if}
</div>

<style>
    .context-menu {
        position: fixed;
        z-index: 1000;
        background: var(--surface);
        border: 1px solid var(--border-bright);
        border-radius: 10px;
        padding: 6px;
        min-width: 190px;
        box-shadow:
            0 8px 32px rgba(0, 0, 0, 0.5),
            0 0 0 1px rgba(255, 255, 255, 0.04);
        animation: menuIn 0.12s ease;
    }
    @keyframes menuIn {
        from {
            opacity: 0;
            transform: scale(0.95) translateY(-4px);
        }
        to {
            opacity: 1;
            transform: scale(1) translateY(0);
        }
    }
    .menu-header {
        padding: 4px 8px 8px;
        border-bottom: 1px solid var(--border);
        margin-bottom: 4px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
    }
    .menu-node-label {
        font-family: var(--font-mono);
        font-size: 11px;
        color: var(--accent);
        font-weight: 500;
    }
    .menu-badges {
        display: flex;
        gap: 4px;
    }
    .badge {
        font-family: var(--font-mono);
        font-size: 9px;
        font-weight: 700;
        padding: 2px 5px;
        border-radius: 3px;
        letter-spacing: 0.5px;
    }
    .badge.head {
        background: rgba(78, 204, 163, 0.15);
        color: var(--success);
    }
    .badge.tail {
        background: rgba(192, 132, 252, 0.15);
        color: #c084fc;
    }
    .badge.walk {
        background: rgba(251, 146, 60, 0.15);
        color: #fb923c;
    }
    .menu-item {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 7px 10px;
        background: none;
        border: none;
        border-radius: 6px;
        color: var(--text-dim);
        font-family: var(--font-ui);
        font-size: 13px;
        cursor: pointer;
        text-align: left;
        transition: all 0.1s;
    }
    .menu-item:hover {
        background: var(--surface2);
        color: var(--text);
    }
    .menu-item.danger {
        color: var(--danger);
    }
    .menu-item.danger:hover {
        background: rgba(255, 91, 110, 0.1);
        color: var(--danger);
    }
    .menu-item.head-item {
        color: var(--success);
    }
    .menu-item.head-item:hover {
        background: rgba(78, 204, 163, 0.08);
    }
    .menu-item.tail-item {
        color: #c084fc;
    }
    .menu-item.tail-item:hover {
        background: rgba(192, 132, 252, 0.08);
    }
    .menu-item.walk-item {
        color: #fb923c;
    }
    .menu-item.walk-item:hover {
        background: rgba(251, 146, 60, 0.08);
    }
    .menu-divider {
        height: 1px;
        background: var(--border);
        margin: 4px 0;
    }
    .menu-input-row {
        padding: 6px 8px;
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    .menu-input-row label {
        font-size: 11px;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    .menu-input-row input {
        background: var(--surface2);
        border: 1px solid var(--border-bright);
        border-radius: 6px;
        color: var(--text);
        font-family: var(--font-mono);
        font-size: 13px;
        padding: 6px 8px;
        outline: none;
        width: 100%;
    }
    .menu-input-row input:focus {
        border-color: var(--accent);
        box-shadow: 0 0 0 2px var(--accent-glow);
    }
    .btn-confirm {
        background: var(--accent);
        color: #fff;
        border: none;
        border-radius: 6px;
        padding: 5px 10px;
        font-family: var(--font-ui);
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        align-self: flex-end;
    }
    .btn-confirm:hover {
        background: #6f9fff;
    }
</style>
