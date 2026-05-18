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
        linkedStackNodes,
        linkedStackIsEmpty,
        pushLinkedStack,
        popLinkedStack,
        peekLinkedStack,
        garbageCollectLinkedStack,
        clearLinkedStack,
        getSnapshotLinkedStack,
        applySnapshotLinkedStack,
    } from "../../stores/stack/graphLinkedStack.js";

    // Register history handlers
    registerHistoryHandlers(getSnapshotLinkedStack, applySnapshotLinkedStack);
    import { clearLogLinkedStack } from "../../stores/shared/linkedStackLog.js";
    import { toast } from "../../stores/shared/toast.js";

    const {
        zoom = 1,
        zoomIn,
        zoomOut,
        zoomReset,
        codeHidden = false,
        ontoggleCode,
        onopenShortcuts,
    } = $props();

    let showPush = $state(false);
    let pushValue = $state("");
    let pushInputEl = $state();

    let zoomPct = $derived(Math.round(zoom * 100) + "%");

    function handlePush() {
        showPush = true;
        pushValue = "";
        setTimeout(() => pushInputEl?.focus(), 50);
    }

    function confirmPush() {
        if (!pushValue.trim()) {
            toast.error("Value cannot be empty");
            return;
        }
        pushHistory();
        pushLinkedStack(pushValue.trim());
        pushHistory();
        toast.success(`Pushed "${pushValue.trim()}"`);
        showPush = false;
        pushValue = "";
    }

    function handlePop() {
        if ($linkedStackIsEmpty) {
            toast.error("Stack underflow — stack is empty");
            return;
        }
        pushHistory();
        popLinkedStack();
        pushHistory();
        toast.success("Popped top node");
    }

    function handlePeek() {
        if ($linkedStackIsEmpty) {
            toast.error("Stack is empty");
            return;
        }
        peekLinkedStack();
    }

    function handleGC() {
        pushHistory();
        garbageCollectLinkedStack();
        pushHistory();
    }

    let showConfirmNew = $state(false);

    function handleNewStack() {
        if ($linkedStackNodes.length > 0) {
            showConfirmNew = true;
        } else {
            confirmNewStack();
        }
    }

    function confirmNewStack() {
        clearLinkedStack();
        clearLogLinkedStack();
        initHistory();
        showConfirmNew = false;
        toast.success("Stack cleared");
    }

    function handleSave() {
        const snap = getSnapshotLinkedStack();
        const blob = new Blob([JSON.stringify(snap, null, 2)], {
            type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "structura-linked-stack-save.json";
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
                    applySnapshotLinkedStack(snap);
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
        const onPush = () => handlePush();
        const onPop = () => handlePop();
        window.addEventListener("linkedstack:push", onPush);
        window.addEventListener("linkedstack:pop", onPop);
        return () => {
            window.removeEventListener("linkedstack:push", onPush);
            window.removeEventListener("linkedstack:pop", onPop);
        };
    });
</script>

<div class="toolbar">
    <div class="brand">
        <BrandLogo />
        <span class="brand-name">Structura</span>
    </div>

    <div class="actions">
        <Tooltip text="Clear stack">
            <button class="btn btn-secondary" onclick={handleNewStack}>
                <Icon name="new" />
                New
            </button>
        </Tooltip>

        <div class="separator"></div>

        <Tooltip text="Push node onto stack">
            <button class="btn btn-primary" onclick={handlePush}>
                <Icon name="push" />
                Push
            </button>
        </Tooltip>

        <Tooltip
            text={$linkedStackIsEmpty
                ? "Stack is empty"
                : "Pop top node from stack"}
        >
            <button
                class="btn btn-primary"
                onclick={handlePop}
                disabled={$linkedStackIsEmpty}
            >
                <Icon name="pop" />
                Pop
            </button>
        </Tooltip>

        <Tooltip
            text={$linkedStackIsEmpty ? "Stack is empty" : "Peek top node"}
        >
            <button
                class="btn btn-secondary"
                onclick={handlePeek}
                disabled={$linkedStackIsEmpty}
            >
                <Icon name="peek" />
                Peek
            </button>
        </Tooltip>

        <Tooltip text="Run Garbage Collection">
            <button class="btn btn-gc" onclick={handleGC}>
                <Icon name="gc" />
                Run GC
            </button>
        </Tooltip>

        <div class="separator"></div>

        <Tooltip text="Zoom out" shortcut="Scroll ↓">
            <button
                class="btn btn-icon"
                aria-label="Zoom out"
                onclick={zoomOut}
            >
                <Icon name="zoomOut" />
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

        <Tooltip text="Save to file">
            <button class="btn btn-secondary" onclick={handleSave}>
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

        <Tooltip text={codeHidden ? "Show code panel" : "Hide code panel"}>
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
                <span class="modal-title">New Stack</span>
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
                    Start a new stack? All unsaved work will be lost.
                </p>
            </div>
            <div class="modal-footer">
                <button
                    class="btn btn-secondary"
                    onclick={() => (showConfirmNew = false)}>Cancel</button
                >
                <button class="btn btn-primary" onclick={confirmNewStack}
                    >Confirm</button
                >
            </div>
        </div>
    </div>
{/if}

<!-- Push Modal -->
{#if showPush}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-overlay" onmousedown={() => (showPush = false)}>
        <div class="modal modal-sm" onmousedown={(e) => e.stopPropagation()}>
            <div class="modal-header">
                <span class="modal-title">Push value</span>
                <button
                    class="close-btn"
                    aria-label="Close"
                    onclick={() => (showPush = false)}
                >
                    <Icon name="close" size={14} />
                </button>
            </div>
            <div class="modal-body">
                <div class="field">
                    <label for="push-value">Value</label>
                    <input
                        id="push-value"
                        bind:this={pushInputEl}
                        bind:value={pushValue}
                        onkeydown={(e) =>
                            e.key === "Enter" && confirmPush()}
                        placeholder="Enter value..."
                        spellcheck="false"
                    />
                </div>
            </div>
            <div class="modal-footer">
                <button
                    class="btn btn-secondary"
                    onclick={() => (showPush = false)}>Cancel</button
                >
                <button class="btn btn-primary" onclick={confirmPush}
                    >Push</button
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
