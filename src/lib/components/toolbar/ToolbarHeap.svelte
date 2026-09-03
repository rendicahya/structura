<script>
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
        heapItems,
        heapCapacity,
        heapMode,
        heapIsEmpty,
        heapIsFull,
        insertHeap,
        extractRoot,
        initHeap,
        clearHeap,
        getSnapshotHeap,
        applySnapshotHeap,
    } from "../../stores/heap/graphHeap.js";
    import { clearLogHeap } from "../../stores/shared/heapLog.js";
    import { toast } from "../../stores/shared/toast.js";
    import { downloadStructure, pickStructureFile, requestLoad } from "../../utils/saveLoad.js";
    import { onMount } from "svelte";
    import { isTypingTarget } from "../../utils/keyboard.js";

    // Register history handlers
    registerHistoryHandlers(getSnapshotHeap, applySnapshotHeap);

    const {
        zoom = 1,
        zoomIn,
        zoomOut,
        zoomReset,
    } = $props();

    let showConfirmNew = $state(false);
    let showNewHeap = $state(false);
    let newCapacity = $state(15);
    let newMode = $state("min");
    let capacityInputEl = $state();

    let showInsert = $state(false);
    let insertValue = $state("");
    let insertInputEl = $state();

    let zoomPct = $derived(Math.round(zoom * 100) + "%");

    function openNewHeapModal() {
        showNewHeap = true;
        setTimeout(() => {
            capacityInputEl?.focus();
            capacityInputEl?.select();
        }, 50);
    }

    function handleNew() {
        if (!$heapIsEmpty) {
            showConfirmNew = true;
        } else {
            openNewHeapModal();
        }
    }

    function confirmNewActual() {
        showConfirmNew = false;
        openNewHeapModal();
    }

    function confirmNewHeap() {
        if (newCapacity < 1 || newCapacity > 20) {
            toast.error("Capacity must be between 1 and 20");
            return;
        }
        clearHeap();
        clearLogHeap();
        initHistory();
        initHeap(newCapacity, "heap", newMode);
        showNewHeap = false;
        toast.success(`Heap created with capacity ${newCapacity}`);
    }

    function handleInsertOpen() {
        if ($heapCapacity === 0) return;
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
        let invalid = 0;
        let full = 0;
        for (const val of values) {
            const status = insertHeap(val);
            if (status === "ok") inserted++;
            else if (status === "invalid") invalid++;
            else if (status === "full") full++;
        }
        pushHistory();

        if (inserted > 0) {
            const parts = [];
            if (invalid > 0) parts.push(`${invalid} invalid`);
            if (full > 0) parts.push(`${full} skipped (full)`);
            toast.success(
                `Inserted ${inserted} value${inserted > 1 ? "s" : ""}${parts.length ? `, ${parts.join(", ")}` : ""}`,
            );
        } else if (full > 0) {
            toast.error("Heap is full");
        } else {
            toast.error("Enter valid numeric value(s)");
        }

        showInsert = false;
        insertValue = "";
    }

    function handleExtract() {
        if ($heapIsEmpty) {
            toast.error("Heap is empty");
            return;
        }
        pushHistory();
        const value = extractRoot();
        pushHistory();
        toast.success(`Extracted ${value} (${$heapMode})`);
    }

    function handleSave() {
        downloadStructure("heap", getSnapshotHeap());
        toast.success("Saved successfully");
    }

    function handleLoad() {
        pickStructureFile((snap) => {
            if (!snap) return toast.error("Invalid .stc file");
            requestLoad(snap);
        });
    }

    onMount(() => {
        const onInsertEvent = () => handleInsertOpen();
        const onExtractEvent = () => handleExtract();
        window.addEventListener("heap:insert", onInsertEvent);
        window.addEventListener("heap:extract", onExtractEvent);
        return () => {
            window.removeEventListener("heap:insert", onInsertEvent);
            window.removeEventListener("heap:extract", onExtractEvent);
        };
    });

    /** @param {KeyboardEvent} e */
    function onKeydown(e) {
        if (isTypingTarget(e) || e.repeat) return;

        if ((e.ctrlKey || e.metaKey) && !e.altKey) {
            const key = e.key.toLowerCase();
            if (key === "s") {
                e.preventDefault();
                if (!$heapIsEmpty) handleSave();
            } else if (key === "o") {
                e.preventDefault();
                handleLoad();
            }
            return;
        }

        if (e.altKey) return;
        if ($heapCapacity === 0) return;
        if (e.key.toLowerCase() === "n") {
            e.preventDefault();
            handleInsertOpen();
        } else if (e.key.toLowerCase() === "m") {
            e.preventDefault();
            handleExtract();
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
        <Tooltip text={$heapCapacity === 0 ? "Create a heap first" : $heapIsFull ? "Heap is full" : "Insert value"} shortcut="N">
            <button
                class="btn btn-primary"
                onclick={handleInsertOpen}
                disabled={$heapCapacity === 0 || $heapIsFull}
            >
                <Icon name="plus" />
                Insert
            </button>
        </Tooltip>

        <Tooltip text={$heapIsEmpty ? "Heap is empty" : `Extract ${$heapMode === "min" ? "min" : "max"}`} shortcut="M">
            <button
                class="btn btn-secondary"
                onclick={handleExtract}
                disabled={$heapIsEmpty}
            >
                <Icon name="pop" />
                Extract {$heapMode === "min" ? "Min" : "Max"}
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

        <Tooltip text="Create new heap">
            <button class="btn btn-secondary" onclick={handleNew}>
                <Icon name="new" />
                New
            </button>
        </Tooltip>

        <Tooltip text="Save to file" shortcut="Ctrl+S">
            <button
                class="btn btn-secondary"
                onclick={handleSave}
                disabled={$heapIsEmpty}
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
    </div>
</div>

<!-- Confirm New Modal -->
{#if showConfirmNew}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-overlay" onmousedown={() => (showConfirmNew = false)}>
        <div class="modal modal-sm" onmousedown={(e) => e.stopPropagation()}>
            <div class="modal-header">
                <span class="modal-title">New Heap</span>
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
                    Start a new heap? All unsaved work will be lost.
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

<!-- New Heap Modal -->
{#if showNewHeap}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-overlay" onmousedown={() => (showNewHeap = false)}>
        <div class="modal" onmousedown={(e) => e.stopPropagation()}>
            <div class="modal-header">
                <span class="modal-title">New Heap</span>
                <button
                    class="close-btn"
                    aria-label="Close"
                    onclick={() => (showNewHeap = false)}
                >
                    <Icon name="close" size={14} />
                </button>
            </div>
            <div class="modal-body">
                <div class="field">
                    <label for="heap-capacity">Capacity (1–20)</label>
                    <input
                        id="heap-capacity"
                        type="number"
                        bind:value={newCapacity}
                        bind:this={capacityInputEl}
                        onkeydown={(e) => e.key === "Enter" && confirmNewHeap()}
                        min="1"
                        max="20"
                    />
                </div>
                <div class="field">
                    <span class="field-label">Mode</span>
                    <div class="radio-group">
                        <label class="radio-option">
                            <input
                                type="radio"
                                name="heap-mode"
                                value="min"
                                bind:group={newMode}
                            />
                            Min-Heap
                        </label>
                        <label class="radio-option">
                            <input
                                type="radio"
                                name="heap-mode"
                                value="max"
                                bind:group={newMode}
                            />
                            Max-Heap
                        </label>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button
                    class="btn btn-secondary"
                    onclick={() => (showNewHeap = false)}>Cancel</button
                >
                <button class="btn btn-primary" onclick={confirmNewHeap}
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
                    <label for="heap-insert-value">Value</label>
                    <input
                        id="heap-insert-value"
                        bind:this={insertInputEl}
                        bind:value={insertValue}
                        onkeydown={(e) => e.key === "Enter" && confirmInsert()}
                        placeholder="Enter number(s), comma-separated..."
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
    }    .zoom-label {
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
    .field label,
    .field-label {
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
    .radio-group {
        display: flex;
        gap: 16px;
    }
    .radio-option {
        display: flex;
        align-items: center;
        gap: 6px;
        font-family: var(--font-ui);
        font-size: 13px;
        color: var(--text);
        cursor: pointer;
    }
    .modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding: 12px 20px;
        border-top: 1px solid var(--border);
    }
</style>
