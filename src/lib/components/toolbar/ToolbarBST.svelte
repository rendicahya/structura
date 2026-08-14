<script>
    import { onDestroy, onMount } from "svelte";
    import Tooltip from "../ui/Tooltip.svelte";
    import BrandLogo from "../ui/BrandLogo.svelte";
    import Icon from "../ui/Icon.svelte";
    import {
        pushHistory,
        undo,
        redo,
        canUndo,
        canRedo,
        initHistory,
        registerHistoryHandlers,
    } from "../../stores/shared/history.js";
    import {
        bstNodes,
        bstIsEmpty,
        insertBST,
        garbageCollectBST,
        clearBST,
        resetBST,
        getSnapshotBST,
        applySnapshotBST,
        initBST,
    } from "../../stores/tree/graphBST.js";
    import { clearLogBST } from "../../stores/shared/bstLog.js";
    import { toast } from "../../stores/shared/toast.js";
    import { isTypingTarget } from "../../utils/keyboard.js";
    import {
        traversalState,
        startTraversal,
        startSearch,
        stepForward,
        stepBack,
        playPause,
        stopTraversal,
        resetTraversal,
        setTraversalSpeed,
    } from "../../stores/tree/bstTraversal.js";

    const {
        zoom = 1,
        zoomIn,
        zoomOut,
        zoomReset,
        codeHidden = false,
        ontoggleCode,
        onopenShortcuts,
    } = $props();

    let zoomPct = $derived(Math.round(zoom * 100) + "%");

    let showConfirmNew = $state(false);
    let searchInput = $state("");
    let showInsert = $state(false);
    let insertValue = $state("");
    let insertInputEl = $state();

    // Register history handlers
    $effect(() => {
        registerHistoryHandlers(getSnapshotBST, applySnapshotBST);
    });

    // Navigating away from the BST page unmounts this component, but the
    // traversal interval is module-level state and would otherwise keep
    // ticking in the background indefinitely.
    onDestroy(() => {
        stopTraversal();
    });

    function handleInsertOpen() {
        showInsert = true;
        insertValue = "";
        setTimeout(() => insertInputEl?.focus(), 50);
    }

    function confirmInsert() {
        if (!insertValue.trim()) {
            toast.error("Value cannot be empty");
            return;
        }

        const values = insertValue
            .split(",")
            .map((v) => v.trim())
            .filter((v) => v !== "");
        if (values.length === 0) {
            toast.error("Value cannot be empty");
            return;
        }

        pushHistory();
        let inserted = 0;
        let duplicates = 0;
        for (const val of values) {
            if (insertBST(val)) inserted++;
            else duplicates++;
        }
        pushHistory();

        if (inserted > 0 && duplicates > 0) {
            toast.success(
                `Inserted ${inserted} node${inserted > 1 ? "s" : ""}, ${duplicates} duplicate${duplicates > 1 ? "s" : ""} skipped`,
            );
        } else if (inserted > 1) {
            toast.success(`Inserted ${inserted} nodes`);
        } else if (inserted === 1) {
            toast.success(`Inserted "${values[0]}"`);
        } else {
            toast.error(
                duplicates === 1
                    ? `"${values[0]}" already exists`
                    : "All values already exist",
            );
        }

        showInsert = false;
        insertValue = "";
    }

    function handleNew() {
        if ($bstNodes.length > 0) {
            showConfirmNew = true;
        } else {
            confirmNewActual();
        }
    }

    function confirmNewActual() {
        resetTraversal();
        resetBST();
        clearLogBST();
        initHistory();
        initBST();
        showConfirmNew = false;
        toast.success("Tree cleared");
    }

    function handleGC() {
        if ($traversalState.order.length > 0) {
            toast.error("Stop traversal playback first");
            return;
        }
        pushHistory();
        garbageCollectBST();
        pushHistory();
    }

    function handleTraversalTypeChange(e) {
        startTraversal(e.currentTarget.value);
    }

    function handlePlayPause() {
        if ($traversalState.order.length === 0 && $traversalState.type !== "search") {
            startTraversal($traversalState.type);
        }
        playPause();
    }

    function handleStepForward() {
        if ($traversalState.order.length === 0 && $traversalState.type !== "search") {
            startTraversal($traversalState.type);
        }
        stepForward();
    }

    function handleSpeedChange(e) {
        setTraversalSpeed(Number(e.currentTarget.value));
    }

    function handleSearch() {
        const target = searchInput.trim();
        if ($bstIsEmpty || !target) return;
        startSearch(target);
    }

    function handleSearchKeydown(e) {
        if (e.key === "Enter") {
            e.preventDefault();
            handleSearch();
        }
    }

    function handleSave() {
        const snap = getSnapshotBST();
        const blob = new Blob([JSON.stringify(snap, null, 2)], {
            type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "structura-bst-save.json";
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Saved successfully");
    }

    function handleLoad() {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json";
        input.onchange = (e) => {
            const target = /** @type {HTMLInputElement} */ (e.target);
            const file = target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const result = /** @type {string} */ (ev.target?.result);
                    const snap = JSON.parse(result);
                    resetTraversal();
                    pushHistory();
                    applySnapshotBST(snap);
                    toast.success("Loaded successfully");
                } catch {
                    toast.error("Invalid save file");
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    onMount(() => {
        const onInsertEvent = () => handleInsertOpen();
        window.addEventListener("bst:insert", onInsertEvent);
        return () => {
            window.removeEventListener("bst:insert", onInsertEvent);
        };
    });

    /** @param {KeyboardEvent} e */
    function onKeydown(e) {
        if (isTypingTarget(e) || e.repeat) return;

        if ((e.ctrlKey || e.metaKey) && !e.altKey) {
            const key = e.key.toLowerCase();
            if (key === "s") {
                e.preventDefault();
                if (!$bstIsEmpty) handleSave();
            } else if (key === "o") {
                e.preventDefault();
                handleLoad();
            } else if (e.key === "\\") {
                e.preventDefault();
                ontoggleCode?.();
            }
            return;
        }

        if (e.altKey) return;
        if (e.key.toLowerCase() === "n") {
            e.preventDefault();
            handleInsertOpen();
        }
    }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="toolbar">
    <div class="brand">
        <BrandLogo />
        <span class="brand-name">Structura</span>
    </div>

    <div class="actions">
        <Tooltip text="Insert value" shortcut="N">
            <button class="btn btn-primary" onclick={handleInsertOpen}>
                <Icon name="plus" />
                Insert
            </button>
        </Tooltip>

        <Tooltip text="New tree">
            <button
                class="btn btn-secondary"
                onclick={handleNew}
                disabled={$bstIsEmpty}
            >
                <Icon name="new" />
                New
            </button>
        </Tooltip>

        <Tooltip text="Run Garbage Collection">
            <button
                class="btn btn-gc"
                onclick={handleGC}
                disabled={$bstIsEmpty}
            >
                <Icon name="gc" />
                Run GC
            </button>
        </Tooltip>

        <div class="separator"></div>

        <Tooltip text="Traversal order">
            <select
                class="traversal-select"
                value={$traversalState.type}
                onchange={handleTraversalTypeChange}
                disabled={$bstIsEmpty}
            >
                <option value="inorder">In-order</option>
                <option value="preorder">Pre-order</option>
                <option value="postorder">Post-order</option>
            </select>
        </Tooltip>

        <Tooltip text="Search value">
            <input
                class="traversal-select traversal-search-input"
                type="text"
                placeholder="Search…"
                bind:value={searchInput}
                onkeydown={handleSearchKeydown}
                disabled={$bstIsEmpty}
            />
        </Tooltip>

        <Tooltip text="Search">
            <button
                class="btn btn-icon"
                aria-label="Search"
                onclick={handleSearch}
                disabled={$bstIsEmpty || !searchInput.trim()}
            >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="6" cy="6" r="4" stroke="currentColor" stroke-width="1.4" />
                    <path d="M9.2 9.2L12 12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
                </svg>
            </button>
        </Tooltip>

        <Tooltip text={$traversalState.playing ? "Pause" : "Play traversal"}>
            <button
                class="btn btn-icon"
                aria-label={$traversalState.playing ? "Pause" : "Play traversal"}
                onclick={handlePlayPause}
                disabled={$bstIsEmpty ||
                    ($traversalState.order.length > 0 &&
                        $traversalState.index >= $traversalState.order.length - 1)}
            >
                {#if $traversalState.playing}
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <rect x="3" y="2" width="3" height="10" rx="1" fill="currentColor" />
                        <rect x="8" y="2" width="3" height="10" rx="1" fill="currentColor" />
                    </svg>
                {:else}
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M3.5 2.3v9.4c0 .6.6.9 1.1.6l7.6-4.7c.5-.3.5-1 0-1.3L4.6 1.6c-.5-.3-1.1 0-1.1.7z" fill="currentColor" />
                    </svg>
                {/if}
            </button>
        </Tooltip>

        <Tooltip text="Step back">
            <button
                class="btn btn-icon"
                aria-label="Step back"
                onclick={stepBack}
                disabled={$bstIsEmpty || $traversalState.playing || $traversalState.index <= -1}
            >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <rect x="2.5" y="2" width="2" height="10" rx="1" fill="currentColor" />
                    <path d="M11 2.7v8.6c0 .6-.6.9-1.1.6l-5.4-4.3c-.4-.3-.4-1 0-1.3L9.9 2c.5-.3 1.1 0 1.1.7z" fill="currentColor" />
                </svg>
            </button>
        </Tooltip>

        <Tooltip text="Step forward">
            <button
                class="btn btn-icon"
                aria-label="Step forward"
                onclick={handleStepForward}
                disabled={$bstIsEmpty ||
                    $traversalState.playing ||
                    ($traversalState.order.length > 0 &&
                        $traversalState.index >= $traversalState.order.length - 1)}
            >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 2.7v8.6c0 .6.6.9 1.1.6l5.4-4.3c.4-.3.4-1 0-1.3L4.1 2c-.5-.3-1.1 0-1.1.7z" fill="currentColor" />
                    <rect x="9.5" y="2" width="2" height="10" rx="1" fill="currentColor" />
                </svg>
            </button>
        </Tooltip>

        <Tooltip text="Stop traversal">
            <button
                class="btn btn-icon"
                aria-label="Stop traversal"
                onclick={stopTraversal}
                disabled={$traversalState.order.length === 0}
            >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <rect x="3" y="3" width="8" height="8" rx="1.5" fill="currentColor" />
                </svg>
            </button>
        </Tooltip>

        <Tooltip text="Playback speed">
            <select
                class="traversal-select traversal-speed"
                value={$traversalState.speed}
                onchange={handleSpeedChange}
                disabled={$bstIsEmpty}
            >
                <option value="1400">0.5x</option>
                <option value="700">1x</option>
                <option value="350">2x</option>
            </select>
        </Tooltip>

        <div class="separator"></div>

        <Tooltip text="Zoom out" shortcut="Scroll ↓">
            <button class="btn btn-icon" aria-label="Zoom out" onclick={zoomOut}>
                <Icon name="zoomOut" size={15} />
            </button>
        </Tooltip>
        <Tooltip text="Reset zoom">
            <button
                class="zoom-label"
                aria-label="Reset zoom"
                onclick={zoomReset}>{zoomPct}</button
            >
        </Tooltip>
        <Tooltip text="Zoom in" shortcut="Scroll ↑">
            <button class="btn btn-icon" aria-label="Zoom in" onclick={zoomIn}>
                <Icon name="zoomIn" size={15} />
            </button>
        </Tooltip>

        <div class="separator"></div>

        <Tooltip text="Undo" shortcut="Ctrl+Z">
            <button
                class="btn btn-icon"
                aria-label="Undo"
                onclick={undo}
                disabled={!$canUndo}
            >
                <Icon name="undo" size={16} />
            </button>
        </Tooltip>
        <Tooltip text="Redo" shortcut="Ctrl+Y">
            <button
                class="btn btn-icon"
                aria-label="Redo"
                onclick={redo}
                disabled={!$canRedo}
            >
                <Icon name="redo" size={16} />
            </button>
        </Tooltip>

        <div class="separator"></div>

        <Tooltip text="Save to file" shortcut="Ctrl+S">
            <button
                class="btn btn-secondary"
                onclick={handleSave}
                disabled={$bstIsEmpty}
            >
                <Icon name="save" />
                Save
            </button>
        </Tooltip>
        <Tooltip text="Load from file" shortcut="Ctrl+O">
            <button class="btn btn-secondary" onclick={handleLoad}>
                <Icon name="load" />
                Load
            </button>
        </Tooltip>

        <div class="separator"></div>

        <Tooltip
            text={codeHidden ? "Show code panel" : "Hide code panel"}
            shortcut="Ctrl+\"
        >
            <button
                class="btn btn-icon"
                aria-label={codeHidden ? "Show code panel" : "Hide code panel"}
                class:active={codeHidden}
                onclick={() => ontoggleCode?.()}
            >
                <Icon name="code" {codeHidden} />
            </button>
        </Tooltip>

        <Tooltip text="Keyboard shortcuts" shortcut="?">
            <button
                class="btn btn-icon"
                aria-label="Keyboard shortcuts"
                onclick={() => onopenShortcuts?.()}
            >
                <Icon name="shortcuts" />
            </button>
        </Tooltip>
    </div>
</div>

<!-- Confirm New Modal -->
{#if showConfirmNew}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-overlay" onmousedown={() => (showConfirmNew = false)}>
        <div class="modal modal-sm" onmousedown={(e) => e.stopPropagation()}>
            <div class="modal-header">
                <span class="modal-title">New Tree</span>
                <button
                    class="close-btn"
                    aria-label="Close"
                    onclick={() => (showConfirmNew = false)}
                >
                    <Icon name="close" size={14} />
                </button>
            </div>
            <div class="modal-body">
                <p class="confirm-text">
                    Start a new tree? All unsaved work will be lost.
                </p>
            </div>
            <div class="modal-footer">
                <button
                    class="btn btn-secondary"
                    onclick={() => (showConfirmNew = false)}>Cancel</button
                >
                <button class="btn btn-primary" onclick={confirmNewActual}
                    >Confirm</button
                >
            </div>
        </div>
    </div>
{/if}

<!-- Insert Modal -->
{#if showInsert}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-overlay" onmousedown={() => (showInsert = false)}>
        <div class="modal" onmousedown={(e) => e.stopPropagation()}>
            <div class="modal-header">
                <span class="modal-title">Insert value(s)</span>
                <button
                    class="close-btn"
                    aria-label="Close"
                    onclick={() => (showInsert = false)}
                >
                    <Icon name="close" size={14} />
                </button>
            </div>
            <div class="modal-body">
                <div class="field">
                    <label for="bst-insert-value">Value</label>
                    <input
                        id="bst-insert-value"
                        bind:this={insertInputEl}
                        bind:value={insertValue}
                        onkeydown={(e) => e.key === "Enter" && confirmInsert()}
                        placeholder="Enter value(s), comma-separated..."
                        spellcheck="false"
                    />
                </div>
            </div>
            <div class="modal-footer">
                <button
                    class="btn btn-secondary"
                    onclick={() => (showInsert = false)}>Cancel</button
                >
                <button class="btn btn-primary" onclick={confirmInsert}
                    >Insert</button
                >
            </div>
        </div>
    </div>
{/if}

<style>
    .toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 20px;
        height: 52px;
        background: var(--toolbar-bg);
        border-bottom: 1px solid var(--border);
        flex-shrink: 0;
        gap: 12px;
    }
    .brand {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    .brand-name {
        font-family: var(--font-ui);
        font-weight: 800;
        font-size: 18px;
        letter-spacing: -0.5px;
        color: var(--text);
    }
    .actions {
        display: flex;
        align-items: center;
        gap: 6px;
    }
    .separator {
        width: 1px;
        height: 20px;
        background: var(--border);
        margin: 0 4px;
    }
    .btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border-radius: 7px;
        border: 1px solid transparent;
        cursor: pointer;
        font-family: var(--font-ui);
        font-size: 13px;
        font-weight: 600;
        transition: all 0.15s ease;
    }
    .btn:disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }
    .btn-primary {
        background: var(--accent);
        color: #fff;
    }
    .btn-primary:hover:not(:disabled) {
        background: #6f9fff;
        box-shadow: 0 0 16px var(--accent-glow);
    }
    .btn-gc {
        background: rgba(78, 204, 163, 0.12);
        color: var(--success);
        border: 1px solid rgba(78, 204, 163, 0.3);
    }
    .btn-gc:hover:not(:disabled) {
        background: rgba(78, 204, 163, 0.22);
    }
    .btn-secondary {
        background: var(--surface2);
        color: var(--text-dim);
        border-color: var(--border);
    }
    .btn-secondary:hover:not(:disabled) {
        background: var(--border);
        color: var(--text);
    }
    .btn-icon {
        background: var(--surface2);
        color: var(--text-dim);
        border-color: var(--border);
        padding: 6px 8px;
    }
    .btn-icon:hover:not(:disabled) {
        background: var(--border);
        color: var(--text);
    }
    .btn-icon.active {
        background: var(--accent-dim);
        color: #fff;
        border-color: var(--accent-dim);
    }
    .zoom-label {
        font-family: var(--font-mono);
        font-size: 11px;
        font-weight: 600;
        color: var(--text-dim);
        background: var(--surface2);
        border: 1px solid var(--border);
        border-radius: 5px;
        padding: 4px 7px;
        cursor: pointer;
        min-width: 42px;
        text-align: center;
        transition: all 0.15s;
    }
    .zoom-label:hover {
        background: var(--border);
        color: var(--text);
    }
    .traversal-select {
        font-family: var(--font-ui);
        font-size: 12px;
        font-weight: 600;
        color: var(--text-dim);
        background: var(--surface2);
        border: 1px solid var(--border);
        border-radius: 6px;
        padding: 5px 6px;
        cursor: pointer;
        transition: all 0.15s ease;
    }
    .traversal-select:hover:not(:disabled) {
        background: var(--border);
        color: var(--text);
    }
    .traversal-select:disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }
    .traversal-speed {
        width: 58px;
    }
    .traversal-search-input {
        width: 84px;
        cursor: text;
    }

    /* Modal */
    .modal-overlay {
        position: fixed;
        inset: 0;
        z-index: 2000;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.15s ease;
    }
    @keyframes fadeIn {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }
    .modal {
        background: var(--surface);
        border: 1px solid var(--border-bright);
        border-radius: 14px;
        width: 320px;
        box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
        animation: slideIn 0.15s ease;
        overflow: hidden;
    }
    .modal-sm {
        width: 280px;
    }
    @keyframes slideIn {
        from {
            opacity: 0;
            transform: translateY(-12px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 1px solid var(--border);
    }
    .modal-title {
        font-family: var(--font-ui);
        font-size: 14px;
        font-weight: 700;
        color: var(--text);
    }
    .close-btn {
        background: none;
        border: none;
        color: var(--text-muted);
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.1s;
    }
    .close-btn:hover {
        background: var(--surface2);
        color: var(--text);
    }
    .modal-body {
        padding: 16px 20px;
        display: flex;
        flex-direction: column;
        gap: 14px;
    }
    .confirm-text {
        font-family: var(--font-ui);
        font-size: 13px;
        color: var(--text-dim);
        line-height: 1.5;
        margin: 0;
    }
    .field {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    .field label {
        font-family: var(--font-ui);
        font-size: 11px;
        font-weight: 600;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    .field input {
        background: var(--surface2);
        border: 1px solid var(--border-bright);
        border-radius: 7px;
        color: var(--text);
        font-family: var(--font-mono);
        font-size: 13px;
        padding: 8px 10px;
        outline: none;
        width: 100%;
    }
    .field input:focus {
        border-color: var(--accent);
        box-shadow: 0 0 0 2px var(--accent-glow);
    }
    .modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding: 12px 20px;
        border-top: 1px solid var(--border);
    }
</style>
