<script>
  import {
    pushHistory,
    initHistory,
    undo,
    redo,
    canUndo,
    canRedo,
  } from "../../stores/shared/history.js";

  import { unreachableCount } from "../../stores/sll/graph.js";
  import { unreachableCountDLL } from "../../stores/dll/graphDLL.js";

  // SLL imports
  import {
    createNode,
    addNode,
    getSnapshot,
    applySnapshot,
    garbageCollect,
  } from "../../stores/sll/graph.js";
  import { nodes } from "../../stores/sll/graph.js";
  import { clearLog } from "../../stores/sll/sllLog.js";
  import { clearLogDLL } from "../../stores/dll/dllLog.js";

  // DLL imports
  import {
    createNodeDLL,
    addNodeDLL,
    getSnapshotDLL,
    applySnapshotDLL,
    garbageCollectDLL,
  } from "../../stores/dll/graphDLL.js";
  import { nodesDLL } from "../../stores/dll/graphDLL.js";

  import Tooltip from "../ui/Tooltip.svelte";
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
      const ok = confirm("Start a new canvas? All unsaved work will be lost.");
      if (!ok) return;
    }
    if (isSLL) {
      applySnapshot({
        nodes: [],
        edges: [],
        headId: null,
        tailId: null,
        walkId: null,
        counter: 0,
        codeLog: [],
      });
      clearLog();
    } else {
      applySnapshotDLL({
        nodes: [],
        edges: [],
        headId: null,
        tailId: null,
        walkId: null,
        counter: 0,
        codeLog: [],
      });
      clearLogDLL();
    }
    initHistory();
    toast.success("Canvas cleared");
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
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const snap = JSON.parse(ev.target.result);
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
    <svg
      class="brand-icon-img"
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="2"
        y="22"
        width="26"
        height="20"
        rx="5"
        fill="#13161e"
        stroke="#5b8fff"
        stroke-width="2"
      />
      <line
        x1="14"
        y1="22"
        x2="14"
        y2="42"
        stroke="#353c52"
        stroke-width="1.5"
      />
      <circle cx="9" cy="32" r="3" fill="#5b8fff" />
      <path
        d="M28 32 H38"
        stroke="#5b8fff"
        stroke-width="2"
        stroke-linecap="round"
      />
      <polygon points="36,28 44,32 36,36" fill="#5b8fff" />
      <rect
        x="38"
        y="22"
        width="24"
        height="20"
        rx="5"
        fill="#13161e"
        stroke="#5b8fff"
        stroke-width="2"
      />
      <line
        x1="50"
        y1="22"
        x2="50"
        y2="42"
        stroke="#353c52"
        stroke-width="1.5"
      />
      <line
        x1="57"
        y1="32"
        x2="62"
        y2="32"
        stroke="#444d66"
        stroke-width="1.5"
      />
      <line
        x1="59"
        y1="35"
        x2="63"
        y2="35"
        stroke="#444d66"
        stroke-width="1.5"
      />
      <line
        x1="61"
        y1="38"
        x2="63"
        y2="38"
        stroke="#444d66"
        stroke-width="1.5"
      />
    </svg>
    <span class="brand-name">Structura</span>
    <span class="brand-sub">{modeLabel}</span>
  </div>

  <div class="actions">
    <button class="btn btn-primary" onclick={handleAddNode}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.5" />
        <path
          d="M7 4v6M4 7h6"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
      </svg>
      Add Node
    </button>

    <Tooltip
      text={gcCount > 0
        ? `Run Garbage Collector (${gcCount} Collectable Node${gcCount > 1 ? "s" : ""})`
        : "Run Garbage Collector (Nothing to Collect)"}
    >
      <button class="btn btn-gc" onclick={handleGC}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M7 2C4.2 2 2 4.2 2 7s2.2 5 5 5 5-2.2 5-5"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linecap="round"
          />
          <path
            d="M9 2h3v3"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M9 5l3-3"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linecap="round"
          />
          <path
            d="M5 7l1.5 1.5L9 5.5"
            stroke="currentColor"
            stroke-width="1.3"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        Run GC
        {#if gcCount > 0}
          <span class="gc-badge">{gcCount}</span>
        {/if}
      </button>
    </Tooltip>

    <div class="separator"></div>

    <Tooltip text="Zoom Out" shortcut="Scroll ↓">
      <button class="btn btn-icon" aria-label="Zoom out" onclick={zoomOut}>
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

    <Tooltip text="Reset Zoom">
      <button class="zoom-label" aria-label="Reset zoom" onclick={zoomReset}
        >{zoomPct}</button
      >
    </Tooltip>

    <Tooltip text="Zoom In" shortcut="Scroll ↑">
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

    <Tooltip text="New Canvas">
      <button class="btn btn-secondary" onclick={handleNewCanvas}>
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

    <Tooltip text="Save to file">
      <button class="btn btn-secondary" onclick={handleSave}>
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

    <Tooltip text="Load from file">
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

    <Tooltip text={codeHidden ? "Show Code Panel" : "Hide Code Panel"}>
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

    <Tooltip text="Keyboard Shortcuts" shortcut="?">
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
  .brand-icon-img {
    width: 28px;
    height: 28px;
    flex-shrink: 0;
  }
  .brand-name {
    font-family: var(--font-ui);
    font-weight: 800;
    font-size: 18px;
    letter-spacing: -0.5px;
    color: var(--text);
  }
  .brand-sub {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 2px 7px;
    letter-spacing: 0.5px;
    text-transform: uppercase;
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
</style>
