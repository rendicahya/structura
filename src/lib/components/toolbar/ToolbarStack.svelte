<script>
    import { onMount, onDestroy } from "svelte";

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
        stackCapacity,
        stackIsFull,
        stackIsEmpty,
        pushStack,
        popStack,
        initStack,
        getSnapshotStack,
        applySnapshotStack,
        clearStack,
    } from "../../stores/stack/graphStack.js";
    import {
        expressionState,
        startConvert,
        startEvaluate,
        stepForward as stepExpressionForward,
        playPause as playPauseExpression,
        stopExpression,
        resetExpression,
        setExpressionSpeed,
    } from "../../stores/stack/stackExpression.js";

    // Register history handlers
    registerHistoryHandlers(getSnapshotStack, applySnapshotStack);
    import { clearLogStack } from "../../stores/shared/stackLog.js";
    import { toast } from "../../stores/shared/toast.js";
    import { isTypingTarget } from "../../utils/keyboard.js";

    // The expression-playback interval is module-level state (see
    // stackExpression.js) and would otherwise keep ticking in the
    // background after navigating away from this page.
    onDestroy(() => {
        stopExpression();
    });

    let expressionActive = $derived($expressionState.tokens.length > 0);
    let expressionRunning = $derived(expressionActive && !$expressionState.done);

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
    let showNewStack = $state(false);
    let showPush = $state(false);
    let pushValue = $state("");
    let newCapacity = $state(5);
    let capacityInputEl = $state();

    let showConvert = $state(false);
    let showEvaluate = $state(false);
    let convertValue = $state("");
    let evaluateValue = $state("");
    let convertInputEl = $state();
    let evaluateInputEl = $state();

    function openNewStackModal() {
        showNewStack = true;
        setTimeout(() => {
            capacityInputEl?.focus();
            capacityInputEl?.select();
        }, 50);
    }

    function handleNewStack() {
        if (expressionRunning) {
            toast.error("Stop the expression demo first");
            return;
        }
        if (!$stackIsEmpty) {
            showConfirmNew = true;
        } else {
            openNewStackModal();
        }
    }

    function confirmNewStackActual() {
        showConfirmNew = false;
        openNewStackModal();
    }

    function confirmNewStack() {
        if (newCapacity < 1 || newCapacity > 20) {
            toast.error("Capacity must be between 1 and 20");
            return;
        }
        resetExpression();
        clearStack();
        clearLogStack();
        initHistory();
        initStack(newCapacity, "stack", "String");
        showNewStack = false;
        toast.success(`Stack created with capacity ${newCapacity}`);
    }

    function handleConvert() {
        showConvert = true;
        convertValue = "";
        setTimeout(() => convertInputEl?.focus(), 50);
    }

    function confirmConvert() {
        if (!convertValue.trim()) {
            toast.error("Enter an infix expression first");
            return;
        }
        startConvert(convertValue);
        showConvert = false;
    }

    function handleEvaluate() {
        showEvaluate = true;
        evaluateValue = "";
        setTimeout(() => evaluateInputEl?.focus(), 50);
    }

    function confirmEvaluate() {
        if (!evaluateValue.trim()) {
            toast.error("Enter a postfix expression first");
            return;
        }
        startEvaluate(evaluateValue);
        showEvaluate = false;
    }

    function handlePlayPauseExpression() {
        playPauseExpression();
    }

    function handleSpeedChangeExpression(e) {
        setExpressionSpeed(Number(e.currentTarget.value));
    }

    function handlePush() {
        if (expressionRunning) {
            toast.error("Stop the expression demo first");
            return;
        }
        if ($stackIsFull) {
            toast.error("Stack overflow — stack is full");
            return;
        }
        showPush = true;
        pushValue = "";
        setTimeout(() => pushInputEl?.focus(), 50);
    }

    function confirmPush() {
        if (!pushValue.trim()) {
            toast.error("Value cannot be empty");
            return;
        }

        const values = pushValue
            .split(",")
            .map((v) => v.trim())
            .filter((v) => v !== "");
        if (values.length === 0) {
            toast.error("Value cannot be empty");
            return;
        }

        pushHistory();
        let pushedCount = 0;
        for (const val of values) {
            if ($stackIsFull) {
                if (pushedCount > 0) {
                    toast.warning(
                        `Only ${pushedCount} elements pushed. Stack is full.`,
                    );
                } else {
                    toast.error("Stack overflow — stack is full");
                }
                break;
            }
            const ok = pushStack(val);
            if (ok) pushedCount++;
        }

        if (pushedCount > 0) {
            pushHistory();
            if (pushedCount > 1) {
                toast.success(`Pushed ${pushedCount} elements`);
            } else {
                toast.success(`Pushed "${values[0]}"`);
            }
        }

        showPush = false;
        pushValue = "";
    }

    function handlePop() {
        if (expressionRunning) {
            toast.error("Stop the expression demo first");
            return;
        }
        if ($stackIsEmpty) {
            toast.error("Stack underflow — stack is empty");
            return;
        }

        pushHistory();
        popStack();
        pushHistory();
        toast.success("Popped top element");
    }

    function handleSave() {
        const snap = getSnapshotStack();
        const blob = new Blob([JSON.stringify(snap, null, 2)], {
            type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "structura-stack-save.json";
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
                    resetExpression();
                    pushHistory();
                    applySnapshotStack(snap);
                    toast.success("Loaded successfully");
                } catch {
                    toast.error("Invalid save file");
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    let pushInputEl = $state();
    let zoomPct = $derived(Math.round(zoom * 100) + "%");

    onMount(() => {
        const onPush = () => handlePush();
        const onPop = () => handlePop();
        window.addEventListener("stack:push", onPush);
        window.addEventListener("stack:pop", onPop);
        return () => {
            window.removeEventListener("stack:push", onPush);
            window.removeEventListener("stack:pop", onPop);
        };
    });

    /** @param {KeyboardEvent} e */
    function onKeydown(e) {
        if (isTypingTarget(e) || e.repeat) return;

        if ((e.ctrlKey || e.metaKey) && !e.altKey) {
            const key = e.key.toLowerCase();
            if (key === "s") {
                e.preventDefault();
                handleSave();
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
        if ($stackCapacity === 0) return;
        if (e.key.toLowerCase() === "n") {
            e.preventDefault();
            handlePush();
        } else if (e.key.toLowerCase() === "m") {
            e.preventDefault();
            handlePop();
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
        <Tooltip text="Create new stack">
            <button class="btn btn-secondary" onclick={handleNewStack} disabled={expressionRunning}>
                <Icon name="new" />
                New Stack
            </button>
        </Tooltip>

        <div class="separator"></div>

        <Tooltip text="Convert an infix expression to postfix">
            <button class="btn btn-secondary" onclick={handleConvert} disabled={expressionRunning}>
                Infix → Postfix
            </button>
        </Tooltip>

        <Tooltip text="Evaluate a postfix expression">
            <button class="btn btn-secondary" onclick={handleEvaluate} disabled={expressionRunning}>
                Evaluate Postfix
            </button>
        </Tooltip>

        {#if expressionActive}
            <Tooltip text={$expressionState.playing ? "Pause" : "Play"}>
                <button
                    class="btn btn-icon"
                    aria-label={$expressionState.playing ? "Pause" : "Play"}
                    onclick={handlePlayPauseExpression}
                    disabled={$expressionState.done}
                >
                    {#if $expressionState.playing}
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

            <Tooltip text="Step forward">
                <button
                    class="btn btn-icon"
                    aria-label="Step forward"
                    onclick={stepExpressionForward}
                    disabled={$expressionState.playing || $expressionState.done}
                >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M3 2.7v8.6c0 .6.6.9 1.1.6l5.4-4.3c.4-.3.4-1 0-1.3L4.1 2c-.5-.3-1.1 0-1.1.7z" fill="currentColor" />
                        <rect x="9.5" y="2" width="2" height="10" rx="1" fill="currentColor" />
                    </svg>
                </button>
            </Tooltip>

            <Tooltip text="Stop expression demo">
                <button class="btn btn-icon" aria-label="Stop expression demo" onclick={stopExpression}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <rect x="3" y="3" width="8" height="8" rx="1.5" fill="currentColor" />
                    </svg>
                </button>
            </Tooltip>

            <Tooltip text="Playback speed">
                <select
                    class="traversal-select traversal-speed"
                    value={$expressionState.speed}
                    onchange={handleSpeedChangeExpression}
                >
                    <option value="1400">0.5x</option>
                    <option value="700">1x</option>
                    <option value="350">2x</option>
                </select>
            </Tooltip>
        {/if}

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

        <Tooltip text="Save to file" shortcut="Ctrl+S">
            <button class="btn btn-secondary" onclick={handleSave}>
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
                <span class="modal-title">New Stack</span>
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
                    Start a new stack? All unsaved work will be lost.
                </p>
            </div>
            <div class="modal-footer">
                <button
                    class="btn btn-secondary"
                    onclick={() => (showConfirmNew = false)}>Cancel</button
                >
                <button class="btn btn-primary" onclick={confirmNewStackActual}
                    >Confirm</button
                >
            </div>
        </div>
    </div>
{/if}

<!-- New Stack Modal -->
{#if showNewStack}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-overlay" onmousedown={() => (showNewStack = false)}>
        <div class="modal" onmousedown={(e) => e.stopPropagation()}>
            <div class="modal-header">
                <span class="modal-title">New Stack</span>
                <button
                    class="close-btn"
                    aria-label="Close"
                    onclick={() => (showNewStack = false)}
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
                <div class="field">
                    <label for="stack-capacity">Capacity (1–20)</label>
                    <input
                        id="stack-capacity"
                        type="number"
                        bind:value={newCapacity}
                        bind:this={capacityInputEl}
                        onkeydown={(e) => e.key === "Enter" && confirmNewStack()}
                        min="1"
                        max="20"
                    />
                </div>
            </div>
            <div class="modal-footer">
                <button
                    class="btn btn-secondary"
                    onclick={() => (showNewStack = false)}>Cancel</button
                >
                <button class="btn btn-primary" onclick={confirmNewStack}
                    >Create</button
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

<!-- Infix -> Postfix Modal -->
{#if showConvert}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-overlay" onmousedown={() => (showConvert = false)}>
        <div class="modal" onmousedown={(e) => e.stopPropagation()}>
            <div class="modal-header">
                <span class="modal-title">Infix → Postfix</span>
                <button
                    class="close-btn"
                    aria-label="Close"
                    onclick={() => (showConvert = false)}
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
                <div class="field">
                    <label for="convert-value">Infix expression</label>
                    <input
                        id="convert-value"
                        bind:this={convertInputEl}
                        bind:value={convertValue}
                        onkeydown={(e) => e.key === "Enter" && confirmConvert()}
                        placeholder="e.g. A+B*(C-D)"
                        spellcheck="false"
                    />
                </div>
            </div>
            <div class="modal-footer">
                <button
                    class="btn btn-secondary"
                    onclick={() => (showConvert = false)}>Cancel</button
                >
                <button class="btn btn-primary" onclick={confirmConvert}
                    >Convert</button
                >
            </div>
        </div>
    </div>
{/if}

<!-- Evaluate Postfix Modal -->
{#if showEvaluate}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-overlay" onmousedown={() => (showEvaluate = false)}>
        <div class="modal" onmousedown={(e) => e.stopPropagation()}>
            <div class="modal-header">
                <span class="modal-title">Evaluate Postfix</span>
                <button
                    class="close-btn"
                    aria-label="Close"
                    onclick={() => (showEvaluate = false)}
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
                <div class="field">
                    <label for="evaluate-value">Postfix expression (space-separated)</label>
                    <input
                        id="evaluate-value"
                        bind:this={evaluateInputEl}
                        bind:value={evaluateValue}
                        onkeydown={(e) => e.key === "Enter" && confirmEvaluate()}
                        placeholder="e.g. 3 4 + 5 *"
                        spellcheck="false"
                    />
                </div>
            </div>
            <div class="modal-footer">
                <button
                    class="btn btn-secondary"
                    onclick={() => (showEvaluate = false)}>Cancel</button
                >
                <button class="btn btn-primary" onclick={confirmEvaluate}
                    >Evaluate</button
                >
            </div>
        </div>
    </div>
{/if}

<style>
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
        width: 260px;
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
