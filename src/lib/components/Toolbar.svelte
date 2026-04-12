<script>
  import { createNode, addNode, getSnapshot, applySnapshot, garbageCollect } from '../stores/graph.js';
  import { pushHistory, initHistory, undo, redo, canUndo, canRedo } from '../stores/history.js';
  import { nodes } from '../stores/graph.js';
  import { clearLog } from '../stores/codeLog.js';

  function handleAddNode() {
    pushHistory();
    const node = createNode(80 + Math.random() * 400, 80 + Math.random() * 300);
    addNode(node);
    pushHistory();
  }

  function handleNewCanvas() {
    if ($nodes.length > 0) {
      const ok = confirm('Start a new canvas? All unsaved work will be lost.');
      if (!ok) return;
    }
    applySnapshot({ nodes: [], edges: [], headId: null, tailId: null, counter: 0 });
    clearLog();
    initHistory();
  }

  function handleGC() {
    pushHistory();
    const removed = garbageCollect();
    if (!removed) {
      // Brief visual feedback — nothing to collect
      alert('No unreachable nodes to collect.');
    }
    pushHistory();
  }

  function handleSave() {
    const snap = getSnapshot();
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'structura-save.json'; a.click();
    URL.revokeObjectURL(url);
  }

  function handleLoad() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const snap = JSON.parse(ev.target.result);
          pushHistory();
          applySnapshot(snap);
        } catch { alert('Invalid save file.'); }
      };
      reader.readAsText(file);
    };
    input.click();
  }
</script>

<div class="toolbar">
  <div class="brand">
    <svg class="brand-icon-img" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="22" width="26" height="20" rx="5" fill="#13161e" stroke="#5b8fff" stroke-width="2"/>
      <line x1="14" y1="22" x2="14" y2="42" stroke="#353c52" stroke-width="1.5"/>
      <circle cx="9" cy="32" r="3" fill="#5b8fff"/>
      <path d="M28 32 H38" stroke="#5b8fff" stroke-width="2" stroke-linecap="round"/>
      <polygon points="36,28 44,32 36,36" fill="#5b8fff"/>
      <rect x="38" y="22" width="24" height="20" rx="5" fill="#13161e" stroke="#5b8fff" stroke-width="2"/>
      <line x1="50" y1="22" x2="50" y2="42" stroke="#353c52" stroke-width="1.5"/>
      <line x1="57" y1="32" x2="62" y2="32" stroke="#444d66" stroke-width="1.5"/>
      <line x1="59" y1="35" x2="63" y2="35" stroke="#444d66" stroke-width="1.5"/>
      <line x1="61" y1="38" x2="63" y2="38" stroke="#444d66" stroke-width="1.5"/>
    </svg>
    <span class="brand-name">Structura</span>
    <span class="brand-sub">Linked List</span>
  </div>

  <div class="actions">
    <button class="btn btn-primary" on:click={handleAddNode}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.5"/>
        <path d="M7 4v6M4 7h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      Add Node
    </button>

    <button class="btn btn-gc" on:click={handleGC} title="Simulate garbage collection — removes all unreachable nodes">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M7 2C4.2 2 2 4.2 2 7s2.2 5 5 5 5-2.2 5-5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        <path d="M9 2h3v3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M9 5l3-3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        <path d="M5 7l1.5 1.5L9 5.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Run GC
    </button>

    <div class="separator"></div>

    <button class="btn btn-icon" on:click={undo} disabled={!$canUndo} title="Undo (Ctrl+Z)">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M3 6H10C12.2 6 14 7.8 14 10C14 12.2 12.2 14 10 14H5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M5.5 3.5L3 6L5.5 8.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
    <button class="btn btn-icon" on:click={redo} disabled={!$canRedo} title="Redo (Ctrl+Y)">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M13 6H6C3.8 6 2 7.8 2 10C2 12.2 3.8 14 6 14H11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M10.5 3.5L13 6L10.5 8.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>

    <div class="separator"></div>

    <button class="btn btn-secondary" on:click={handleNewCanvas}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <rect x="2" y="2" width="10" height="10" rx="2" stroke="currentColor" stroke-width="1.4"/>
        <path d="M5 7h4M7 5v4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
      </svg>
      New
    </button>
    <button class="btn btn-secondary" on:click={handleSave}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M2 10V12H12V10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M7 2V9M4.5 6.5L7 9L9.5 6.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Save
    </button>
    <button class="btn btn-secondary" on:click={handleLoad}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M2 10V12H12V10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M7 9V2M4.5 4.5L7 2L9.5 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Load
    </button>
  </div>
</div>

<style>
  .toolbar { display: flex; align-items: center; justify-content: space-between; padding: 0 20px; height: 52px; background: var(--surface); border-bottom: 1px solid var(--border); flex-shrink: 0; gap: 12px; }
  .brand { display: flex; align-items: center; gap: 10px; }
  .brand-icon-img { width: 28px; height: 28px; flex-shrink: 0; }
  .brand-name { font-family: var(--font-ui); font-weight: 800; font-size: 18px; letter-spacing: -0.5px; color: var(--text); }
  .brand-sub { font-size: 11px; font-weight: 600; color: var(--text-muted); background: var(--surface2); border: 1px solid var(--border); border-radius: 4px; padding: 2px 7px; letter-spacing: 0.5px; text-transform: uppercase; }
  .actions { display: flex; align-items: center; gap: 6px; }
  .separator { width: 1px; height: 20px; background: var(--border); margin: 0 4px; }
  .btn { display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 7px; border: 1px solid transparent; cursor: pointer; font-family: var(--font-ui); font-size: 13px; font-weight: 600; transition: all 0.15s ease; }
  .btn:disabled { opacity: 0.3; cursor: not-allowed; }
  .btn-primary { background: var(--accent); color: #fff; }
  .btn-primary:hover:not(:disabled) { background: #6f9fff; box-shadow: 0 0 16px var(--accent-glow); }
  .btn-gc { background: rgba(78,204,163,0.12); color: var(--success); border: 1px solid rgba(78,204,163,0.3); }
  .btn-gc:hover { background: rgba(78,204,163,0.22); box-shadow: 0 0 12px rgba(78,204,163,0.2); }
  .btn-secondary { background: var(--surface2); color: var(--text-dim); border-color: var(--border); }
  .btn-secondary:hover:not(:disabled) { background: var(--border); color: var(--text); }
  .btn-icon { background: var(--surface2); color: var(--text-dim); border-color: var(--border); padding: 6px 8px; }
  .btn-icon:hover:not(:disabled) { background: var(--border); color: var(--text); }
</style>