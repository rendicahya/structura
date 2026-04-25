<script>
  import Tooltip from '../ui/Tooltip.svelte';
  import { pushHistory, undo, redo, canUndo, canRedo, initHistory } from '../../stores/shared/history.js';
  import { stackItems, stackCapacity, isFull, isEmpty, pushStack, popStack, initStack, getSnapshotStack, applySnapshotStack, clearStack } from '../../stores/stack/graphStack.js';
  import { clearLogStack } from '../../stores/shared/stackLog.js';
  import { toast } from '../../stores/shared/toast.js';

  const {
    zoom = 1,
    zoomIn,
    zoomOut,
    zoomReset,
    codeHidden = false,
    ontoggleCode,
    onopenShortcuts,
    } = $props();

  let showNewStack = $state(false);
  let showPush = $state(false);
  let pushValue = $state('');

  // New stack form
  let newCapacity = $state(5);
  let newVarName = $state('stack');
  let newType = $state('int');

  function handleNewStack() {
    if ($stackItems.length > 0) {
      const ok = confirm('Start a new stack? All unsaved work will be lost.');
      if (!ok) return;
    }
    showNewStack = true;
  }

  function confirmNewStack() {
    if (newCapacity < 1 || newCapacity > 20) {
      toast.error('Capacity must be between 1 and 20');
      return;
    }
    if (!newVarName.trim()) {
      toast.error('Variable name cannot be empty');
      return;
    }
    clearStack();
    clearLogStack();
    initHistory();
    initStack(newCapacity, newVarName.trim(), newType);
    showNewStack = false;
    toast.success(`Stack "${newVarName}" created with capacity ${newCapacity}`);
  }

  function handlePush() {
    if ($isFull) {
      toast.error('Stack overflow — stack is full');
      return;
    }
    showPush = true;
    pushValue = '';
    setTimeout(() => pushInputEl?.focus(), 50);
  }

  function confirmPush() {
    if (!pushValue.trim()) {
      toast.error('Value cannot be empty');
      return;
    }
    pushHistory();
    const ok = pushStack(pushValue.trim());
    if (ok) {
      pushHistory();
      toast.success(`Pushed "${pushValue.trim()}"`);
    }
    showPush = false;
    pushValue = '';
  }

  function handlePop() {
    if ($isEmpty) {
      toast.error('Stack underflow — stack is empty');
      return;
    }
    pushHistory();
    popStack();
    pushHistory();
    toast.success('Popped top element');
  }

  function handleSave() {
    const snap = getSnapshotStack();
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'structura-stack-save.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Saved successfully');
  }

  function handleLoad() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const snap = JSON.parse(/** @type {string} */ (ev.target?.result));
          pushHistory();
          applySnapshotStack(snap);
          toast.success('Loaded successfully');
        } catch {
          toast.error('Invalid save file');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  let pushInputEl = $state();
  let zoomPct = $derived(Math.round(zoom * 100) + '%');
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
    <span class="brand-sub">Stack</span>
  </div>

  <div class="actions">
    <Tooltip text="Create new stack">
      <button class="btn btn-secondary" onclick={handleNewStack}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="2" y="2" width="10" height="10" rx="2" stroke="currentColor" stroke-width="1.4"/>
          <path d="M5 7h4M7 5v4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        </svg>
        New Stack
      </button>
    </Tooltip>

    <div class="separator"></div>

    <Tooltip text={$isFull ? 'Stack is full' : 'Push value onto stack'}>
      <button class="btn btn-primary" onclick={handlePush} disabled={$stackCapacity === 0 || $isFull}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 10V4M4 7l3-3 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Push
      </button>
    </Tooltip>

    <Tooltip text={$isEmpty ? 'Stack is empty' : 'Pop top element from stack'}>
      <button class="btn btn-danger" onclick={handlePop} disabled={$stackCapacity === 0 || $isEmpty}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 4v6M4 7l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Pop
      </button>
    </Tooltip>

    <div class="separator"></div>

    <Tooltip text="Zoom out" shortcut="Scroll ↓">
      <button class="btn btn-icon" aria-label="Zoom out" onclick={zoomOut}>
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
          <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.4"/>
          <path d="M4.5 6.5h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          <path d="M10.5 10.5L13 13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        </svg>
      </button>
    </Tooltip>

    <Tooltip text="Reset zoom">
      <button class="zoom-label" aria-label="Reset zoom" onclick={zoomReset}>{zoomPct}</button>
    </Tooltip>

    <Tooltip text="Zoom in" shortcut="Scroll ↑">
      <button class="btn btn-icon" aria-label="Zoom in" onclick={zoomIn}>
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
          <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.4"/>
          <path d="M4.5 6.5h4M6.5 4.5v4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          <path d="M10.5 10.5L13 13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        </svg>
      </button>
    </Tooltip>

    <div class="separator"></div>

    <Tooltip text="Undo" shortcut="Ctrl+Z">
      <button class="btn btn-icon" aria-label="Undo" onclick={undo} disabled={!$canUndo}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M3 6H10C12.2 6 14 7.8 14 10C14 12.2 12.2 14 10 14H5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M5.5 3.5L3 6L5.5 8.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </Tooltip>

    <Tooltip text="Redo" shortcut="Ctrl+Y">
      <button class="btn btn-icon" aria-label="Redo" onclick={redo} disabled={!$canRedo}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M13 6H6C3.8 6 2 7.8 2 10C2 12.2 3.8 14 6 14H11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M10.5 3.5L13 6L10.5 8.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </Tooltip>

    <div class="separator"></div>

    <Tooltip text="Save to file">
      <button class="btn btn-secondary" onclick={handleSave}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 10V12H12V10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M7 2V9M4.5 6.5L7 9L9.5 6.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Save
      </button>
    </Tooltip>

    <Tooltip text="Load from file">
      <button class="btn btn-secondary" onclick={handleLoad}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 10V12H12V10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M7 9V2M4.5 4.5L7 2L9.5 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Load
      </button>
    </Tooltip>

    <div class="separator"></div>

    <Tooltip text={codeHidden ? 'Show code panel' : 'Hide code panel'}>
      <button
        class="btn btn-icon"
        aria-label={codeHidden ? 'Show code panel' : 'Hide code panel'}
        class:active={codeHidden}
        onclick={() => ontoggleCode?.()}
      >
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
          <rect x="1" y="2" width="13" height="11" rx="2" stroke="currentColor" stroke-width="1.4"/>
          <line x1="9" y1="2" x2="9" y2="13" stroke="currentColor" stroke-width="1.4"/>
          {#if codeHidden}
            <path d="M11 6l2 1.5-2 1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
          {:else}
            <path d="M11 6l2 1.5-2 1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" opacity="0.4"/>
          {/if}
        </svg>
      </button>
    </Tooltip>

    <Tooltip text="Keyboard shortcuts" shortcut="?">
      <button class="btn btn-icon" aria-label="Keyboard shortcuts" onclick={() => onopenShortcuts?.()}>
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
          <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" stroke-width="1.4"/>
          <path d="M5.5 6C5.5 4.9 6.3 4 7.5 4S9.5 4.9 9.5 6C9.5 7 8.5 7.5 7.5 8v1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
          <circle cx="7.5" cy="10.5" r="0.6" fill="currentColor"/>
        </svg>
      </button>
    </Tooltip>
  </div>
</div>

<!-- New Stack Modal -->
{#if showNewStack}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-overlay" onmousedown={() => showNewStack = false}>
    <div class="modal" onmousedown={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <span class="modal-title">New Stack</span>
        <button class="close-btn" aria-label="Close" onclick={() => showNewStack = false}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <div class="field">
          <label>Variable name</label>
          <input bind:value={newVarName} placeholder="stack" spellcheck="false"/>
        </div>
        <div class="field">
          <label>Data type</label>
          <select bind:value={newType}>
            <option value="int">int</option>
            <option value="double">double</option>
            <option value="String">String</option>
            <option value="char">char</option>
          </select>
        </div>
        <div class="field">
          <label>Capacity (1–20)</label>
          <input type="number" bind:value={newCapacity} min="1" max="20"/>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick={() => showNewStack = false}>Cancel</button>
        <button class="btn btn-primary" onclick={confirmNewStack}>Create</button>
      </div>
    </div>
  </div>
{/if}

<!-- Push Modal -->
{#if showPush}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-overlay" onmousedown={() => showPush = false}>
    <div class="modal modal-sm" onmousedown={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <span class="modal-title">Push value</span>
        <button class="close-btn" aria-label="Close" onclick={() => showPush = false}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <div class="field">
          <label>Value</label>
          <input
            bind:this={pushInputEl}
            bind:value={pushValue}
            onkeydown={(e) => e.key === 'Enter' && confirmPush()}
            placeholder="Enter value..."
            spellcheck="false"
          />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick={() => showPush = false}>Cancel</button>
        <button class="btn btn-primary" onclick={confirmPush}>Push</button>
      </div>
    </div>
  </div>
{/if}

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
  .btn-danger { background: rgba(255,91,110,0.15); color: var(--danger); border: 1px solid rgba(255,91,110,0.3); }
  .btn-danger:hover:not(:disabled) { background: rgba(255,91,110,0.25); }
  .btn-secondary { background: var(--surface2); color: var(--text-dim); border-color: var(--border); }
  .btn-secondary:hover:not(:disabled) { background: var(--border); color: var(--text); }
  .btn-icon { background: var(--surface2); color: var(--text-dim); border-color: var(--border); padding: 6px 8px; }
  .btn-icon:hover:not(:disabled) { background: var(--border); color: var(--text); }
  .btn-icon.active { background: var(--accent-dim); color: #fff; border-color: var(--accent-dim); }
  .zoom-label { font-family: var(--font-mono); font-size: 11px; font-weight: 600; color: var(--text-dim); background: var(--surface2); border: 1px solid var(--border); border-radius: 5px; padding: 4px 7px; cursor: pointer; min-width: 42px; text-align: center; transition: all 0.15s; }
  .zoom-label:hover { background: var(--border); color: var(--text); }

  /* Modal */
  .modal-overlay { position: fixed; inset: 0; z-index: 2000; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; animation: fadeIn 0.15s ease; }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .modal { background: var(--surface); border: 1px solid var(--border-bright); border-radius: 14px; width: 320px; box-shadow: 0 24px 64px rgba(0,0,0,0.6); animation: slideIn 0.15s ease; overflow: hidden; }
  .modal-sm { width: 260px; }
  @keyframes slideIn { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: translateY(0); } }
  .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border); }
  .modal-title { font-family: var(--font-ui); font-size: 14px; font-weight: 700; color: var(--text); }
  .close-btn { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; border-radius: 4px; display: flex; align-items: center; justify-content: center; transition: all 0.1s; }
  .close-btn:hover { background: var(--surface2); color: var(--text); }
  .modal-body { padding: 16px 20px; display: flex; flex-direction: column; gap: 14px; }
  .field { display: flex; flex-direction: column; gap: 6px; }
  .field label { font-family: var(--font-ui); font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
  .field input, .field select { background: var(--surface2); border: 1px solid var(--border-bright); border-radius: 7px; color: var(--text); font-family: var(--font-mono); font-size: 13px; padding: 8px 10px; outline: none; width: 100%; }
  .field input:focus, .field select:focus { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-glow); }
  .field select { cursor: pointer; }
  .modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 20px; border-top: 1px solid var(--border); }
</style>