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
    backStack,
    forwardStack,
    canGoBack,
    canGoForward,
    hasVisited,
    normalizeUrl,
    visitUrl,
    goBack,
    goForward,
    initBrowserHistory,
    resetBrowserHistory,
    getSnapshotBH,
    applySnapshotBH,
  } from '../../stores/stack/browserHistory.js';

  // Register history handlers
  registerHistoryHandlers(getSnapshotBH, applySnapshotBH);
  import { clearLogBH } from '../../stores/shared/browserHistoryLog.js';
  import { toast } from '../../stores/shared/toast.js';
  import { isTypingTarget } from '../../utils/keyboard.js';
  import { downloadStructure, pickStructureFile, requestLoad } from '../../utils/saveLoad.js';

  // zoomIn/zoomOut/zoomReset drive the toolbar's zoom buttons; the canvas
  // scales its `.stage` via the bound `zoom` value.
  const { zoom = 1, zoomIn, zoomOut, zoomReset } = $props();
  let zoomPct = $derived(Math.round(zoom * 100) + '%');

  let showConfirmNew = $state(false);

  // The only way to visit a page is the address bar in the browser mock-up
  // (CanvasBrowserHistory), which dispatches `browser:visit`. This handler
  // wraps the store op in the undo/redo bracket.
  function doVisit(raw) {
    if (!normalizeUrl(raw)) {
      toast.error('Enter a URL first');
      return;
    }
    pushHistory();
    const url = visitUrl(raw);
    pushHistory();
    toast.success(`Visited ${url}`);
  }

  function handleBack() {
    if (!$canGoBack) {
      toast.error('Nothing to go back to');
      return;
    }
    pushHistory();
    goBack();
    pushHistory();
  }

  function handleForward() {
    if (!$canGoForward) {
      toast.error('Nothing to go forward to');
      return;
    }
    pushHistory();
    goForward();
    pushHistory();
  }

  function handleNew() {
    if ($hasVisited || $backStack.length || $forwardStack.length) {
      showConfirmNew = true;
    } else {
      confirmNewActual();
    }
  }

  function confirmNewActual() {
    resetBrowserHistory();
    clearLogBH();
    initHistory();
    initBrowserHistory();
    showConfirmNew = false;
    toast.success('Browser reset');
  }

  function handleSave() {
    downloadStructure('browser-history', getSnapshotBH());
    toast.success('Saved successfully');
  }

  function handleLoad() {
    pickStructureFile((snap) => {
      if (!snap) return toast.error('Invalid .stc file');
      requestLoad(snap);
    });
  }

  onMount(() => {
    const onVisit = (/** @type {CustomEvent<string>} */ e) => doVisit(e.detail);
    const onBack = () => handleBack();
    const onForward = () => handleForward();
    window.addEventListener('browser:visit', onVisit);
    window.addEventListener('browser:back', onBack);
    window.addEventListener('browser:forward', onForward);
    return () => {
      window.removeEventListener('browser:visit', onVisit);
      window.removeEventListener('browser:back', onBack);
      window.removeEventListener('browser:forward', onForward);
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
    if (e.key === '[') {
      e.preventDefault();
      handleBack();
    } else if (e.key === ']') {
      e.preventDefault();
      handleForward();
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

    <Tooltip text="Reset the browser and both stacks">
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
        <span class="modal-title">Reset browser</span>
        <button class="close-btn" aria-label="Close" onclick={() => (showConfirmNew = false)}>
          <Icon name="close" size={14} />
        </button>
      </div>
      <div class="modal-body">
        <p class="confirm-text">Clear the current page and both history stacks?</p>
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
  .zoom-label { font-family: var(--font-mono); font-size: 11px; font-weight: 600; color: var(--text-dim); background: var(--surface2); border: 1px solid var(--border); border-radius: 5px; padding: 4px 7px; cursor: pointer; min-width: 42px; text-align: center; transition: all 0.15s; }
  .zoom-label:hover { background: var(--border); color: var(--text); }
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
