<script>
    import { onMount, untrack } from "svelte";
    import { get } from "svelte/store";
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
    import { isTypingTarget } from "./lib/utils/keyboard.js";

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

    // Svelte Flow rebuild of the Linked-List Queue canvas, kept side-by-side
    // with the legacy tab (not hidden) so they can be compared directly.
    import CanvasLinkedQueueFlow from "./lib/components/canvas/CanvasLinkedQueueFlow.svelte";

    import ToolbarCircularList from "./lib/components/toolbar/ToolbarCircularList.svelte";
    import CanvasCircularListFlow from "./lib/components/canvas/CanvasCircularListFlow.svelte";
    import { circularListLog } from "./lib/stores/shared/circularListLog.js";
    import { initNodeClassCircularList } from "./lib/stores/list/graphCircularList.js";

    import ToolbarTree from "./lib/components/toolbar/ToolbarTree.svelte";
    import CanvasTree from "./lib/components/canvas/CanvasTree.svelte";
    import { treeLog } from "./lib/stores/shared/treeLog.js";
    import { initTree } from "./lib/stores/tree/graphTree.js";

    // Svelte Flow rebuild of the Binary Tree canvas, kept side-by-side with
    // the legacy tab (not hidden) so they can be compared directly.
    import CanvasTreeFlow from "./lib/components/canvas/CanvasTreeFlow.svelte";

    import ToolbarGraph from "./lib/components/toolbar/ToolbarGraph.svelte";
    import CanvasGraph from "./lib/components/canvas/CanvasGraph.svelte";
    import { graphLog } from "./lib/stores/shared/graphLog.js";
    import { initGraph } from "./lib/stores/graph/graphGraph.js";

    // Svelte Flow rebuild of the Graph canvas, kept side-by-side with the
    // legacy tab (not hidden) so they can be compared directly.
    import CanvasGraphFlow from "./lib/components/canvas/CanvasGraphFlow.svelte";

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
    // Same treatment for the old hand-rolled Linked-List Queue canvas now
    // that the Svelte Flow canvas is in place — route, component, and store
    // stay intact.
    const SHOW_OLD_LINKED_QUEUE_TAB = false;
    // Same treatment for the old hand-rolled Binary Tree canvas now that the
    // Svelte Flow canvas is in place — route, component, and store stay
    // intact.
    const SHOW_OLD_TREE_TAB = false;
    // Same treatment for the old hand-rolled Graph canvas now that the
    // Svelte Flow canvas is in place — route, component, and store stay
    // intact. This was the last structure to migrate.
    const SHOW_OLD_GRAPH_TAB = false;

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

        const media = window.matchMedia("(prefers-color-scheme: light)");
        const onMediaChange = (e) => {
            systemPrefersLight = e.matches;
        };
        media.addEventListener("change", onMediaChange);

        return () => {
            window.removeEventListener("hashchange", onHashChange);
            window.removeEventListener("wheel", onWindowWheel);
            media.removeEventListener("change", onMediaChange);
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
    // Each page remembers its own zoom level independently, so zooming in
    // one structure's canvas never bleeds into another's.
    let zoomByPage = $state({});
    let canvasFitToView = $state(null);

    // Themes are grouped into "dark" and "light" categories; each category
    // has exactly one default (isDefault: true), which is what "System"
    // resolves to for that OS color-scheme preference.
    const THEME_GROUPS = [
        {
            id: "dark",
            label: "Dark",
            themes: [
                { id: "dark", label: "Dark", swatch: "#5b8fff", isDefault: true },
                { id: "ocean", label: "Ocean", swatch: "#1fb8a6" },
                { id: "forest", label: "Forest", swatch: "#3fae6a" },
                { id: "grape", label: "Grape", swatch: "#8b6fe0" },
            ],
        },
        {
            id: "light",
            label: "Light",
            themes: [
                { id: "light", label: "Light", swatch: "#c2611f", isDefault: true },
                { id: "rose", label: "Rose", swatch: "#b8496a" },
                { id: "sky", label: "Sky", swatch: "#3568d4" },
                { id: "sage", label: "Sage", swatch: "#4f7a3f" },
            ],
        },
    ];
    const THEME_LOOKUP = new Map(
        THEME_GROUPS.flatMap((g) => g.themes.map((t) => [t.id, t])),
    );

    function groupDefaultTheme(groupId) {
        const group = THEME_GROUPS.find((g) => g.id === groupId);
        return group.themes.find((t) => t.isDefault)?.id ?? group.themes[0].id;
    }

    let themePref = $state(localStorage.getItem("structura-theme") ?? "system");
    let systemPrefersLight = $state(
        typeof window !== "undefined" && window.matchMedia
            ? window.matchMedia("(prefers-color-scheme: light)").matches
            : false,
    );
    // "system" resolves to the current OS category's default theme; every
    // other named theme is an explicit choice and passes through unchanged.
    let effectiveTheme = $derived(
        themePref === "system"
            ? groupDefaultTheme(systemPrefersLight ? "light" : "dark")
            : themePref,
    );
    let activeThemeSwatch = $derived(THEME_LOOKUP.get(effectiveTheme)?.swatch);
    let themeMenuOpen = $state(false);
    let themePickerEl = $state();

    $effect(() => {
        if (!themeMenuOpen) return;
        function onDocMousedown(e) {
            if (themePickerEl && !themePickerEl.contains(e.target)) {
                themeMenuOpen = false;
            }
        }
        window.addEventListener("mousedown", onDocMousedown);
        return () => window.removeEventListener("mousedown", onDocMousedown);
    });

    function selectTheme(pref) {
        themePref = pref;
        themeMenuOpen = false;
    }

    const ZOOM_STEP = 0.1;

    $effect(() => {
        localStorage.setItem("structura-split", splitPos.toString());
        localStorage.setItem("structura-code-hidden", codeHidden.toString());
    });

    $effect(() => {
        if (effectiveTheme === "dark") {
            document.documentElement.removeAttribute("data-theme");
        } else {
            document.documentElement.setAttribute("data-theme", effectiveTheme);
        }
        localStorage.setItem("structura-theme", themePref);
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
        } else if (page === "#/circular-linked-list") {
            if (get(circularListLog).length === 0) initNodeClassCircularList();
        } else if (
            page === "#/linked-stack" ||
            page === "#/linked-stack-flow"
        ) {
            if (get(linkedStackLog).length === 0) initNodeClassLinkedStack();
        } else if (page === "#/linked-queue" || page === "#/linked-queue-flow") {
            if (get(linkedQueueLog).length === 0) initNodeClassLinkedQueue();
        } else if (page === "#/tree" || page === "#/tree-flow") {
            if (get(treeLog).length === 0) initTree();
        } else if (page === "#/graph" || page === "#/graph-flow") {
            if (get(graphLog).length === 0) initGraph();
        }

        const p = page;
        untrack(() => {
            zoom = zoomByPage[p] ?? 1;
        });
    });

    // Whenever the zoom level changes (via the toolbar buttons or the
    // canvas's own pan/zoom gestures), remember it per-page so switching
    // pages and coming back restores the zoom that page was left at.
    $effect(() => {
        const z = zoom;
        untrack(() => {
            zoomByPage[page] = z;
        });
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
    }

    // Tab order for Ctrl+1..Ctrl+8 page switching, matching the nav bar.
    const PAGE_ORDER = [
        "#/linked-list-flow",
        "#/doubly-linked-list-flow",
        "#/circular-linked-list",
        "#/stack-flow",
        "#/linked-stack-flow",
        "#/queue-flow",
        "#/linked-queue-flow",
        "#/tree-flow",
        "#/graph-flow",
    ];

    function onKeydown(e) {
        if (isTypingTarget(e)) return;

        if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
            showShortcuts = !showShortcuts;
            return;
        }

        if ((e.ctrlKey || e.metaKey) && !e.altKey) {
            const pageIndex = Number(e.key) - 1;
            if (pageIndex >= 0 && pageIndex < PAGE_ORDER.length) {
                e.preventDefault();
                navigate(PAGE_ORDER[pageIndex]);
            }
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
        <button
            class="nav-tab"
            class:active={page === "#/circular-linked-list"}
            onclick={() => navigate("#/circular-linked-list")}
        >
            Circular Linked List
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
        {#if SHOW_OLD_LINKED_QUEUE_TAB}
            <button
                class="nav-tab"
                class:active={page === "#/linked-queue"}
                onclick={() => navigate("#/linked-queue")}
            >
                Linked-List Queue (legacy canvas)
            </button>
        {/if}
        <button
            class="nav-tab"
            class:active={page === "#/linked-queue-flow"}
            onclick={() => navigate("#/linked-queue-flow")}
        >
            Linked-List Queue
        </button>

        {#if SHOW_OLD_TREE_TAB}
            <button
                class="nav-tab"
                class:active={page === "#/tree"}
                onclick={() => navigate("#/tree")}
            >
                Binary Tree (legacy canvas)
            </button>
        {/if}
        <button
            class="nav-tab"
            class:active={page === "#/tree-flow"}
            onclick={() => navigate("#/tree-flow")}
        >
            Binary Tree
        </button>

        {#if SHOW_OLD_GRAPH_TAB}
            <button
                class="nav-tab"
                class:active={page === "#/graph"}
                onclick={() => navigate("#/graph")}
            >
                Graph (legacy canvas)
            </button>
        {/if}
        <button
            class="nav-tab"
            class:active={page === "#/graph-flow"}
            onclick={() => navigate("#/graph-flow")}
        >
            Graph
        </button>

        <div class="nav-spacer"></div>

        <div class="theme-picker" bind:this={themePickerEl}>
            <button
                class="theme-toggle"
                onclick={() => (themeMenuOpen = !themeMenuOpen)}
                title="Theme"
                aria-haspopup="true"
                aria-expanded={themeMenuOpen}
            >
                {#if themePref === "system"}
                    <Icon name="system" size={16} />
                {:else}
                    <span
                        class="theme-swatch"
                        style="background: {activeThemeSwatch}"
                    ></span>
                {/if}
            </button>
            {#if themeMenuOpen}
                <div class="theme-menu">
                    {#each THEME_GROUPS as group (group.id)}
                        <div class="theme-menu-heading">{group.label}</div>
                        {#each group.themes as opt (opt.id)}
                            <button
                                class="theme-menu-item"
                                class:active={themePref === opt.id}
                                onclick={() => selectTheme(opt.id)}
                            >
                                <span
                                    class="theme-swatch"
                                    style="background: {opt.swatch}"
                                ></span>
                                {opt.label}
                                <span class="theme-menu-trail">
                                    {#if opt.isDefault}<span
                                            class="theme-default-tag"
                                            >Default</span
                                        >{/if}
                                    {#if themePref === opt.id}<Icon
                                            name="check"
                                            size={13}
                                        />{/if}
                                </span>
                            </button>
                        {/each}
                    {/each}
                    <div class="theme-menu-divider"></div>
                    <button
                        class="theme-menu-item"
                        class:active={themePref === "system"}
                        onclick={() => selectTheme("system")}
                    >
                        <Icon name="system" size={13} />
                        System
                        <span class="theme-menu-trail">
                            {#if themePref === "system"}<Icon
                                    name="check"
                                    size={13}
                                />{/if}
                        </span>
                    </button>
                </div>
            {/if}
        </div>
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
    {:else if page === "#/circular-linked-list"}
        <ToolbarCircularList
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
    {:else if page === "#/linked-queue" || page === "#/linked-queue-flow"}
        <ToolbarLinkedQueue
            {zoom}
            {zoomIn}
            {zoomOut}
            {zoomReset}
            {codeHidden}
            ontoggleCode={() => (codeHidden = !codeHidden)}
            onopenShortcuts={() => (showShortcuts = true)}
        />
    {:else if page === "#/tree" || page === "#/tree-flow"}
        <ToolbarTree
            {zoom}
            {zoomIn}
            {zoomOut}
            {zoomReset}
            {codeHidden}
            ontoggleCode={() => (codeHidden = !codeHidden)}
            onopenShortcuts={() => (showShortcuts = true)}
        />
    {:else if page === "#/graph" || page === "#/graph-flow"}
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
            {:else if page === "#/circular-linked-list"}
                <CanvasCircularListFlow bind:zoom />
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
            {:else if page === "#/linked-queue-flow"}
                <CanvasLinkedQueueFlow bind:zoom />
            {:else if page === "#/tree"}
                <CanvasTree bind:zoom />
            {:else if page === "#/tree-flow"}
                <CanvasTreeFlow bind:zoom />
            {:else if page === "#/graph"}
                <CanvasGraph bind:zoom />
            {:else if page === "#/graph-flow"}
                <CanvasGraphFlow bind:zoom />
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
                          : page === "#/circular-linked-list"
                            ? circularListLog
                            : page === "#/stack" || page === "#/stack-flow"
                            ? stackLog
                            : page === "#/linked-stack" ||
                                page === "#/linked-stack-flow"
                              ? linkedStackLog
                              : page === "#/queue" || page === "#/queue-flow"
                                ? queueLog
                                : page === "#/linked-queue" || page === "#/linked-queue-flow"
                                  ? linkedQueueLog
                                  : page === "#/graph" || page === "#/graph-flow"
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
        background: var(--toolbar-bg);
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

    .theme-picker {
        position: relative;
        margin-bottom: 6px;
    }

    .theme-toggle {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
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

    .theme-menu {
        position: absolute;
        top: calc(100% + 6px);
        right: 0;
        z-index: 100;
        display: flex;
        flex-direction: column;
        min-width: 178px;
        padding: 5px;
        background: var(--surface);
        border: 1px solid var(--border-bright);
        border-radius: 10px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
        animation: themeMenuIn 0.12s ease;
    }
    @keyframes themeMenuIn {
        from {
            opacity: 0;
            transform: translateY(-4px) scale(0.97);
        }
        to {
            opacity: 1;
            transform: translateY(0) scale(1);
        }
    }
    .theme-menu-item {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 7px 9px;
        background: none;
        border: none;
        border-radius: 6px;
        color: var(--text-dim);
        font-family: var(--font-ui);
        font-size: 12.5px;
        font-weight: 600;
        text-align: left;
        cursor: pointer;
        transition: all 0.1s;
    }
    .theme-menu-item:hover {
        background: var(--surface2);
        color: var(--text);
    }
    .theme-menu-item.active {
        color: var(--accent);
    }
    .theme-menu-trail {
        margin-left: auto;
        display: flex;
        align-items: center;
        gap: 6px;
    }
    .theme-default-tag {
        font-family: var(--font-mono);
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.3px;
        color: var(--text-muted);
        background: var(--surface2);
        border: 1px solid var(--border);
        border-radius: 4px;
        padding: 1px 5px;
    }
    .theme-menu-heading {
        font-family: var(--font-ui);
        font-size: 10px;
        font-weight: 700;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.6px;
        padding: 6px 9px 3px;
    }
    .theme-menu-heading:first-child {
        padding-top: 3px;
    }
    .theme-menu-divider {
        height: 1px;
        background: var(--border);
        margin: 4px 2px;
    }
    .theme-swatch {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        flex-shrink: 0;
        border: 1px solid rgba(0, 0, 0, 0.2);
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
