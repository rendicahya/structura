<script>
    import { onMount } from "svelte";
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
        hashEntries,
        hashCapacity,
        hashIsEmpty,
        insertHash,
        searchHash,
        initHash,
        clearHash,
        getSnapshotHash,
        applySnapshotHash,
    } from "../../stores/hash/graphHash.js";
    import { clearLogHash } from "../../stores/shared/hashLog.js";
    import { toast } from "../../stores/shared/toast.js";
    import { isTypingTarget } from "../../utils/keyboard.js";

    // Register history handlers
    registerHistoryHandlers(getSnapshotHash, applySnapshotHash);

    const {
        zoom = 1,
        zoomIn,
        zoomOut,
        zoomReset,
        codeHidden = false,
        ontoggleCode,
        onopenShortcuts,
    } = $props();

    let showConfirmNew = $state(false);
    let showNewHash = $state(false);
    let newCapacity = $state(7);
    let capacityInputEl = $state();

    let showInsert = $state(false);
    let insertValue = $state("");
    let insertInputEl = $state();

    let searchInput = $state("");

    let zoomPct = $derived(Math.round(zoom * 100) + "%");

    function openNewHashModal() {
        showNewHash = true;
        setTimeout(() => {
            capacityInputEl?.focus();
            capacityInputEl?.select();
        }, 50);
    }

    function handleNew() {
        if ($hashCapacity > 0) {
            showConfirmNew = true;
        } else {
            openNewHashModal();
        }
    }

    function confirmNewActual() {
        showConfirmNew = false;
        openNewHashModal();
    }

    function confirmNewHash() {
        if (newCapacity < 1 || newCapacity > 20) {
            toast.error("Capacity must be between 1 and 20");
            return;
        }
        clearHash();
        clearLogHash();
        initHistory();
        initHash(newCapacity, "table");
        showNewHash = false;
        toast.success(`Hash table created with ${newCapacity} buckets`);
    }

    function handleInsertOpen() {
        if ($hashCapacity === 0) return;
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
            if (insertHash(val)) inserted++;
            else duplicates++;
        }
        pushHistory();

        if (inserted > 0 && duplicates > 0) {
            toast.success(
                `Inserted ${inserted} value${inserted > 1 ? "s" : ""}, ${duplicates} duplicate${duplicates > 1 ? "s" : ""} skipped`,
            );
        } else if (inserted > 1) {
            toast.success(`Inserted ${inserted} values`);
        } else if (inserted === 1) {
            toast.success(`Inserted "${values[0]}"`);
        } else {
            toast.error(
                duplicates === 1 ? `"${values[0]}" already exists` : "All values already exist",
            );
        }

        showInsert = false;
        insertValue = "";
    }

    function handleSearch() {
        const target = searchInput.trim();
        if ($hashIsEmpty || !target) return;
        searchHash(target);
    }

    function handleSearchKeydown(e) {
        if (e.key === "Enter") {
            e.preventDefault();
            handleSearch();
        }
    }

    function handleSave() {
        const snap = getSnapshotHash();
        const blob = new Blob([JSON.stringify(snap, null, 2)], {
            type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "structura-hash-save.json";
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Saved successfully");
    }

    function handleLoad() {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json";
        input.onchange = (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const snap = JSON.parse(
                        /** @type {string} */ (ev.target?.result),
                    );
                    pushHistory();
                    applySnapshotHash(snap);
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
        window.addEventListener("hash:insert", onInsertEvent);
        return () => {
            window.removeEventListener("hash:insert", onInsertEvent);
        };
    });

    /** @param {KeyboardEvent} e */
    function onKeydown(e) {
        if (isTypingTarget(e) || e.repeat) return;

        if ((e.ctrlKey || e.metaKey) && !e.altKey) {
            const key = e.key.toLowerCase();
            if (key === "s") {
                e.preventDefault();
                if (!$hashIsEmpty) handleSave();
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
        if ($hashCapacity === 0) return;
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
        <Tooltip text="Create new hash table">
            <button class="btn btn-secondary" onclick={handleNew}>
                <Icon name="new" />
                New
            </button>
        </Tooltip>

        <Tooltip text={$hashCapacity === 0 ? "Create a hash table first" : "Insert value"} shortcut="N">
            <button class="btn btn-primary" onclick={handleInsertOpen} disabled={$hashCapacity === 0}>
                <Icon name="plus" />
                Insert
            </button>
        </Tooltip>

        <div class="separator"></div>

        <Tooltip text="Search value">
            <input
                class="traversal-select traversal-search-input"
                type="text"
                placeholder="Search…"
                bind:value={searchInput}
                onkeydown={handleSearchKeydown}
                disabled={$hashIsEmpty}
            />
        </Tooltip>

        <Tooltip text="Search">
            <button
                class="btn btn-icon"
                aria-label="Search"
                onclick={handleSearch}
                disabled={$hashIsEmpty || !searchInput.trim()}
            >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="6" cy="6" r="4" stroke="currentColor" stroke-width="1.4" />
                    <path d="M9.2 9.2L12 12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
                </svg>
            </button>
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
                disabled={$hashIsEmpty}
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
                <span class="modal-title">New Hash Table</span>
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
                    Start a new hash table? All unsaved work will be lost.
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

<!-- New Hash Table Modal -->
{#if showNewHash}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-overlay" onmousedown={() => (showNewHash = false)}>
        <div class="modal" onmousedown={(e) => e.stopPropagation()}>
            <div class="modal-header">
                <span class="modal-title">New Hash Table</span>
                <button
                    class="close-btn"
                    aria-label="Close"
                    onclick={() => (showNewHash = false)}
                >
                    <Icon name="close" size={14} />
                </button>
            </div>
            <div class="modal-body">
                <div class="field">
                    <label for="hash-capacity">Bucket count (1–20)</label>
                    <input
                        id="hash-capacity"
                        type="number"
                        bind:value={newCapacity}
                        bind:this={capacityInputEl}
                        onkeydown={(e) => e.key === "Enter" && confirmNewHash()}
                        min="1"
                        max="20"
                    />
                </div>
            </div>
            <div class="modal-footer">
                <button
                    class="btn btn-secondary"
                    onclick={() => (showNewHash = false)}>Cancel</button
                >
                <button class="btn btn-primary" onclick={confirmNewHash}
                    >Create</button
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
                    <label for="hash-insert-value">Value</label>
                    <input
                        id="hash-insert-value"
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
    .traversal-select:disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }
    .traversal-search-input {
        width: 100px;
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
