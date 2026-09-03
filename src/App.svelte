<script>
    import { onMount, untrack } from "svelte";
    import { get } from "svelte/store";
    import Toolbar from "./lib/components/toolbar/Toolbar.svelte";
    import ToolbarStack from "./lib/components/toolbar/ToolbarStack.svelte";
    import ToolbarLinkedStack from "./lib/components/toolbar/ToolbarLinkedStack.svelte";
    import ToolbarBrowserHistory from "./lib/components/toolbar/ToolbarBrowserHistory.svelte";
    import CanvasBrowserHistory from "./lib/components/canvas/CanvasBrowserHistory.svelte";
    import { browserHistoryLog } from "./lib/stores/shared/browserHistoryLog.js";
    import { initBrowserHistory } from "./lib/stores/stack/browserHistory.js";
    import ToolbarPrintSpooler from "./lib/components/toolbar/ToolbarPrintSpooler.svelte";
    import CanvasPrintSpooler from "./lib/components/canvas/CanvasPrintSpooler.svelte";
    import { printSpoolerLog } from "./lib/stores/shared/printSpoolerLog.js";
    import { initPrintSpooler } from "./lib/stores/queue/printSpooler.js";
    import ToolbarErTriage from "./lib/components/toolbar/ToolbarErTriage.svelte";
    import CanvasErTriage from "./lib/components/canvas/CanvasErTriage.svelte";
    import { erTriageLog } from "./lib/stores/shared/erTriageLog.js";
    import { initErTriage } from "./lib/stores/heap/erTriage.js";
    import ToolbarPhoneBook from "./lib/components/toolbar/ToolbarPhoneBook.svelte";
    import CanvasPhoneBook from "./lib/components/canvas/CanvasPhoneBook.svelte";
    import { phoneBookLog } from "./lib/stores/shared/phoneBookLog.js";
    import { initPhoneBook } from "./lib/stores/hash/phoneBook.js";
    import ToolbarTodoList from "./lib/components/toolbar/ToolbarTodoList.svelte";
    import CanvasTodoList from "./lib/components/canvas/CanvasTodoList.svelte";
    import { todoListLog } from "./lib/stores/shared/todoListLog.js";
    import { initTodoList } from "./lib/stores/list/todoList.js";
    import ToolbarQueue from "./lib/components/toolbar/ToolbarQueue.svelte";
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

    import ToolbarDoublyCircularList from "./lib/components/toolbar/ToolbarDoublyCircularList.svelte";
    import CanvasDoublyCircularListFlow from "./lib/components/canvas/CanvasDoublyCircularListFlow.svelte";
    import { dclLog } from "./lib/stores/shared/dclLog.js";
    import { initNodeClassDCL } from "./lib/stores/list/graphDoublyCircularList.js";

    import ToolbarPlayQueue from "./lib/components/toolbar/ToolbarPlayQueue.svelte";
    import CanvasPlayQueue from "./lib/components/canvas/CanvasPlayQueue.svelte";
    import { playQueueLog } from "./lib/stores/shared/playQueueLog.js";
    import { initPlayQueue } from "./lib/stores/list/playQueue.js";

    import ToolbarTree from "./lib/components/toolbar/ToolbarTree.svelte";
    import { treeLog } from "./lib/stores/shared/treeLog.js";
    import { initTree } from "./lib/stores/tree/graphTree.js";

    // Svelte Flow rebuild of the Binary Tree canvas, kept side-by-side with
    // the legacy tab (not hidden) so they can be compared directly.
    import CanvasTreeFlow from "./lib/components/canvas/CanvasTreeFlow.svelte";

    import ToolbarBST from "./lib/components/toolbar/ToolbarBST.svelte";
    import CanvasBSTFlow from "./lib/components/canvas/CanvasBSTFlow.svelte";
    import { bstLog } from "./lib/stores/shared/bstLog.js";
    import { initBST } from "./lib/stores/tree/graphBST.js";

    // Array-backed, like Array Stack: nothing to log until the user picks
    // a capacity via the New modal, so (unlike BST) this doesn't need an
    // entry in the init-on-first-visit effect below — initHeap() is called
    // from ToolbarHeap.svelte's New-modal confirm handler instead.
    import ToolbarHeap from "./lib/components/toolbar/ToolbarHeap.svelte";
    import CanvasHeapFlow from "./lib/components/canvas/CanvasHeapFlow.svelte";
    import { heapLog } from "./lib/stores/shared/heapLog.js";

    import ToolbarAVL from "./lib/components/toolbar/ToolbarAVL.svelte";
    import CanvasAVLFlow from "./lib/components/canvas/CanvasAVLFlow.svelte";
    import { avlLog } from "./lib/stores/shared/avlLog.js";
    import { initAVL } from "./lib/stores/tree/graphAVL.js";

    // Array-backed (bucket count fixed at creation), like Array Stack and
    // Heap: nothing to log until the user picks a capacity via the New
    // modal, so this doesn't need an entry in the init-on-first-visit
    // effect below — initHash() is called from ToolbarHash.svelte's
    // New-modal confirm handler instead.
    import ToolbarHash from "./lib/components/toolbar/ToolbarHash.svelte";
    import CanvasHashFlow from "./lib/components/canvas/CanvasHashFlow.svelte";
    import { hashLog } from "./lib/stores/shared/hashLog.js";

    import ToolbarGraph from "./lib/components/toolbar/ToolbarGraph.svelte";
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

    // Same treatment for the old hand-rolled Linked-List Queue canvas now
    // that the Svelte Flow canvas is in place — route, component, and store
    // stay intact.
    const SHOW_OLD_LINKED_QUEUE_TAB = false;

    // --- .stc Load routing -------------------------------------------------
    // A `.stc` file carries a `_type` tag. Loading one navigates to the
    // matching page and hands the snapshot to that structure's applier,
    // regardless of which page Load was triggered from. The SLL⇄DLL
    // converter reuses the same "structura:load" event.
    import { toast } from "./lib/stores/shared/toast.js";
    import { STRUCTURE_ROUTES } from "./lib/utils/saveLoad.js";
    import { applySnapshot as applySnapshotSLL } from "./lib/stores/sll/graph.js";
    import { applySnapshotDLL } from "./lib/stores/dll/graphDLL.js";
    import { applySnapshotCircularList } from "./lib/stores/list/graphCircularList.js";
    import { applySnapshotDCL } from "./lib/stores/list/graphDoublyCircularList.js";
    import { applySnapshotPQ } from "./lib/stores/list/playQueue.js";
    import { applySnapshotStack } from "./lib/stores/stack/graphStack.js";
    import { applySnapshotLinkedStack } from "./lib/stores/stack/graphLinkedStack.js";
    import { applySnapshotBH } from "./lib/stores/stack/browserHistory.js";
    import { applySnapshotPS } from "./lib/stores/queue/printSpooler.js";
    import { applySnapshotER } from "./lib/stores/heap/erTriage.js";
    import { applySnapshotPB } from "./lib/stores/hash/phoneBook.js";
    import { applySnapshotTD } from "./lib/stores/list/todoList.js";
    import { applySnapshotQueue } from "./lib/stores/queue/graphQueue.js";
    import { applySnapshotLinkedQueue } from "./lib/stores/queue/graphLinkedQueue.js";
    import { applySnapshotTree } from "./lib/stores/tree/graphTree.js";
    import { applySnapshotBST } from "./lib/stores/tree/graphBST.js";
    import { applySnapshotAVL } from "./lib/stores/tree/graphAVL.js";
    import { applySnapshotHeap } from "./lib/stores/heap/graphHeap.js";
    import { applySnapshotHash } from "./lib/stores/hash/graphHash.js";
    import { applySnapshotGraph } from "./lib/stores/graph/graphGraph.js";

    const APPLY_SNAPSHOT_BY_TYPE = {
        sll: applySnapshotSLL,
        dll: applySnapshotDLL,
        "circular-list": applySnapshotCircularList,
        "doubly-circular-list": applySnapshotDCL,
        "play-queue": applySnapshotPQ,
        "todo-list": applySnapshotTD,
        stack: applySnapshotStack,
        "linked-stack": applySnapshotLinkedStack,
        "browser-history": applySnapshotBH,
        "print-spooler": applySnapshotPS,
        "er-triage": applySnapshotER,
        "phone-book": applySnapshotPB,
        queue: applySnapshotQueue,
        "linked-queue": applySnapshotLinkedQueue,
        tree: applySnapshotTree,
        bst: applySnapshotBST,
        avl: applySnapshotAVL,
        heap: applySnapshotHeap,
        hash: applySnapshotHash,
        graph: applySnapshotGraph,
    };

    /** @param {CustomEvent<{ snapshot: any, message?: string }>} e */
    function onStructuraLoad(e) {
        const { snapshot, message } = e.detail ?? {};
        const type = snapshot?._type;
        const route = type && STRUCTURE_ROUTES[type];
        const apply = type && APPLY_SNAPSHOT_BY_TYPE[type];
        if (!route || !apply) {
            toast.error("Unrecognised .stc file");
            return;
        }
        // Populate the module-level stores first, then navigate — the target
        // canvas mounts reading already-correct state, and the per-page
        // "init on first visit" effect sees a non-empty code log so it
        // won't overwrite it.
        apply(snapshot);
        if (location.hash !== route) location.hash = route;
        // Rebase undo history onto the freshly loaded structure once the
        // destination toolbar has (re-)registered its snapshot handlers.
        setTimeout(() => initHistory(), 0);
        toast.success(message ?? "Loaded successfully");
    }

    onMount(() => {
        initHistory();

        if (!location.hash || location.hash === "#") {
            location.hash = "#/linked-list-flow";
        }

        page = location.hash;

        const onHashChange = () => {
            page = location.hash;
        };

        window.addEventListener("hashchange", onHashChange);
        window.addEventListener("wheel", onWindowWheel, { passive: false });
        window.addEventListener("structura:load", onStructuraLoad);

        const media = window.matchMedia("(prefers-color-scheme: light)");
        const onMediaChange = (e) => {
            systemPrefersLight = e.matches;
        };
        media.addEventListener("change", onMediaChange);

        return () => {
            window.removeEventListener("hashchange", onHashChange);
            window.removeEventListener("wheel", onWindowWheel);
            window.removeEventListener("structura:load", onStructuraLoad);
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
        // Capture phase: Svelte Flow's canvas pane stops propagation of its
        // own mousedown handling, so a bubble-phase listener here would
        // never see clicks on the canvas and the menu would stay open.
        window.addEventListener("mousedown", onDocMousedown, true);
        return () => window.removeEventListener("mousedown", onDocMousedown, true);
    });

    // Which NAV_CATEGORIES dropdown (if any) is currently open, by id.
    let openNavCategory = $state(null);
    let navCategoriesEl = $state();

    $effect(() => {
        if (!openNavCategory) return;
        function onDocMousedown(e) {
            if (navCategoriesEl && !navCategoriesEl.contains(e.target)) {
                openNavCategory = null;
            }
        }
        // Capture phase: Svelte Flow's canvas pane stops propagation of its
        // own mousedown handling, so a bubble-phase listener here would
        // never see clicks on the canvas and the dropdown would stay open.
        window.addEventListener("mousedown", onDocMousedown, true);
        return () => window.removeEventListener("mousedown", onDocMousedown, true);
    });

    function toggleNavCategory(id) {
        openNavCategory = openNavCategory === id ? null : id;
    }

    function navigateFromCategory(href) {
        navigate(href);
        openNavCategory = null;
    }

    function selectTheme(pref) {
        themePref = pref;
        themeMenuOpen = false;
    }

    let isFullscreen = $state(!!document.fullscreenElement);

    function toggleFullscreen() {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            document.documentElement.requestFullscreen();
        }
    }

    $effect(() => {
        const onFullscreenChange = () => {
            isFullscreen = !!document.fullscreenElement;
        };
        document.addEventListener("fullscreenchange", onFullscreenChange);
        return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
    });

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
        } else if (page === "#/doubly-circular-linked-list") {
            if (get(dclLog).length === 0) initNodeClassDCL();
        } else if (page === "#/play-queue") {
            if (get(playQueueLog).length === 0) initPlayQueue();
        } else if (page === "#/todo-list") {
            if (get(todoListLog).length === 0) initTodoList();
        } else if (
            page === "#/linked-stack" ||
            page === "#/linked-stack-flow"
        ) {
            if (get(linkedStackLog).length === 0) initNodeClassLinkedStack();
        } else if (page === "#/browser-history") {
            if (get(browserHistoryLog).length === 0) initBrowserHistory();
        } else if (page === "#/print-spooler") {
            if (get(printSpoolerLog).length === 0) initPrintSpooler();
        } else if (page === "#/er-triage") {
            if (get(erTriageLog).length === 0) initErTriage();
        } else if (page === "#/phone-book") {
            if (get(phoneBookLog).length === 0) initPhoneBook();
        } else if (page === "#/linked-queue" || page === "#/linked-queue-flow") {
            if (get(linkedQueueLog).length === 0) initNodeClassLinkedQueue();
        } else if (page === "#/tree" || page === "#/tree-flow") {
            if (get(treeLog).length === 0) initTree();
        } else if (page === "#/graph" || page === "#/graph-flow") {
            if (get(graphLog).length === 0) initGraph();
        } else if (page === "#/bst-flow") {
            if (get(bstLog).length === 0) initBST();
        } else if (page === "#/avl-flow") {
            if (get(avlLog).length === 0) initAVL();
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

    // Categorized nav menu data — each category renders as a dropdown in
    // the nav bar. PAGE_ORDER (for Ctrl+1..Ctrl+9 page switching) is derived
    // from the same list so the two can never drift apart.
    const NAV_CATEGORIES = [
        {
            id: "lists",
            label: "Linked Lists",
            items: [
                { href: "#/linked-list-flow", label: "Singly Linked List" },
                { href: "#/doubly-linked-list-flow", label: "Doubly Linked List" },
                {
                    href: "#/circular-linked-list",
                    label: "Singly Circular Linked List",
                },
                {
                    href: "#/doubly-circular-linked-list",
                    label: "Doubly Circular Linked List",
                },
                { divider: true, label: "Applied Examples" },
                { href: "#/play-queue", label: "Play Queue (Doubly LL)" },
                { href: "#/todo-list", label: "To-Do List (Singly LL)" },
            ],
        },
        {
            id: "stacks-queues",
            label: "Stacks & Queues",
            items: [
                { href: "#/stack-flow", label: "Array Stack" },
                { href: "#/linked-stack-flow", label: "Linked-List Stack" },
                { href: "#/queue-flow", label: "Array Queue" },
                ...(SHOW_OLD_LINKED_QUEUE_TAB
                    ? [
                          {
                              href: "#/linked-queue",
                              label: "Linked-List Queue (legacy canvas)",
                          },
                      ]
                    : []),
                { href: "#/linked-queue-flow", label: "Linked-List Queue" },
                { divider: true, label: "Applied Examples" },
                { href: "#/print-spooler", label: "Print Spooler (Queue)" },
                {
                    href: "#/browser-history",
                    label: "Browser History (2 Stacks)",
                },
            ],
        },
        {
            id: "trees",
            label: "Trees",
            items: [
                { href: "#/tree-flow", label: "Binary Tree" },
                { href: "#/bst-flow", label: "Binary Search Tree" },
                { href: "#/avl-flow", label: "AVL Tree" },
                { href: "#/heap-flow", label: "Heap / Priority Queue" },
                { divider: true, label: "Applied Examples" },
                { href: "#/er-triage", label: "ER Triage (Priority Queue)" },
            ],
        },
        {
            id: "graph-hash",
            label: "Graph & Hash",
            items: [
                { href: "#/graph-flow", label: "Graph" },
                { href: "#/hash-flow", label: "Hash Table" },
                { divider: true, label: "Applied Examples" },
                { href: "#/phone-book", label: "Phone Book (Hash Table)" },
            ],
        },
    ];

    const PAGE_ORDER = NAV_CATEGORIES.flatMap((category) =>
        category.items.filter((item) => item.href).map((item) => item.href),
    );

    function onKeydown(e) {
        if (isTypingTarget(e)) return;

        if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
            showShortcuts = !showShortcuts;
            return;
        }

        if ((e.ctrlKey || e.metaKey) && !e.altKey) {
            if (e.key === "\\") {
                e.preventDefault();
                codeHidden = !codeHidden;
                return;
            }
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
        <div class="nav-categories" bind:this={navCategoriesEl}>
            {#each NAV_CATEGORIES as category (category.id)}
                <div class="nav-category">
                    <button
                        class="nav-tab nav-category-toggle"
                        class:active={category.items.some(
                            (item) => item.href === page,
                        )}
                        onclick={() => toggleNavCategory(category.id)}
                        aria-haspopup="true"
                        aria-expanded={openNavCategory === category.id}
                    >
                        {category.label}
                        <Icon name="chevronDown" size={11} />
                    </button>
                    {#if openNavCategory === category.id}
                        <div class="nav-category-menu">
                            {#each category.items as item (item.href ?? item.label)}
                                {#if item.divider}
                                    <div class="nav-category-sep">{item.label}</div>
                                {:else}
                                    <button
                                        class="nav-category-item"
                                        class:active={page === item.href}
                                        onclick={() => navigateFromCategory(item.href)}
                                    >
                                        {item.label}
                                    </button>
                                {/if}
                            {/each}
                        </div>
                    {/if}
                </div>
            {/each}
        </div>

        <div class="nav-spacer"></div>

        <button
            class="theme-toggle nav-icon-btn"
            class:active={codeHidden}
            onclick={() => (codeHidden = !codeHidden)}
            title={codeHidden ? "Show code panel" : "Hide code panel"}
        >
            <Icon name="code" size={16} />
        </button>

        <button
            class="theme-toggle nav-icon-btn"
            onclick={() => (showShortcuts = !showShortcuts)}
            title="Keyboard shortcuts"
        >
            <Icon name="shortcuts" size={16} />
        </button>

        <button
            class="theme-toggle fullscreen-toggle"
            onclick={toggleFullscreen}
            title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
            <Icon name={isFullscreen ? "fullscreenExit" : "fullscreen"} size={16} />
        </button>

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
        />
    {:else if page === "#/circular-linked-list"}
        <ToolbarCircularList
            {zoom}
            {zoomIn}
            {zoomOut}
            {zoomReset}
        />
    {:else if page === "#/doubly-circular-linked-list"}
        <ToolbarDoublyCircularList
            {zoom}
            {zoomIn}
            {zoomOut}
            {zoomReset}
        />
    {:else if page === "#/play-queue"}
        <ToolbarPlayQueue
            {zoom}
            {zoomIn}
            {zoomOut}
            {zoomReset}
        />
    {:else if page === "#/todo-list"}
        <ToolbarTodoList
            {zoom}
            {zoomIn}
            {zoomOut}
            {zoomReset}
        />
    {:else if page === "#/stack" || page === "#/stack-flow"}
        <ToolbarStack
            {zoom}
            {zoomIn}
            {zoomOut}
            {zoomReset}
        />
    {:else if page === "#/linked-stack" || page === "#/linked-stack-flow"}
        <ToolbarLinkedStack
            {zoom}
            {zoomIn}
            {zoomOut}
            {zoomReset}
        />
    {:else if page === "#/browser-history"}
        <ToolbarBrowserHistory
            {zoom}
            {zoomIn}
            {zoomOut}
            {zoomReset}
        />
    {:else if page === "#/print-spooler"}
        <ToolbarPrintSpooler
            {zoom}
            {zoomIn}
            {zoomOut}
            {zoomReset}
        />
    {:else if page === "#/er-triage"}
        <ToolbarErTriage
            {zoom}
            {zoomIn}
            {zoomOut}
            {zoomReset}
        />
    {:else if page === "#/phone-book"}
        <ToolbarPhoneBook
            {zoom}
            {zoomIn}
            {zoomOut}
            {zoomReset}
        />
    {:else if page === "#/queue" || page === "#/queue-flow"}
        <ToolbarQueue
            {zoom}
            {zoomIn}
            {zoomOut}
            {zoomReset}
        />
    {:else if page === "#/linked-queue" || page === "#/linked-queue-flow"}
        <ToolbarLinkedQueue
            {zoom}
            {zoomIn}
            {zoomOut}
            {zoomReset}
        />
    {:else if page === "#/tree" || page === "#/tree-flow"}
        <ToolbarTree
            {zoom}
            {zoomIn}
            {zoomOut}
            {zoomReset}
        />
    {:else if page === "#/graph" || page === "#/graph-flow"}
        <ToolbarGraph
            {zoom}
            {zoomIn}
            {zoomOut}
            {zoomReset}
        />
    {:else if page === "#/bst-flow"}
        <ToolbarBST
            {zoom}
            {zoomIn}
            {zoomOut}
            {zoomReset}
        />
    {:else if page === "#/heap-flow"}
        <ToolbarHeap
            {zoom}
            {zoomIn}
            {zoomOut}
            {zoomReset}
        />
    {:else if page === "#/avl-flow"}
        <ToolbarAVL
            {zoom}
            {zoomIn}
            {zoomOut}
            {zoomReset}
        />
    {:else if page === "#/hash-flow"}
        <ToolbarHash
            {zoom}
            {zoomIn}
            {zoomOut}
            {zoomReset}
        />
    {/if}

    <!-- workspace -->
    <div class="workspace" bind:this={containerEl}>
        <div
            class="panel canvas-panel"
            style={codeHidden ? "width:100%" : `width:${splitPos}%`}
        >
            {#if page === "#/linked-list-flow"}
                <CanvasSLLFlow bind:zoom />
            {:else if page === "#/doubly-linked-list-flow"}
                <CanvasDLLFlow bind:zoom />
            {:else if page === "#/circular-linked-list"}
                <CanvasCircularListFlow bind:zoom />
            {:else if page === "#/doubly-circular-linked-list"}
                <CanvasDoublyCircularListFlow bind:zoom />
            {:else if page === "#/play-queue"}
                <CanvasPlayQueue bind:zoom />
            {:else if page === "#/todo-list"}
                <CanvasTodoList bind:zoom />
            {:else if page === "#/stack-flow"}
                <CanvasStackFlow bind:zoom />
            {:else if page === "#/linked-stack-flow"}
                <CanvasLinkedStackFlow bind:zoom />
            {:else if page === "#/browser-history"}
                <CanvasBrowserHistory bind:zoom />
            {:else if page === "#/print-spooler"}
                <CanvasPrintSpooler bind:zoom />
            {:else if page === "#/er-triage"}
                <CanvasErTriage bind:zoom />
            {:else if page === "#/phone-book"}
                <CanvasPhoneBook bind:zoom />
            {:else if page === "#/queue-flow"}
                <CanvasQueueFlow bind:zoom />
            {:else if page === "#/linked-queue"}
                <CanvasLinkedQueue bind:zoom />
            {:else if page === "#/linked-queue-flow"}
                <CanvasLinkedQueueFlow bind:zoom />
            {:else if page === "#/tree-flow"}
                <CanvasTreeFlow bind:zoom />
            {:else if page === "#/graph-flow"}
                <CanvasGraphFlow bind:zoom />
            {:else if page === "#/bst-flow"}
                <CanvasBSTFlow bind:zoom />
            {:else if page === "#/heap-flow"}
                <CanvasHeapFlow bind:zoom />
            {:else if page === "#/avl-flow"}
                <CanvasAVLFlow bind:zoom />
            {:else if page === "#/hash-flow"}
                <CanvasHashFlow bind:zoom />
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
                            : page === "#/doubly-circular-linked-list"
                            ? dclLog
                            : page === "#/play-queue"
                            ? playQueueLog
                            : page === "#/todo-list"
                            ? todoListLog
                            : page === "#/stack" || page === "#/stack-flow"
                            ? stackLog
                            : page === "#/linked-stack" ||
                                page === "#/linked-stack-flow"
                              ? linkedStackLog
                              : page === "#/browser-history"
                                ? browserHistoryLog
                                : page === "#/print-spooler"
                                ? printSpoolerLog
                                : page === "#/er-triage"
                                ? erTriageLog
                                : page === "#/phone-book"
                                ? phoneBookLog
                                : page === "#/queue" || page === "#/queue-flow"
                                ? queueLog
                                : page === "#/linked-queue" || page === "#/linked-queue-flow"
                                  ? linkedQueueLog
                                  : page === "#/graph" || page === "#/graph-flow"
                                    ? graphLog
                                    : page === "#/tree" || page === "#/tree-flow"
                                      ? treeLog
                                      : page === "#/heap-flow"
                                        ? heapLog
                                        : page === "#/avl-flow"
                                          ? avlLog
                                          : page === "#/hash-flow"
                                            ? hashLog
                                            : bstLog}
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

    .nav-categories {
        display: flex;
        align-items: center;
        gap: 2px;
    }

    .nav-category {
        position: relative;
    }

    .nav-category-toggle {
        display: flex;
        align-items: center;
        gap: 5px;
    }

    .nav-category-menu {
        position: absolute;
        top: calc(100% + 6px);
        left: 0;
        z-index: 100;
        display: flex;
        flex-direction: column;
        min-width: 200px;
        padding: 5px;
        background: var(--surface);
        border: 1px solid var(--border-bright);
        border-radius: 10px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
        animation: themeMenuIn 0.12s ease;
    }

    .nav-category-item {
        display: flex;
        align-items: center;
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
    .nav-category-item:hover {
        background: var(--surface2);
        color: var(--text);
    }
    .nav-category-item.active {
        color: var(--accent);
    }

    .nav-category-sep {
        margin: 6px 9px 3px;
        padding-top: 7px;
        border-top: 1px solid var(--border);
        color: var(--text-muted);
        font-family: var(--font-ui);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.6px;
        text-transform: uppercase;
    }

    .nav-spacer {
        flex: 1;
    }

    .theme-picker {
        position: relative;
        margin-bottom: 6px;
    }

    .fullscreen-toggle {
        margin-bottom: 6px;
        margin-right: 8px;
    }

    .nav-icon-btn {
        margin-bottom: 6px;
    }
    .nav-icon-btn.active {
        background: var(--accent-dim);
        color: #fff;
        border-color: var(--accent-dim);
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
