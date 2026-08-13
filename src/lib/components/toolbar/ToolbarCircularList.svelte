<script>
  import Tooltip from '../ui/Tooltip.svelte';
  import BrandLogo from '../ui/BrandLogo.svelte';
  import Icon from '../ui/Icon.svelte';
  import { pushHistory, undo, redo, canUndo, canRedo, initHistory, registerHistoryHandlers } from '../../stores/shared/history.js';
  import {
    circularListNodes,
    circularListIsEmpty,
    insertHeadCircular,
    insertTailCircular,
    deleteHeadCircular,
    deleteTailCircular,
    traverseCircular,
    garbageCollectCircularList,
    clearCircularList,
    getSnapshotCircularList,
    applySnapshotCircularList,
  } from '../../stores/list/graphCircularList.js';

  // Register history handlers
  registerHistoryHandlers(getSnapshotCircularList, applySnapshotCircularList);
  import { clearLogCircularList } from '../../stores/shared/circularListLog.js';
  import { toast } from '../../stores/shared/toast.js';
  import { onMount } from 'svelte';
  import { isTypingTarget } from '../../utils/keyboard.js';

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
  let showInsert = $state(false);
  /** @type {'head'|'tail'} */
  let insertMode = $state('tail');
  let insertValue = $state('');
  let insertInputEl = $state();

  let zoomPct = $derived(Math.round(zoom * 100) + '%');

  function handleInsertHead() {
    insertMode = 'head';
    showInsert = true;
    insertValue = '';
    setTimeout(() => insertInputEl?.focus(), 50);
  }

  function handleInsertTail() {
    insertMode = 'tail';
    showInsert = true;
    insertValue = '';
    setTimeout(() => insertInputEl?.focus(), 50);
  }

  function confirmInsert() {
    if (!insertValue.trim()) { toast.error('Value cannot be empty'); return; }

    const values = insertValue.split(',').map(v => v.trim()).filter(v => v !== '');
    if (values.length === 0) { toast.error('Value cannot be empty'); return; }

    pushHistory();
    for (const val of values) {
      if (insertMode === 'head') insertHeadCircular(val);
      else insertTailCircular(val);
    }
    pushHistory();

    const where = insertMode === 'head' ? 'head' : 'tail';
    if (values.length > 1) {
      toast.success(`Inserted ${values.length} nodes at ${where}`);
    } else {
      toast.success(`Inserted "${values[0]}" at ${where}`);
    }

    showInsert = false;
    insertValue = '';
  }

  function handleDeleteHead() {
    if ($circularListIsEmpty) { toast.error('List is empty'); return; }
    pushHistory();
    deleteHeadCircular();
    pushHistory();
    toast.success('Deleted head node');
  }

  function handleDeleteTail() {
    if ($circularListIsEmpty) { toast.error('List is empty'); return; }
    pushHistory();
    deleteTailCircular();
    pushHistory();
    toast.success('Deleted tail node');
  }

  function handleTraverse() {
    if ($circularListIsEmpty) { toast.error('List is empty'); return; }
    const order = traverseCircular();
    window.dispatchEvent(new CustomEvent('circularlist:traverse-play', { detail: order }));
  }

  function handleGC() {
    pushHistory();
    garbageCollectCircularList();
    pushHistory();
  }

  function handleNew() {
    if ($circularListNodes.length > 0) {
      showConfirmNew = true;
    } else {
      confirmNewActual();
    }
  }

  function confirmNewActual() {
    clearCircularList();
    initHistory();
    showConfirmNew = false;
    toast.success('List cleared');
  }

  function handleSave() {
    const snap = getSnapshotCircularList();
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'structura-circular-list-save.json'; a.click();
    URL.revokeObjectURL(url);
    toast.success('Saved successfully');
  }

  function handleLoad() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
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
          applySnapshotCircularList(snap);
          toast.success('Loaded successfully');
        } catch { toast.error('Invalid save file'); }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  onMount(() => {
    const onInsertHead = () => handleInsertHead();
    const onInsertTail = () => handleInsertTail();
    const onDeleteHead = () => handleDeleteHead();
    const onDeleteTail = () => handleDeleteTail();
    window.addEventListener('circularlist:insert-head', onInsertHead);
    window.addEventListener('circularlist:insert-tail', onInsertTail);
    window.addEventListener('circularlist:delete-head', onDeleteHead);
    window.addEventListener('circularlist:delete-tail', onDeleteTail);
    return () => {
      window.removeEventListener('circularlist:insert-head', onInsertHead);
      window.removeEventListener('circularlist:insert-tail', onInsertTail);
      window.removeEventListener('circularlist:delete-head', onDeleteHead);
      window.removeEventListener('circularlist:delete-tail', onDeleteTail);
    };
  });

  /** @param {KeyboardEvent} e */
  function onKeydown(e) {
    if (isTypingTarget(e) || e.repeat) return;

    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      const key = e.key.toLowerCase();
      if (key === 's') {
        e.preventDefault();
        handleSave();
      } else if (key === 'o') {
        e.preventDefault();
        handleLoad();
      } else if (e.key === '\\') {
        e.preventDefault();
        ontoggleCode?.();
      }
      return;
    }

    if (e.altKey) return;
    const key = e.key.toLowerCase();
    if (key === 'n') {
      e.preventDefault();
      if (e.shiftKey) handleInsertHead();
      else handleInsertTail();
    } else if (key === 'm') {
      e.preventDefault();
      if (e.shiftKey) handleDeleteTail();
      else handleDeleteHead();
    } else if (key === 't') {
      e.preventDefault();
      handleTraverse();
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
    <Tooltip text="Clear list">
      <button class="btn btn-secondary" onclick={handleNew}>
        <Icon name="new" />
        New
      </button>
    </Tooltip>

    <div class="separator"></div>

    <Tooltip text="Insert at head" shortcut="Shift+N">
      <button class="btn btn-primary" onclick={handleInsertHead}>
        <Icon name="head" />
        Insert Head
      </button>
    </Tooltip>

    <Tooltip text="Insert at tail" shortcut="N">
      <button class="btn btn-primary" onclick={handleInsertTail}>
        <Icon name="tail" />
        Insert Tail
      </button>
    </Tooltip>

    <Tooltip text={$circularListIsEmpty ? 'List is empty' : 'Delete head node'} shortcut="M">
      <button class="btn btn-primary" onclick={handleDeleteHead} disabled={$circularListIsEmpty}>
        <Icon name="dequeue" />
        Delete Head
      </button>
    </Tooltip>

    <Tooltip text={$circularListIsEmpty ? 'List is empty' : 'Delete tail node'} shortcut="Shift+M">
      <button class="btn btn-primary" onclick={handleDeleteTail} disabled={$circularListIsEmpty}>
        <Icon name="dequeue" />
        Delete Tail
      </button>
    </Tooltip>

    <Tooltip text={$circularListIsEmpty ? 'List is empty' : 'Play a full ring traversal'} shortcut="T">
      <button class="btn btn-secondary" onclick={handleTraverse} disabled={$circularListIsEmpty}>
        <Icon name="walk" />
        Traverse
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
      <button class="btn btn-icon" aria-label="Zoom out" onclick={zoomOut}>
        <Icon name="zoomOut" />
      </button>
    </Tooltip>
    <Tooltip text="Reset zoom">
      <button class="zoom-label" aria-label="Reset zoom" onclick={zoomReset}>{zoomPct}</button>
    </Tooltip>
    <Tooltip text="Zoom in" shortcut="Scroll ↑">
      <button class="btn btn-icon" aria-label="Zoom in" onclick={zoomIn}>
        <Icon name="zoomIn" />
      </button>
    </Tooltip>

    <div class="separator"></div>

    <Tooltip text="Undo" shortcut="Ctrl+Z">
      <button class="btn btn-icon" aria-label="Undo" onclick={undo} disabled={!$canUndo}>
        <Icon name="undo" />
      </button>
    </Tooltip>
    <Tooltip text="Redo" shortcut="Ctrl+Y">
      <button class="btn btn-icon" aria-label="Redo" onclick={redo} disabled={!$canRedo}>
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

    <Tooltip text={codeHidden ? 'Show code panel' : 'Hide code panel'} shortcut="Ctrl+\">
      <button class="btn btn-icon" aria-label={codeHidden ? 'Show code panel' : 'Hide code panel'}
        class:active={codeHidden} onclick={() => ontoggleCode?.()}>
        <Icon name="code" {codeHidden} />
      </button>
    </Tooltip>

    <Tooltip text="Keyboard shortcuts" shortcut="?">
      <button class="btn btn-icon" aria-label="Keyboard shortcuts" onclick={() => onopenShortcuts?.()}>
        <Icon name="shortcuts" />
      </button>
    </Tooltip>
  </div>
</div>

<!-- Confirm New Modal -->
{#if showConfirmNew}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-overlay" onmousedown={() => showConfirmNew = false}>
    <div class="modal modal-sm" onmousedown={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <span class="modal-title">New Circular List</span>
        <button class="close-btn" aria-label="Close" onclick={() => showConfirmNew = false}>
          <Icon name="close" size={14} />
        </button>
      </div>
      <div class="modal-body">
        <p class="confirm-text">Start a new circular list? All unsaved work will be lost.</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick={() => showConfirmNew = false}>Cancel</button>
        <button class="btn btn-primary" onclick={confirmNewActual}>Confirm</button>
      </div>
    </div>
  </div>
{/if}

<!-- Insert Modal -->
{#if showInsert}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-overlay" onmousedown={() => showInsert = false}>
    <div class="modal" onmousedown={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <span class="modal-title">Insert at {insertMode === 'head' ? 'head' : 'tail'}</span>
        <button class="close-btn" aria-label="Close" onclick={() => showInsert = false}>
          <Icon name="close" size={14} />
        </button>
      </div>
      <div class="modal-body">
        <div class="field">
          <label for="insert-value">Value</label>
          <input
            id="insert-value"
            bind:this={insertInputEl}
            bind:value={insertValue}
            onkeydown={(e) => e.key === 'Enter' && confirmInsert()}
            placeholder="Enter value..."
            spellcheck="false"
          />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick={() => showInsert = false}>Cancel</button>
        <button class="btn btn-primary" onclick={confirmInsert}>Insert</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .toolbar { display: flex; align-items: center; justify-content: space-between; padding: 0 20px; height: 52px; background: var(--toolbar-bg); border-bottom: 1px solid var(--border); flex-shrink: 0; gap: 12px; }
  .brand { display: flex; align-items: center; gap: 10px; }
  .brand-name { font-family: var(--font-ui); font-weight: 800; font-size: 18px; letter-spacing: -0.5px; color: var(--text); }
  .actions { display: flex; align-items: center; gap: 6px; }
  .separator { width: 1px; height: 20px; background: var(--border); margin: 0 4px; }
  .btn { display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 7px; border: 1px solid transparent; cursor: pointer; font-family: var(--font-ui); font-size: 13px; font-weight: 600; transition: all 0.15s ease; }
  .btn:disabled { opacity: 0.3; cursor: not-allowed; }
  .btn-primary { background: var(--accent); color: #fff; }
  .btn-primary:hover:not(:disabled) { background: #6f9fff; box-shadow: 0 0 16px var(--accent-glow); }
  .btn-gc { background: rgba(78,204,163,0.12); color: var(--success); border: 1px solid rgba(78,204,163,0.3); }
  .btn-gc:hover { background: rgba(78,204,163,0.22); }
  .btn-secondary { background: var(--surface2); color: var(--text-dim); border-color: var(--border); }
  .btn-secondary:hover:not(:disabled) { background: var(--border); color: var(--text); }
  .btn-icon { background: var(--surface2); color: var(--text-dim); border-color: var(--border); padding: 6px 8px; }
  .btn-icon:hover:not(:disabled) { background: var(--border); color: var(--text); }
  .btn-icon.active { background: var(--accent-dim); color: #fff; border-color: var(--accent-dim); }
  .zoom-label { font-family: var(--font-mono); font-size: 11px; font-weight: 600; color: var(--text-dim); background: var(--surface2); border: 1px solid var(--border); border-radius: 5px; padding: 4px 7px; cursor: pointer; min-width: 42px; text-align: center; transition: all 0.15s; }
  .zoom-label:hover { background: var(--border); color: var(--text); }
  .modal-overlay { position: fixed; inset: 0; z-index: 2000; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; }
  .modal { background: var(--surface); border: 1px solid var(--border-bright); border-radius: 14px; width: 260px; box-shadow: 0 24px 64px rgba(0,0,0,0.6); overflow: hidden; }
  .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border); }
  .modal-title { font-family: var(--font-ui); font-size: 14px; font-weight: 700; color: var(--text); }
  .close-btn { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; border-radius: 4px; display: flex; align-items: center; justify-content: center; }
  .close-btn:hover { background: var(--surface2); color: var(--text); }
  .modal-body { padding: 16px 20px; display: flex; flex-direction: column; gap: 14px; }
  .field { display: flex; flex-direction: column; gap: 6px; }
  .field label { font-family: var(--font-ui); font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
  .field input { background: var(--surface2); border: 1px solid var(--border-bright); border-radius: 7px; color: var(--text); font-family: var(--font-mono); font-size: 13px; padding: 8px 10px; outline: none; width: 100%; }
  .field input:focus { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-glow); }
  .modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 20px; border-top: 1px solid var(--border); }
</style>
