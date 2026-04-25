<script>
  import { onMount } from 'svelte';
  import Toolbar from './lib/components/toolbar/Toolbar.svelte';
  import ToolbarStack from './lib/components/toolbar/ToolbarStack.svelte';
  import Canvas from './lib/components/canvas/Canvas.svelte';
  import CanvasStack from './lib/components/canvas/CanvasStack.svelte';
  import CanvasDLL from './lib/components/canvas/CanvasDLL.svelte';
  import { stackLog } from './lib/stores/shared/stackLog.js';
  import CodePanel from './lib/components/code/CodePanel.svelte';
  import { codeLog } from './lib/stores/sll/sllLog.js';
  import { codeLogDLL } from './lib/stores/dll/dllLog.js';
  import { initHistory } from './lib/stores/shared/history.js';
  import ToastContainer from './lib/components/ui/ToastContainer.svelte';
  import ShortcutGuide from './lib/components/ui/ShortcutGuide.svelte';

  onMount(() => {
    initHistory();
    // Set default hash
    if (!location.hash || location.hash === '#') {
      location.hash = '#/linked-list';
    }
    page = location.hash;
    window.addEventListener('hashchange', () => { page = location.hash; });
  });

  let page = '#/linked-list';
  let showShortcuts = false;
  let splitPos = parseFloat(localStorage.getItem('structura-split') ?? '62');
  let codeHidden = localStorage.getItem('structura-code-hidden') === 'true';

  $: isSLL = page === '#/linked-list';
  $: isDLL = page === '#/doubly-linked-list';

  // Resizable splitter
  let draggingSplitter = false;
  let containerEl;
  let zoom = 1;

  const ZOOM_STEP = 0.1;

  $: localStorage.setItem('structura-split', splitPos);
  $: localStorage.setItem('structura-code-hidden', String(codeHidden));
  
  function zoomIn()    { zoom = Math.min(2,   +(zoom + ZOOM_STEP).toFixed(2)); }
  function zoomOut()   { zoom = Math.max(0.3, +(zoom - ZOOM_STEP).toFixed(2)); }
  function zoomReset() { zoom = 1; }

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

  function onWindowMouseup() { draggingSplitter = false; }

  function navigate(hash) {
    location.hash = hash;
    // Reset zoom saat ganti halaman
    zoom = 1;
  }

  function onKeydown(e) {
    if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
      showShortcuts = !showShortcuts;
    }
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
    <button class="nav-tab" class:active={isSLL} onclick={() => navigate('#/linked-list')}>
      Linked List
    </button>
    <button class="nav-tab" class:active={isDLL} onclick={() => navigate('#/doubly-linked-list')}>
      Doubly Linked List
    </button>
    <button class="nav-tab" class:active={page === '#/stack'} onclick={() => navigate('#/stack')}>
      Stack
    </button>
  </nav>

  {#if page === '#/linked-list' || page === '#/doubly-linked-list'}
    <Toolbar
      mode={page === '#/linked-list' ? 'sll' : 'dll'}
      {zoom} {zoomIn} {zoomOut} {zoomReset}
      {codeHidden}
      ontoggleCode={() => codeHidden = !codeHidden}
      onopenShortcuts={() => showShortcuts = true}
    />
  {:else if page === '#/stack'}
    <ToolbarStack
      {zoom} {zoomIn} {zoomOut} {zoomReset}
      {codeHidden}
      ontoggleCode={() => codeHidden = !codeHidden}
      onopenShortcuts={() => showShortcuts = true}
    />
  {/if}

  <!-- workspace -->
  <div class="workspace" bind:this={containerEl}>
    <div class="panel canvas-panel" style={codeHidden ? 'width:100%' : `width:${splitPos}%`}>
      {#if page === '#/linked-list'}
        <Canvas bind:zoom />
      {:else if page === '#/doubly-linked-list'}
        <CanvasDLL bind:zoom />
      {:else if page === '#/stack'}
        <CanvasStack />
      {/if}
    </div>

    {#if !codeHidden}
      <div class="splitter" class:active={draggingSplitter} onmousedown={onSplitterMousedown}>
        <div class="splitter-handle"></div>
      </div>
      <div class="panel code-panel-wrap" style="width:{100 - splitPos}%">
        <CodePanel log={
          page === '#/linked-list' ? codeLog :
          page === '#/doubly-linked-list' ? codeLogDLL :
          stackLog
        } />
      </div>
    {/if}
  </div>
</div>

{#if showShortcuts}
  <ShortcutGuide onclose={() => showShortcuts = false} />
{/if}

<ToastContainer />

<style>
  #app { display: flex; flex-direction: column; width: 100vw; height: 100vh; overflow: hidden; }

  .page-nav {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 6px 20px 0;
    background: var(--surface);
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
  .nav-tab:hover { color: var(--text-dim); }
  .nav-tab.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }

  .workspace { display: flex; flex: 1; overflow: hidden; position: relative; }
  .panel { height: 100%; overflow: hidden; flex-shrink: 0; }
  .canvas-panel { position: relative; }
  .code-panel-wrap { position: relative; }
  .splitter { width: 5px; height: 100%; background: var(--border); cursor: col-resize; flex-shrink: 0; display: flex; align-items: center; justify-content: center; transition: background 0.15s; z-index: 10; }
  .splitter:hover, .splitter.active { background: var(--accent-dim); }
  .splitter-handle { width: 3px; height: 32px; border-radius: 2px; background: var(--border-bright); transition: background 0.15s; }
  .splitter:hover .splitter-handle, .splitter.active .splitter-handle { background: var(--accent); }
</style>