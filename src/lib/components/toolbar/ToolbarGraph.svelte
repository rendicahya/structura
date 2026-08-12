<script>
    import { onDestroy } from "svelte";
    import Tooltip from "../ui/Tooltip.svelte";
    import BrandLogo from "../ui/BrandLogo.svelte";
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
        graphNodes,
        graphIsEmpty,
        resetGraph,
        getSnapshotGraph,
        applySnapshotGraph,
        initGraph,
    } from "../../stores/graph/graphGraph.js";
    import { clearLogGraph } from "../../stores/shared/graphLog.js";
    import { toast } from "../../stores/shared/toast.js";
    import { isTypingTarget } from "../../utils/keyboard.js";
    import {
        traversalState,
        startTraversal,
        stepForward,
        stepBack,
        playPause,
        stopTraversal,
        resetTraversal,
        setTraversalSpeed,
    } from "../../stores/graph/graphTraversal.js";

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

    let startNodeName = $derived(
        $graphNodes.find((n) => n.id === $traversalState.startNodeId)?.varName ?? null,
    );

    // Register history handlers
    $effect(() => {
        registerHistoryHandlers(getSnapshotGraph, applySnapshotGraph);
    });

    // Navigating away from the Graph page unmounts this component, but the
    // traversal interval is module-level state and would otherwise keep
    // ticking in the background indefinitely.
    onDestroy(() => {
        stopTraversal();
    });

    function handleNew() {
        if ($graphNodes.length > 0) {
            showConfirmNew = true;
        } else {
            confirmNewActual();
        }
    }

    function confirmNewActual() {
        resetTraversal();
        resetGraph();
        clearLogGraph();
        initHistory();
        initGraph();
        showConfirmNew = false;
        toast.success("Graph cleared");
    }

    let traversalTypeChoice = $state("bfs");

    function handleTraversalTypeChange(e) {
        traversalTypeChoice = e.currentTarget.value;
    }

    function handlePlayPause() {
        if ($traversalState.order.length === 0) {
            if (!$traversalState.startNodeId) return;
            startTraversal(traversalTypeChoice);
        }
        playPause();
    }

    function handleStepForward() {
        if ($traversalState.order.length === 0) {
            if (!$traversalState.startNodeId) return;
            startTraversal(traversalTypeChoice);
        }
        stepForward();
    }

    function handleSpeedChange(e) {
        setTraversalSpeed(Number(e.currentTarget.value));
    }

    function handleSave() {
        const snap = getSnapshotGraph();
        const blob = new Blob([JSON.stringify(snap, null, 2)], {
            type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "structura-graph-save.json";
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
                    applySnapshotGraph(snap);
                    toast.success("Loaded successfully");
                } catch {
                    toast.error("Invalid save file");
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    /** @param {KeyboardEvent} e */
    function onKeydown(e) {
        if (isTypingTarget(e) || e.repeat) return;
        if (!(e.ctrlKey || e.metaKey) || e.altKey) return;

        const key = e.key.toLowerCase();
        if (key === "s") {
            e.preventDefault();
            if (!$graphIsEmpty) handleSave();
        } else if (key === "o") {
            e.preventDefault();
            handleLoad();
        } else if (e.key === "\\") {
            e.preventDefault();
            ontoggleCode?.();
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
        <Tooltip text="New graph">
            <button
                class="btn btn-secondary"
                onclick={handleNew}
                disabled={$graphIsEmpty}
            >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <rect
                        x="2"
                        y="2"
                        width="10"
                        height="10"
                        rx="2"
                        stroke="currentColor"
                        stroke-width="1.4"
                    />
                    <path
                        d="M5 7h4M7 5v4"
                        stroke="currentColor"
                        stroke-width="1.4"
                        stroke-linecap="round"
                    />
                </svg>
                New
            </button>
        </Tooltip>

        <div class="separator"></div>

        <Tooltip text={startNodeName ? `Start: ${startNodeName}` : "Click a node to pick a start"}>
            <span class="start-indicator" class:unset={!startNodeName}>
                {startNodeName ? `Start: ${startNodeName}` : "Pick a start node"}
            </span>
        </Tooltip>

        <Tooltip text="Traversal order">
            <select
                class="traversal-select"
                value={traversalTypeChoice}
                onchange={handleTraversalTypeChange}
                disabled={$graphIsEmpty}
            >
                <option value="bfs">BFS</option>
                <option value="dfs">DFS</option>
            </select>
        </Tooltip>

        <Tooltip text={$traversalState.playing ? "Pause" : "Play traversal"}>
            <button
                class="btn btn-icon"
                aria-label={$traversalState.playing ? "Pause" : "Play traversal"}
                onclick={handlePlayPause}
                disabled={$graphIsEmpty ||
                    !$traversalState.startNodeId ||
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
                disabled={$graphIsEmpty || $traversalState.playing || $traversalState.index <= -1}
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
                disabled={$graphIsEmpty ||
                    !$traversalState.startNodeId ||
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
                disabled={$graphIsEmpty}
            >
                <option value="1400">0.5x</option>
                <option value="700">1x</option>
                <option value="350">2x</option>
            </select>
        </Tooltip>

        <div class="separator"></div>

        <Tooltip text="Zoom out" shortcut="Scroll ↓">
            <button
                class="btn btn-icon"
                aria-label="Zoom out"
                onclick={zoomOut}
            >
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                    <circle
                        cx="6.5"
                        cy="6.5"
                        r="5"
                        stroke="currentColor"
                        stroke-width="1.4"
                    />
                    <path
                        d="M4.5 6.5h4"
                        stroke="currentColor"
                        stroke-width="1.4"
                        stroke-linecap="round"
                    />
                    <path
                        d="M10.5 10.5L13 13"
                        stroke="currentColor"
                        stroke-width="1.4"
                        stroke-linecap="round"
                    />
                </svg>
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
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                    <circle
                        cx="6.5"
                        cy="6.5"
                        r="5"
                        stroke="currentColor"
                        stroke-width="1.4"
                    />
                    <path
                        d="M4.5 6.5h4M6.5 4.5v4"
                        stroke="currentColor"
                        stroke-width="1.4"
                        stroke-linecap="round"
                    />
                    <path
                        d="M10.5 10.5L13 13"
                        stroke="currentColor"
                        stroke-width="1.4"
                        stroke-linecap="round"
                    />
                </svg>
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
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                        d="M3 6H10C12.2 6 14 7.8 14 10C14 12.2 12.2 14 10 14H5"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                    />
                    <path
                        d="M5.5 3.5L3 6L5.5 8.5"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    />
                </svg>
            </button>
        </Tooltip>
        <Tooltip text="Redo" shortcut="Ctrl+Y">
            <button
                class="btn btn-icon"
                aria-label="Redo"
                onclick={redo}
                disabled={!$canRedo}
            >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                        d="M13 6H6C3.8 6 2 7.8 2 10C2 12.2 3.8 14 6 14H11"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                    />
                    <path
                        d="M10.5 3.5L13 6L10.5 8.5"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    />
                </svg>
            </button>
        </Tooltip>

        <div class="separator"></div>

        <Tooltip text="Save to file" shortcut="Ctrl+S">
            <button
                class="btn btn-secondary"
                onclick={handleSave}
                disabled={$graphIsEmpty}
            >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path
                        d="M2 10V12H12V10"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                    />
                    <path
                        d="M7 2V9M4.5 6.5L7 9L9.5 6.5"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    />
                </svg>
                Save
            </button>
        </Tooltip>
        <Tooltip text="Load from file" shortcut="Ctrl+O">
            <button class="btn btn-secondary" onclick={handleLoad}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path
                        d="M2 10V12H12V10"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                    />
                    <path
                        d="M7 9V2M4.5 4.5L7 2L9.5 4.5"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    />
                </svg>
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
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                    <rect
                        x="1"
                        y="2"
                        width="13"
                        height="11"
                        rx="2"
                        stroke="currentColor"
                        stroke-width="1.4"
                    />
                    <line
                        x1="9"
                        y1="2"
                        x2="9"
                        y2="13"
                        stroke="currentColor"
                        stroke-width="1.4"
                    />
                    {#if codeHidden}
                        <path
                            d="M11 6l2 1.5-2 1.5"
                            stroke="currentColor"
                            stroke-width="1.3"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        />
                    {:else}
                        <path
                            d="M11 6l2 1.5-2 1.5"
                            stroke="currentColor"
                            stroke-width="1.3"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            opacity="0.4"
                        />
                    {/if}
                </svg>
            </button>
        </Tooltip>

        <Tooltip text="Keyboard shortcuts" shortcut="?">
            <button
                class="btn btn-icon"
                aria-label="Keyboard shortcuts"
                onclick={() => onopenShortcuts?.()}
            >
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                    <circle
                        cx="7.5"
                        cy="7.5"
                        r="5.5"
                        stroke="currentColor"
                        stroke-width="1.4"
                    />
                    <path
                        d="M5.5 6C5.5 4.9 6.3 4 7.5 4S9.5 4.9 9.5 6C9.5 7 8.5 7.5 7.5 8v1"
                        stroke="currentColor"
                        stroke-width="1.3"
                        stroke-linecap="round"
                    />
                    <circle cx="7.5" cy="10.5" r="0.6" fill="currentColor" />
                </svg>
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
                <span class="modal-title">New Graph</span>
                <button
                    class="close-btn"
                    aria-label="Close"
                    onclick={() => (showConfirmNew = false)}
                >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path
                            d="M2 2l10 10M12 2L2 12"
                            stroke="currentColor"
                            stroke-width="1.5"
                            stroke-linecap="round"
                        />
                    </svg>
                </button>
            </div>
            <div class="modal-body">
                <p class="confirm-text">
                    Start a new graph? All unsaved work will be lost.
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
    .start-indicator {
        font-family: var(--font-mono);
        font-size: 11px;
        font-weight: 600;
        color: var(--accent);
        background: var(--surface2);
        border: 1px solid var(--border);
        border-radius: 5px;
        padding: 5px 8px;
        white-space: nowrap;
    }
    .start-indicator.unset {
        color: var(--text-muted);
        font-weight: 500;
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
