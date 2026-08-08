<script>
    import { onMount } from "svelte";
    import { get } from "svelte/store";
    import { canvasZoom } from "./lib/stores/shared/canvasControl.js";
    import Toolbar from "./lib/components/toolbar/Toolbar.svelte";
    import ToolbarStack from "./lib/components/toolbar/ToolbarStack.svelte";
    import ToolbarLinkedStack from "./lib/components/toolbar/ToolbarLinkedStack.svelte";
    import ToolbarQueue from "./lib/components/toolbar/ToolbarQueue.svelte";
    import Canvas from "./lib/components/canvas/Canvas.svelte";
    import CanvasDLL from "./lib/components/canvas/CanvasDLL.svelte";
    import CanvasStack from "./lib/components/canvas/CanvasStack.svelte";
    import CanvasLinkedStack from "./lib/components/canvas/CanvasLinkedStack.svelte";
    import CanvasQueue from "./lib/components/canvas/CanvasQueue.svelte";
    import CodePanel from "./lib/components/code/CodePanel.svelte";
    import ToastContainer from "./lib/components/ui/ToastContainer.svelte";
    import ShortcutGuide from "./lib/components/ui/ShortcutGuide.svelte";
    import Icon from "./lib/components/ui/Icon.svelte";

    import { initHistory } from "./lib/stores/shared/history.js";
    import { codeLog } from "./lib/stores/sll/sllLog.js";
    import { initNodeClass } from "./lib/stores/sll/graph.js";
    import { codeLogDLL } from "./lib/stores/dll/dllLog.js";
    import { initNodeClassDLL } from "./lib/stores/dll/graphDLL.js";
    import { stackLog } from "./lib/stores/shared/stackLog.js";
    import { linkedStackLog } from "./lib/stores/shared/linkedStackLog.js";
    import { initNodeClassLinkedStack } from "./lib/stores/stack/graphLinkedStack.js";
    import { queueLog } from "./lib/stores/shared/queueLog.js";

    import ToolbarLinkedQueue from "./lib/components/toolbar/ToolbarLinkedQueue.svelte";
    import CanvasLinkedQueue from "./lib/components/canvas/CanvasLinkedQueue.svelte";
    import { linkedQueueLog } from "./lib/stores/shared/linkedQueueLog.js";
    import { initNodeClassLinkedQueue } from "./lib/stores/queue/graphLinkedQueue.js";

    import ToolbarTree from "./lib/components/toolbar/ToolbarTree.svelte";
    import CanvasTree from "./lib/components/canvas/CanvasTree.svelte";
    import { treeLog } from "./lib/stores/shared/treeLog.js";
    import { initTree } from "./lib/stores/tree/graphTree.js";

    import ToolbarGraph from "./lib/components/toolbar/ToolbarGraph.svelte";
    import CanvasGraph from "./lib/components/canvas/CanvasGraph.svelte";
    import { graphLog } from "./lib/stores/shared/graphLog.js";
    import { initGraph } from "./lib/stores/graph/graphGraph.js";

    // Proof of concept: same SLL store/toolbar/code-log as "#/linked-list",
    // only the canvas renderer differs (Svelte Flow instead of the
    // hand-rolled SVG canvas) — see plan for rationale.
    import CanvasSLLFlow from "./lib/components/canvas/CanvasSLLFlow.svelte";
    import CanvasDLLFlow from "./lib/components/canvas/CanvasDLLFlow.svelte";
    import CanvasStackFlow from "./lib/components/canvas/CanvasStackFlow.svelte";
    import CanvasLinkedStackFlow from "./lib/components/canvas/CanvasLinkedStackFlow.svelte";
    import CanvasQueueFlow from "./lib/components/canvas/CanvasQueueFlow.svelte";

    // The Svelte Flow SLL POC reached feature parity with the old
    // hand-rolled canvas, so the old tab is hidden from the nav (route,
    // component, and store are all still intact — just not linked to from
    // the tab bar). Flip back to true to bring the old tab back.
    const SHOW_OLD_SLL_TAB = false;
    // Same treatment for the old hand-rolled DLL canvas now that the Svelte
    // Flow DLL canvas is in place — route, component, and store stay intact.
    const SHOW_OLD_DLL_TAB = false;
    // Same treatment for the old hand-rolled Array Stack canvas now that the
    // Svelte Flow stack canvas is in place — route, component, and store
    // stay intact.
    const SHOW_OLD_STACK_TAB = false;
    // Same treatment for the old hand-rolled Linked-List Stack canvas now
    // that the Svelte Flow canvas is in place — route, component, and store
    // stay intact.
    const SHOW_OLD_LINKED_STACK_TAB = false;
    // Same treatment for the old hand-rolled Array Queue canvas now that the
    // Svelte Flow queue canvas is in place — route, component, and store
    // stay intact.
    const SHOW_OLD_QUEUE_TAB = false;

    onMount(() => {
        initHistory();

        if (!location.hash || location.hash === "#") {
            location.hash = SHOW_OLD_SLL_TAB ? "#/linked-list" : "#/linked-list-flow";
        }

        page = location.hash;

        const onHashChange = () => {
            page = location.hash;
        };

        window.addEventListener("hashchange", onHashChange);
        window.addEventListener("wheel", onWindowWheel, { passive: false });

        return () => {
            window.removeEventListener("hashchange", onHashChange);
            window.removeEventListener("wheel", onWindowWheel);
        };
    });

    let page = $state("#/linked-list");
    let showShortcuts = $state(false);
    let splitPos = $state(
        parseFloat(localStorage.getItem("structura-split") ?? "62"),
    );
    let codeHidden = $state(
        localStorage.getItem("structura-code-hidden") === "true",
    );

    let draggingSplitter = $state(false);
    let containerEl = $state();
    let zoom = $state(1);
    let canvasFitToView = $state(null);

    let theme = $state(localStorage.getItem("structura-theme") ?? "dark");

    const ZOOM_STEP = 0.1;

    $effect(() => {
        localStorage.setItem("structura-split", splitPos.toString());
        localStorage.setItem("structura-code-hidden", codeHidden.toString());
    });

    $effect(() => {
        if (theme === "light") {
            document.documentElement.classList.add("light-theme");
        } else {
            document.documentElement.classList.remove("light-theme");
        }
        localStorage.setItem("structura-theme", theme);
    });

    // GA4's automatic history-based page_view tracking doesn't catch this
    // app's direct `location.hash =` navigation (no pushState/popstate), so
    // page views are fired manually on every hash change instead.
    $effect(() => {
        if (typeof window.gtag === "function") {
            window.gtag("event", "page_view", {
                page_path: page,
                page_title: page.replace("#/", "") || "linked-list",
            });
        }
    });

    $effect(() => {
        if (page === "#/linked-list" || page === "#/linked-list-flow") {
            if (get(codeLog).length === 0) initNodeClass();
        } else if (
            page === "#/doubly-linked-list" ||
            page === "#/doubly-linked-list-flow"
        ) {
            if (get(codeLogDLL).length === 0) initNodeClassDLL();
        } else if (
            page === "#/linked-stack" ||
            page === "#/linked-stack-flow"
        ) {
            if (get(linkedStackLog).length === 0) initNodeClassLinkedStack();
        } else if (page === "#/linked-queue") {
            if (get(linkedQueueLog).length === 0) initNodeClassLinkedQueue();
        } else if (page === "#/tree") {
            if (get(treeLog).length === 0) initTree();
        } else if (page === "#/graph") {
            if (get(graphLog).length === 0) initGraph();
        }

        zoom = $canvasZoom;
    });

    function zoomIn() {
        zoom = Math.min(2, +(zoom + ZOOM_STEP).toFixed(2));
    }

    function zoomOut() {
        zoom = Math.max(0.3, +(zoom - ZOOM_STEP).toFixed(2));
    }

    function zoomReset() {
        zoom = 1;
        canvasFitToView?.();
    }

    function onSplitterMousedown(e) {
        draggingSplitter = true;
        e.preventDefault();
    }

    function onWindowMousemove(e) {
        if (!draggingSplitter || !containerEl) return;
        const rect = containerEl.getBoundingClientRect();
        let pct = ((e.clientX - rect.left) / rect.width) * 100;
        splitPos = Math.min(80, Math.max(30, pct));
    }

    function onWindowMouseup() {
        draggingSplitter = false;
    }

    function navigate(hash) {
        location.hash = hash;
        zoom = 1;
    }

    function onKeydown(e) {
        if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
            showShortcuts = !showShortcuts;
        }
    }

    function onWindowWheel(e) {
        if (!containerEl) return;
        const canvasPanel = containerEl.querySelector(".canvas-panel");
        if (!canvasPanel) return;
        const rect = canvasPanel.getBoundingClientRect();
        const isOverCanvas =
            e.clientX >= rect.left &&
            e.clientX <= rect.right &&
            e.clientY >= rect.top &&
            e.clientY <= rect.bottom;
        if (!isOverCanvas) return;

        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.1 : -0.1;
        zoom = Math.min(2, Math.max(0.3, +(zoom + delta).toFixed(2)));
    }
</script>

<svelte:window
    on:mousemove={onWindowMousemove}
    on:mouseup={onWindowMouseup}
    on:keydown={onKeydown}
/>

<div id="app">
    <!-- Nav tabs -->
    <nav class="page-nav">
        {#if SHOW_OLD_SLL_TAB}
            <button
                class="nav-tab"
                class:active={page === "#/linked-list"}
                onclick={() => navigate("#/linked-list")}
            >
                Singly-linked List (legacy canvas)
            </button>
        {/if}
        <button
            class="nav-tab"
            class:active={page === "#/linked-list-flow"}
            onclick={() => navigate("#/linked-list-flow")}
        >
            Singly-linked List
        </button>
        {#if SHOW_OLD_DLL_TAB}
            <button
                class="nav-tab"
                class:active={page === "#/doubly-linked-list"}
                onclick={() => navigate("#/doubly-linked-list")}
            >
                Doubly-linked List (legacy canvas)
            </button>
        {/if}
        <button
            class="nav-tab"
            class:active={page === "#/doubly-linked-list-flow"}
            onclick={() => navigate("#/doubly-linked-list-flow")}
        >
            Doubly-linked List
        </button>
        {#if SHOW_OLD_STACK_TAB}
            <button
                class="nav-tab"
                class:active={page === "#/stack"}
                onclick={() => navigate("#/stack")}
            >
                Array Stack (legacy canvas)
            </button>
        {/if}
        <button
            class="nav-tab"
            class:active={page === "#/stack-flow"}
            onclick={() => navigate("#/stack-flow")}
        >
            Array Stack
        </button>
        {#if SHOW_OLD_LINKED_STACK_TAB}
            <button
                class="nav-tab"
                class:active={page === "#/linked-stack"}
                onclick={() => navigate("#/linked-stack")}
            >
                Linked-List Stack (legacy canvas)
            </button>
        {/if}
        <button
            class="nav-tab"
            class:active={page === "#/linked-stack-flow"}
            onclick={() => navigate("#/linked-stack-flow")}
        >
            Linked-List Stack
        </button>
        {#if SHOW_OLD_QUEUE_TAB}
            <button
                class="nav-tab"
                class:active={page === "#/queue"}
                onclick={() => navigate("#/queue")}
            >
                Array Queue (legacy canvas)
            </button>
        {/if}
        <button
            class="nav-tab"
            class:active={page === "#/queue-flow"}
            onclick={() => navigate("#/queue-flow")}
        >
            Array Queue
        </button>
        <button
            class="nav-tab"
            class:active={page === "#/linked-queue"}
            onclick={() => navigate("#/linked-queue")}
        >
            Linked-List Queue
        </button>

        <button
            class="nav-tab"
            class:active={page === "#/tree"}
            onclick={() => navigate("#/tree")}
        >
            Binary Tree
        </button>

        <button
            class="nav-tab"
            class:active={page === "#/graph"}
            onclick={() => navigate("#/graph")}
        >
            Graph
        </button>

        <div class="nav-spacer"></div>

        <button
            class="theme-toggle"
            onclick={() => (theme = theme === "dark" ? "light" : "dark")}
            title="Toggle light/dark mode"
        >
            <Icon name={theme === "dark" ? "sun" : "moon"} size={16} />
        </button>
    </nav>

    {#if page === "#/linked-list" || page === "#/linked-list-flow" || page === "#/doubly-linked-list" || page === "#/doubly-linked-list-flow"}
        <Toolbar
            mode={page === "#/doubly-linked-list" || page === "#/doubly-linked-list-flow" ? "dll" : "sll"}
            {zoom}
            {zoomIn}
            {zoomOut}
            {zoomReset}
            {codeHidden}
            ontoggleCode={() => (codeHidden = !codeHidden)}
            onopenShortcuts={() => (showShortcuts = true)}
        />
    {:else if page === "#/stack" || page === "#/stack-flow"}
        <ToolbarStack
            {zoom}
            {zoomIn}
            {zoomOut}
            {zoomReset}
            {codeHidden}
            ontoggleCode={() => (codeHidden = !codeHidden)}
            onopenShortcuts={() => (showShortcuts = true)}
        />
    {:else if page === "#/linked-stack" || page === "#/linked-stack-flow"}
        <ToolbarLinkedStack
            {zoom}
            {zoomIn}
            {zoomOut}
            {zoomReset}
            {codeHidden}
            ontoggleCode={() => (codeHidden = !codeHidden)}
            onopenShortcuts={() => (showShortcuts = true)}
        />
    {:else if page === "#/queue" || page === "#/queue-flow"}
        <ToolbarQueue
            {zoom}
            {zoomIn}
            {zoomOut}
            {zoomReset}
            {codeHidden}
            ontoggleCode={() => (codeHidden = !codeHidden)}
            onopenShortcuts={() => (showShortcuts = true)}
        />
    {:else if page === "#/linked-queue"}
        <ToolbarLinkedQueue
            {zoom}
            {zoomIn}
            {zoomOut}
            {zoomReset}
            {codeHidden}
            ontoggleCode={() => (codeHidden = !codeHidden)}
            onopenShortcuts={() => (showShortcuts = true)}
        />
    {:else if page === "#/tree"}
        <ToolbarTree
            {zoom}
            {zoomIn}
            {zoomOut}
            {zoomReset}
            {codeHidden}
            ontoggleCode={() => (codeHidden = !codeHidden)}
            onopenShortcuts={() => (showShortcuts = true)}
        />
    {:else if page === "#/graph"}
        <ToolbarGraph
            {zoom}
            {zoomIn}
            {zoomOut}
            {zoomReset}
            {codeHidden}
            ontoggleCode={() => (codeHidden = !codeHidden)}
            onopenShortcuts={() => (showShortcuts = true)}
        />
    {/if}

    <!-- workspace -->
    <div class="workspace" bind:this={containerEl}>
        <div
            class="panel canvas-panel"
            style={codeHidden ? "width:100%" : `width:${splitPos}%`}
        >
            {#if page === "#/linked-list"}
                <Canvas bind:zoom active={page === "#/linked-list"} />
            {:else if page === "#/linked-list-flow"}
                <CanvasSLLFlow bind:zoom />
            {:else if page === "#/doubly-linked-list"}
                <CanvasDLL bind:zoom active={page === "#/doubly-linked-list"} />
            {:else if page === "#/doubly-linked-list-flow"}
                <CanvasDLLFlow bind:zoom />
            {:else if page === "#/stack"}
                <CanvasStack bind:zoom />
            {:else if page === "#/stack-flow"}
                <CanvasStackFlow bind:zoom />
            {:else if page === "#/linked-stack"}
                <CanvasLinkedStack bind:zoom />
            {:else if page === "#/linked-stack-flow"}
                <CanvasLinkedStackFlow bind:zoom />
            {:else if page === "#/queue"}
                <CanvasQueue bind:zoom />
            {:else if page === "#/queue-flow"}
                <CanvasQueueFlow bind:zoom />
            {:else if page === "#/linked-queue"}
                <CanvasLinkedQueue bind:zoom />
            {:else if page === "#/tree"}
                <CanvasTree bind:zoom />
            {:else if page === "#/graph"}
                <CanvasGraph bind:zoom />
            {/if}
        </div>

        {#if !codeHidden}
            <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
            <div
                class="splitter"
                role="separator"
                aria-orientation="vertical"
                aria-valuenow={splitPos}
                class:active={draggingSplitter}
                onmousedown={onSplitterMousedown}
            >
                <div class="splitter-handle"></div>
            </div>
            <div class="panel code-panel-wrap" style="width:{100 - splitPos}%">
                <CodePanel
                    log={page === "#/linked-list" || page === "#/linked-list-flow"
                        ? codeLog
                        : page === "#/doubly-linked-list" ||
                            page === "#/doubly-linked-list-flow"
                          ? codeLogDLL
                          : page === "#/stack" || page === "#/stack-flow"
                            ? stackLog
                            : page === "#/linked-stack" ||
                                page === "#/linked-stack-flow"
                              ? linkedStackLog
                              : page === "#/queue" || page === "#/queue-flow"
                                ? queueLog
                                : page === "#/linked-queue"
                                  ? linkedQueueLog
                                  : page === "#/graph"
                                    ? graphLog
                                    : treeLog}
                />
            </div>
        {/if}
    </div>
</div>

{#if showShortcuts}
    <ShortcutGuide onclose={() => (showShortcuts = false)} />
{/if}

<ToastContainer />

<style>
    #app {
        display: flex;
        flex-direction: column;
        width: 100vw;
        height: 100vh;
        overflow: hidden;
    }

    .page-nav {
        display: flex;
        align-items: center;
        gap: 2px;
        padding: 6px 20px 0;
        background: var(--surface);
        border-bottom: 1px solid var(--border);
        flex-shrink: 0;
    }

    .nav-tab {
        padding: 6px 16px;
        background: none;
        border: none;
        border-bottom: 2px solid transparent;
        color: var(--text-muted);
        font-family: var(--font-ui);
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        margin-bottom: -1px;
        transition: all 0.15s;
        border-radius: 6px 6px 0 0;
    }
    .nav-tab:hover {
        color: var(--text-dim);
    }
    .nav-tab.active {
        color: var(--accent);
        border-bottom-color: var(--accent);
    }

    .nav-spacer {
        flex: 1;
    }

    .theme-toggle {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        margin-bottom: 6px;
        background: none;
        border: 1px solid var(--border);
        border-radius: 8px;
        color: var(--text-dim);
        cursor: pointer;
        transition: all 0.15s;
    }
    .theme-toggle:hover {
        background: var(--surface2);
        color: var(--accent);
        border-color: var(--accent);
    }

    .workspace {
        display: flex;
        flex: 1;
        overflow: hidden;
        position: relative;
    }
    .panel {
        height: 100%;
        overflow: hidden;
        flex-shrink: 0;
    }
    .canvas-panel {
        position: relative;
    }
    .code-panel-wrap {
        position: relative;
    }
    .splitter {
        width: 5px;
        height: 100%;
        background: var(--border);
        cursor: col-resize;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.15s;
        z-index: 10;
    }
    .splitter:hover,
    .splitter.active {
        background: var(--accent-dim);
    }
    .splitter-handle {
        width: 3px;
        height: 32px;
        border-radius: 2px;
        background: var(--border-bright);
        transition: background 0.15s;
    }
    .splitter:hover .splitter-handle,
    .splitter.active .splitter-handle {
        background: var(--accent);
    }
</style>
