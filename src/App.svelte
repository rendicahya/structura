<script>
  import { onMount } from 'svelte';
  import Toolbar from './lib/components/Toolbar.svelte';
  import Canvas from './lib/components/Canvas.svelte';
  import CodePanel from './lib/components/CodePanel.svelte';
  import { initHistory } from './lib/stores/history.js';

  onMount(() => { initHistory(); });

  // Resizable splitter
  let splitPos = 62; // percent
  let draggingSplitter = false;
  let containerEl;

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
</script>

<svelte:window
  on:mousemove={onWindowMousemove}
  on:mouseup={onWindowMouseup}
/>

<div id="app">
  <Toolbar />
  <div class="workspace" bind:this={containerEl}>
    <div class="panel canvas-panel" style="width: {splitPos}%">
      <Canvas />
    </div>

    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
      class="splitter"
      class:active={draggingSplitter}
      on:mousedown={onSplitterMousedown}
    >
      <div class="splitter-handle"></div>
    </div>

    <div class="panel code-panel-wrap" style="width: {100 - splitPos}%">
      <CodePanel />
    </div>
  </div>
</div>

<style>
  #app {
    display: flex;
    flex-direction: column;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
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

  .canvas-panel { position: relative; }
  .code-panel-wrap { position: relative; }

  .splitter {
    width: 5px;
    height: 100%;
    background: var(--border);
    cursor: col-resize;
    flex-shrink: 0;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
    z-index: 10;
  }

  .splitter:hover, .splitter.active {
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