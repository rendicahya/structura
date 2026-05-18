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
        resetCanvas,
        createNode,
        addNode,
        getSnapshot,
        applySnapshot,
        garbageCollect,
        initNodeClass,
        nodes,
        unreachableCount,
        arrangeNodes,
    } from "../../stores/sll/graph.js";
    import { clearLog } from "../../stores/sll/sllLog.js";
    import { clearLogDLL } from "../../stores/dll/dllLog.js";
    import {
        resetCanvasDLL,
        unreachableCountDLL,
        initNodeClassDLL,
        createNodeDLL,
        addNodeDLL,
        getSnapshotDLL,
        applySnapshotDLL,
        garbageCollectDLL,
        nodesDLL,
        arrangeNodesDLL,
    } from "../../stores/dll/graphDLL.js";
    import { toast } from "../../stores/shared/toast.js";

    const {
        mode = "sll",
        zoom = 1,
        zoomIn,
        zoomOut,
        zoomReset,
        codeHidden = false,
        ontoggleCode,
        onopenShortcuts,
    } = $props();

    let isSLL = $derived(mode === "sll");
    let currentNodes = $derived(isSLL ? $nodes : $nodesDLL);
    let modeLabel = $derived(isSLL ? "Linked List" : "Doubly Linked List");
    let gcCount = $derived(isSLL ? $unreachableCount : $unreachableCountDLL);
    let zoomPct = $derived(Math.round(zoom * 100) + "%");

    let showConfirmNew = $state(false);

    // Register history handlers
    $effect(() => {
        if (isSLL) {
            registerHistoryHandlers(getSnapshot, applySnapshot);
        } else {
            registerHistoryHandlers(getSnapshotDLL, applySnapshotDLL);
        }
    });

    function handleArrange() {
        pushHistory();
        if (isSLL) arrangeNodes();
        else arrangeNodesDLL();
        pushHistory();
    }

    function handleAddNode() {
        pushHistory();
        if (isSLL) {
            const node = createNode(
                80 + Math.random() * 400,
                80 + Math.random() * 300,
            );
            addNode(node);
        } else {
            const node = createNodeDLL(
                80 + Math.random() * 400,
                80 + Math.random() * 300,
            );
            addNodeDLL(node);
        }
        pushHistory();
    }

    function handleNewCanvas() {
        if (currentNodes.length > 0) {
            showConfirmNew = true;
        } else {
            confirmNewCanvas();
        }
    }

    function confirmNewCanvas() {
        if (isSLL) {
            resetCanvas();
            clearLog();
            initHistory();
            initNodeClass();
        } else {
            resetCanvasDLL();
            clearLogDLL();
            initHistory();
            initNodeClassDLL();
        }
        showConfirmNew = false;
    }

    function handleGC() {
        pushHistory();

        if (isSLL) garbageCollect();
        else garbageCollectDLL();

        pushHistory();
    }

    function handleSave() {
        const snap = isSLL ? getSnapshot() : getSnapshotDLL();
        snap._type = mode;
        const blob = new Blob([JSON.stringify(snap, null, 2)], {
            type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `structura-${mode}-save.json`;
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
                    pushHistory();
                    if (isSLL) applySnapshot(snap);
                    else applySnapshotDLL(snap);
                    toast.success("Loaded successfully");
                } catch {
                    toast.error("Invalid save file");
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }
</script>

<div class="toolbar">
    <div class="brand">
        <BrandLogo />
        <span class="brand-name">Structura</span>
    </div>

    <div class="actions">
        <button class="btn btn-primary" onclick={handleAddNode}>
            <Icon name="plus" />
            Add Node
        </button>

        <Tooltip text="Auto-arrange all nodes in a row">
            <button
                class="btn btn-secondary"
                onclick={handleArrange}
                disabled={currentNodes.length === 0}
            >
                <Icon name="arrange" />
                Arrange
            </button>
        </Tooltip>

        <Tooltip
            text={gcCount > 0
                ? `Run Garbage Collector (${gcCount} Collectable Node${gcCount > 1 ? "s" : ""})`
                : "Run Garbage Collector (Nothing to Collect)"}
        >
            <button class="btn btn-gc" onclick={handleGC}>
                <Icon name="gc" />
                Run GC
                {#if gcCount > 0}
                    <span class="gc-badge">{gcCount}</span>
                {/if}
            </button>
        </Tooltip>

        <div class="separator"></div>

        <Tooltip text="Zoom Out" shortcut="Scroll ↓">
            <button
                class="btn btn-icon"
                aria-label="Zoom out"
                onclick={zoomOut}
            >
                <Icon name="zoomOut" />
            </button>
        </Tooltip>

        <Tooltip text="Reset Zoom">
            <button
                class="zoom-label"
                aria-label="Reset zoom"
                onclick={zoomReset}>{zoomPct}</button
            >
        </Tooltip>

        <Tooltip text="Zoom In" shortcut="Scroll ↑">
            <button class="btn btn-icon" aria-label="Zoom in" onclick={zoomIn}>
                <Icon name="zoomIn" />
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
                <Icon name="undo" />
            </button>
        </Tooltip>

        <Tooltip text="Redo" shortcut="Ctrl+Y">
            <button
                class="btn btn-icon"
                aria-label="Redo"
                onclick={redo}
                disabled={!$canRedo}
            >
                <Icon name="redo" />
            </button>
        </Tooltip>

        <div class="separator"></div>

        <Tooltip text="New Canvas">
            <button
                class="btn btn-secondary"
                onclick={handleNewCanvas}
                disabled={currentNodes.length === 0}
            >
                <Icon name="new" />
                New
            </button>
        </Tooltip>

        <Tooltip text="Save to file">
            <button
                class="btn btn-secondary"
                onclick={handleSave}
                disabled={currentNodes.length === 0}
            >
                <Icon name="save" />
                Save
            </button>
        </Tooltip>

        <Tooltip text="Load from file">
            <button class="btn btn-secondary" onclick={handleLoad}>
                <Icon name="load" />
                Load
            </button>
        </Tooltip>

        <div class="separator"></div>

        <Tooltip text={codeHidden ? "Show Code Panel" : "Hide Code Panel"}>
            <button
                class="btn btn-icon"
                aria-label={codeHidden ? "Show code panel" : "Hide code panel"}
                class:active={codeHidden}
                onclick={() => ontoggleCode?.()}
            >
                <Icon name="code" {codeHidden} />
            </button>
        </Tooltip>

        <Tooltip text="Keyboard Shortcuts" shortcut="?">
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
                <span class="modal-title">New Canvas</span>
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
                    Start a new canvas? All unsaved work will be lost.
                </p>
            </div>
            <div class="modal-footer">
                <button
                    class="btn btn-secondary"
                    onclick={() => (showConfirmNew = false)}>Cancel</button
                >
                <button class="btn btn-primary" onclick={confirmNewCanvas}
                    >Confirm</button
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
        background: var(--surface);
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
    .btn-gc:hover {
        background: rgba(78, 204, 163, 0.22);
        box-shadow: 0 0 12px rgba(78, 204, 163, 0.2);
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
    .gc-badge {
        background: rgba(78, 204, 163, 0.25);
        color: var(--success);
        border-radius: 10px;
        font-size: 11px;
        font-weight: 700;
        padding: 1px 6px;
        font-family: var(--font-mono);
        border: 1px solid rgba(78, 204, 163, 0.4);
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
    }
    .confirm-text {
        font-family: var(--font-ui);
        font-size: 13px;
        color: var(--text-dim);
        line-height: 1.5;
        margin: 0;
    }
    .modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding: 12px 20px;
        border-top: 1px solid var(--border);
    }
</style>
