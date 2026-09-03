<script>
  import Tooltip from '../ui/Tooltip.svelte';
  import BrandLogo from '../ui/BrandLogo.svelte';
  import Icon from '../ui/Icon.svelte';
  import { pushHistory, undo, redo, canUndo, canRedo, initHistory, registerHistoryHandlers } from '../../stores/shared/history.js';
  import {
    dclNodes,
    dclIsEmpty,
    insertHeadDCL,
    insertTailDCL,
    deleteHeadDCL,
    deleteTailDCL,
    traverseDCL,
    traverseBackwardDCL,
    garbageCollectDCL,
    clearDCL,
    getSnapshotDCL,
    applySnapshotDCL,
  } from '../../stores/list/graphDoublyCircularList.js';

  // Register history handlers
  registerHistoryHandlers(getSnapshotDCL, applySnapshotDCL);
  import { clearLogDCL } from '../../stores/shared/dclLog.js';
  import { toast } from '../../stores/shared/toast.js';
  import { downloadStructure, pickStructureFile, requestLoad } from '../../utils/saveLoad.js';
  import { onMount } from 'svelte';
  import { isTypingTarget } from '../../utils/keyboard.js';

  const {
    zoom = 1,
    zoomIn,
    zoomOut,
    zoomReset,
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
      if (insertMode === 'head') insertHeadDCL(val);
      else insertTailDCL(val);
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
    if ($dclIsEmpty) { toast.error('List is empty'); return; }
    pushHistory();
    deleteHeadDCL();
    pushHistory();
    toast.success('Deleted head node');
  }

  function handleDeleteTail() {
    if ($dclIsEmpty) { toast.error('List is empty'); return; }
    pushHistory();
    deleteTailDCL();
    pushHistory();
    toast.success('Deleted tail node');
  }

  function handleTraverse() {
    if ($dclIsEmpty) { toast.error('List is empty'); return; }
    const order = traverseDCL();
    window.dispatchEvent(new CustomEvent('dcl:traverse-play', { detail: order }));
  }

  function handleTraverseBackward() {
    if ($dclIsEmpty) { toast.error('List is empty'); return; }
    const order = traverseBackwardDCL();
    window.dispatchEvent(new CustomEvent('dcl:traverse-play', { detail: order }));
  }

  function handleGC() {
    pushHistory();
    garbageCollectDCL();
    pushHistory();
  }

  function handleNew() {
    if ($dclNodes.length > 0) {
      showConfirmNew = true;
    } else {
      confirmNewActual();
    }
  }

  function confirmNewActual() {
    clearDCL();
    initHistory();
    showConfirmNew = false;
    toast.success('List cleared');
  }

  function handleSave() {
    downloadStructure('doubly-circular-list', getSnapshotDCL());
    toast.success('Saved successfully');
  }

  function handleLoad() {
    pickStructureFile((snap) => {
      if (!snap) return toast.error('Invalid .stc file');
      requestLoad(snap);
    });
  }

  onMount(() => {
    const onInsertHead = () => handleInsertHead();
    const onInsertTail = () => handleInsertTail();
    const onDeleteHead = () => handleDeleteHead();
    const onDeleteTail = () => handleDeleteTail();
    window.addEventListener('dcl:insert-head', onInsertHead);
    window.addEventListener('dcl:insert-tail', onInsertTail);
    window.addEventListener('dcl:delete-head', onDeleteHead);
    window.addEventListener('dcl:delete-tail', onDeleteTail);
    return () => {
      window.removeEventListener('dcl:insert-head', onInsertHead);
      window.removeEventListener('dcl:insert-tail', onInsertTail);
      window.removeEventListener('dcl:delete-head', onDeleteHead);
      window.removeEventListener('dcl:delete-tail', onDeleteTail);
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
      if (e.shiftKey) handleTraverseBackward();
      else handleTraverse();
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

    <Tooltip text={$dclIsEmpty ? 'List is empty' : 'Delete head node'} shortcut="M">
      <button class="btn btn-primary" onclick={handleDeleteHead} disabled={$dclIsEmpty}>
        <Icon name="dequeue" />
        Delete Head
      </button>
    </Tooltip>

    <Tooltip text={$dclIsEmpty ? 'List is empty' : 'Delete tail node'} shortcut="Shift+M">
      <button class="btn btn-primary" onclick={handleDeleteTail} disabled={$dclIsEmpty}>
        <Icon name="dequeue" />
        Delete Tail
      </button>
    </Tooltip>

    <Tooltip text={$dclIsEmpty ? 'List is empty' : 'Play a forward ring traversal from head'} shortcut="T">
      <button class="btn btn-secondary" onclick={handleTraverse} disabled={$dclIsEmpty}>
        <Icon name="walk" />
        Traverse →
      </button>
    </Tooltip>

    <Tooltip text={$dclIsEmpty ? 'List is empty' : 'Play a backward ring traversal from tail'} shortcut="Shift+T">
      <button class="btn btn-secondary" onclick={handleTraverseBackward} disabled={$dclIsEmpty}>
        <Icon name="walk" />
        Traverse ←
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

    <Tooltip text="Clear list">
      <button class="btn btn-secondary" onclick={handleNew}>
        <Icon name="new" />
        New
      </button>
    </Tooltip>

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
  </div>
</div>

<!-- Confirm New Modal -->
{#if showConfirmNew}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-overlay" onmousedown={() => showConfirmNew = false}>
    <div class="modal modal-sm" onmousedown={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <span class="modal-title">New Doubly Circular List</span>
        <button class="close-btn" aria-label="Close" onclick={() => showConfirmNew = false}>
          <Icon name="close" size={14} />
        </button>
      </div>
      <div class="modal-body">
        <p class="confirm-text">Start a new doubly circular list? All unsaved work will be lost.</p>
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
  .btn-icon:hover:not(:disabled) { background: var(--border); color: var(--text); }  .zoom-label { font-family: var(--font-mono); font-size: 11px; font-weight: 600; color: var(--text-dim); background: var(--surface2); border: 1px solid var(--border); border-radius: 5px; padding: 4px 7px; cursor: pointer; min-width: 42px; text-align: center; transition: all 0.15s; }
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
