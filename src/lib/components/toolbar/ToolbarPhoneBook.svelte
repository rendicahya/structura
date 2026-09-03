<script>
  import { onMount } from 'svelte';
  import Tooltip from '../ui/Tooltip.svelte';
  import BrandLogo from '../ui/BrandLogo.svelte';
  import Icon from '../ui/Icon.svelte';
  import {
    pushHistory,
    undo,
    redo,
    canUndo,
    canRedo,
    initHistory,
    registerHistoryHandlers,
  } from '../../stores/shared/history.js';
  import {
    pbIsEmpty,
    addContact,
    removeContact,
    initPhoneBook,
    clearPhoneBook,
    getSnapshotPB,
    applySnapshotPB,
  } from '../../stores/hash/phoneBook.js';

  // Register history handlers
  registerHistoryHandlers(getSnapshotPB, applySnapshotPB);
  import { clearLogPB } from '../../stores/shared/phoneBookLog.js';
  import { toast } from '../../stores/shared/toast.js';
  import { isTypingTarget } from '../../utils/keyboard.js';
  import { downloadStructure, pickStructureFile, requestLoad } from '../../utils/saveLoad.js';

  // Zoom props are handed to every toolbar; this demo renders a fixed-size
  // contacts mock-up, so they're accepted but intentionally unused.
  const { zoom = 1, zoomIn, zoomOut, zoomReset } = $props();

  let showConfirmNew = $state(false);

  // The contacts UI (CanvasPhoneBook) owns every interaction and dispatches
  // these events; here we only wrap the structural ones in the undo/redo
  // bracket. Lookup is a pure read and goes straight to the store from the
  // canvas.
  function handleAdd({ name, phone }) {
    pushHistory();
    addContact(name, phone);
    pushHistory();
    toast.success(`Saved "${name}"`);
  }

  function handleRemove(id) {
    pushHistory();
    removeContact(id);
    pushHistory();
  }

  function handleNew() {
    if (!$pbIsEmpty) {
      showConfirmNew = true;
    } else {
      confirmNewActual();
    }
  }

  function confirmNewActual() {
    clearPhoneBook();
    clearLogPB();
    initHistory();
    initPhoneBook();
    showConfirmNew = false;
    toast.success('Phone book cleared');
  }

  function handleSave() {
    downloadStructure('phone-book', getSnapshotPB());
    toast.success('Saved successfully');
  }

  function handleLoad() {
    pickStructureFile((snap) => {
      if (!snap) return toast.error('Invalid .stc file');
      requestLoad(snap);
    });
  }

  onMount(() => {
    const onAdd = (/** @type {CustomEvent} */ e) => handleAdd(e.detail);
    const onRemove = (/** @type {CustomEvent} */ e) => handleRemove(e.detail);
    window.addEventListener('phonebook:add', onAdd);
    window.addEventListener('phonebook:remove', onRemove);
    return () => {
      window.removeEventListener('phonebook:add', onAdd);
      window.removeEventListener('phonebook:remove', onRemove);
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

    <Tooltip text="Clear the phone book">
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
  <div class="modal-overlay" onmousedown={() => (showConfirmNew = false)}>
    <div class="modal modal-sm" onmousedown={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <span class="modal-title">Clear phone book</span>
        <button class="close-btn" aria-label="Close" onclick={() => (showConfirmNew = false)}>
          <Icon name="close" size={14} />
        </button>
      </div>
      <div class="modal-body">
        <p class="confirm-text">Delete every contact from every bucket?</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick={() => (showConfirmNew = false)}>Cancel</button>
        <button class="btn btn-primary" onclick={confirmNewActual}>Confirm</button>
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
  .btn-secondary { background: var(--surface2); color: var(--text-dim); border-color: var(--border); }
  .btn-secondary:hover:not(:disabled) { background: var(--border); color: var(--text); }
  .btn-icon { background: var(--surface2); color: var(--text-dim); border-color: var(--border); padding: 6px 8px; }
  .btn-icon:hover:not(:disabled) { background: var(--border); color: var(--text); }
  .modal-overlay { position: fixed; inset: 0; z-index: 2000; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; }
  .modal { background: var(--surface); border: 1px solid var(--border-bright); border-radius: 14px; width: 320px; box-shadow: 0 24px 64px rgba(0,0,0,0.6); overflow: hidden; }
  .modal-sm { width: 280px; }
  .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border); }
  .modal-title { font-family: var(--font-ui); font-size: 14px; font-weight: 700; color: var(--text); }
  .close-btn { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; border-radius: 4px; display: flex; align-items: center; justify-content: center; }
  .close-btn:hover { background: var(--surface2); color: var(--text); }
  .modal-body { padding: 16px 20px; display: flex; flex-direction: column; gap: 14px; }
  .confirm-text { font-family: var(--font-ui); font-size: 13px; color: var(--text-dim); margin: 0; line-height: 1.5; }
  .modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 20px; border-top: 1px solid var(--border); }
</style>
