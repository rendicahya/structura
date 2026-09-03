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

  // Zoom props are handed to every toolbar; this demo has a fixed-size
  // browser mock-up, so they're accepted but intentionally unused.
  const { zoom = 1, zoomIn, zoomOut, zoomReset } = $props();

  let showConfirmNew = $state(false);
  let showVisit = $state(false);
  let visitValue = $state('');
  let visitInputEl = $state();

  function openVisit() {
    showVisit = true;
    visitValue = '';
    setTimeout(() => visitInputEl?.focus(), 50);
  }

  function doVisit(raw) {
    if (!normalizeUrl(raw)) {
      toast.error('Enter a URL first');
      return;
    }
    pushHistory();
    const url = visitUrl(raw);
    pushHistory();
    showVisit = false;
    visitValue = '';
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
    if (e.key.toLowerCase() === 'n') {
      e.preventDefault();
      openVisit();
    } else if (e.key === '[') {
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
    <Tooltip text="Type a URL and visit it" shortcut="N">
      <button class="btn btn-primary" onclick={openVisit}>
        <Icon name="plus" />
        Visit URL
      </button>
    </Tooltip>

    <Tooltip text={$canGoBack ? 'Back — push current page onto stack 2' : 'Nothing to go back to'} shortcut="[">
      <button class="btn btn-secondary" onclick={handleBack} disabled={!$canGoBack}>
        <Icon name="undo" />
        Back
      </button>
    </Tooltip>

    <Tooltip text={$canGoForward ? 'Forward — pop stack 2' : 'Nothing to go forward to'} shortcut="]">
      <button class="btn btn-secondary" onclick={handleForward} disabled={!$canGoForward}>
        <Icon name="redo" />
        Forward
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

<!-- Visit URL Modal -->
{#if showVisit}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-overlay" onmousedown={() => (showVisit = false)}>
    <div class="modal" onmousedown={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <span class="modal-title">Visit URL</span>
        <button class="close-btn" aria-label="Close" onclick={() => (showVisit = false)}>
          <Icon name="close" size={14} />
        </button>
      </div>
      <div class="modal-body">
        <div class="field">
          <label for="visit-value">Address</label>
          <input
            id="visit-value"
            bind:this={visitInputEl}
            bind:value={visitValue}
            onkeydown={(e) => e.key === 'Enter' && doVisit(visitValue)}
            placeholder="e.g. news.ycombinator.com"
            spellcheck="false"
          />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick={() => (showVisit = false)}>Cancel</button>
        <button class="btn btn-primary" onclick={() => doVisit(visitValue)}>Visit</button>
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
  .field { display: flex; flex-direction: column; gap: 6px; }
  .field label { font-family: var(--font-ui); font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
  .field input { background: var(--surface2); border: 1px solid var(--border-bright); border-radius: 7px; color: var(--text); font-family: var(--font-mono); font-size: 13px; padding: 8px 10px; outline: none; width: 100%; }
  .field input:focus { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-glow); }
  .modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 20px; border-top: 1px solid var(--border); }
</style>
