<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';

  export let x = 0;
  export let y = 0;
  export let node = null;
  export let isHead = false;
  export let isTail = false;
  export let isWalk = false;

  const dispatch = createEventDispatcher();

  let menuEl;
  let varNameInput;
  let dataInput;
  let editingVarName = false;
  let editingData = false;
  let tmpVarName = '';
  let tmpData = '';

  $: if (node) {
    tmpVarName = node.varName;
    tmpData = node.data;
  }

  function close() { dispatch('close'); }

  function handleRename() {
    editingVarName = true;
    setTimeout(() => varNameInput?.focus(), 10);
  }

  function handleSetWalk() { dispatch('setWalk'); close(); }

  function handleEditData() {
    editingData = true;
    setTimeout(() => dataInput?.focus(), 10);
  }

  function commitVarName() {
    if (tmpVarName.trim()) dispatch('rename', { varName: tmpVarName.trim() });
    editingVarName = false;
    close();
  }

  function commitData() {
    dispatch('editData', { data: tmpData });
    editingData = false;
    close();
  }

  function handleUnlink() { dispatch('unlink'); close(); }
  function handleDisconnect() { dispatch('disconnect'); close(); }
  function handleSetHead() { dispatch('setHead'); close(); }
  function handleSetTail() { dispatch('setTail'); close(); }

  function handleKeydown(e) { if (e.key === 'Escape') close(); }

  function handleOutsideClick(e) {
    if (menuEl && !menuEl.contains(e.target)) close();
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
    setTimeout(() => window.addEventListener('mousedown', handleOutsideClick), 0);

    const rect = menuEl.getBoundingClientRect();
    if (rect.right > window.innerWidth) menuEl.style.left = (x - rect.width) + 'px';
    if (rect.bottom > window.innerHeight) menuEl.style.top = (y - rect.height) + 'px';
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeydown);
    window.removeEventListener('mousedown', handleOutsideClick);
  });
</script>

<div class="context-menu" bind:this={menuEl} style="left: {x}px; top: {y}px;">
  <div class="menu-header">
    <span class="menu-node-label">{node?.varName ?? 'Node'}</span>
    <div class="menu-badges">
      {#if isHead}<span class="badge head">HEAD</span>{/if}
      {#if isTail}<span class="badge tail">TAIL</span>{/if}
      {#if isWalk}<span class="badge walk">WALK</span>{/if}
    </div>
  </div>

  {#if editingVarName}
    <div class="menu-input-row">
      <label>Variable name</label>
      <input bind:this={varNameInput} bind:value={tmpVarName}
        on:keydown={(e) => e.key === 'Enter' && commitVarName()}
        placeholder="varName" spellcheck="false" />
      <button class="btn-confirm" on:click={commitVarName}>Apply</button>
    </div>
  {:else if editingData}
    <div class="menu-input-row">
      <label>Data value</label>
      <input bind:this={dataInput} bind:value={tmpData}
        on:keydown={(e) => e.key === 'Enter' && commitData()}
        placeholder="value" spellcheck="false" />
      <button class="btn-confirm" on:click={commitData}>Apply</button>
    </div>
  {:else}
    <button class="menu-item" on:click={handleRename}>
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <path d="M2 10.5H4.5L10 5L8 3L2.5 8.5V10.5Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
      </svg>
      Rename variable
    </button>

    <button class="menu-item" on:click={handleEditData}>
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <rect x="2" y="2" width="9" height="9" rx="1.5" stroke="currentColor" stroke-width="1.3"/>
        <path d="M5 6.5h3M6.5 5v3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
      </svg>
      Edit data
    </button>

    <div class="menu-divider"></div>

    <button class="menu-item head-item" on:click={handleSetHead}>
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" stroke-width="1.3"/>
        <path d="M4.5 6.5h4M6.5 4.5l2 2-2 2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      {isHead ? '✓ Head (unset)' : 'Set as head'}
    </button>

    <button class="menu-item tail-item" on:click={handleSetTail}>
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" stroke-width="1.3"/>
        <path d="M8.5 6.5h-4M6.5 4.5l-2 2 2 2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      {isTail ? '✓ Tail (unset)' : 'Set as tail'}
    </button>

    <button class="menu-item walk-item" on:click={handleSetWalk}>
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" stroke-width="1.3"/>
        <circle cx="6.5" cy="6.5" r="1.5" fill="currentColor"/>
        <path d="M6.5 2V1M6.5 12v-1M2 6.5H1M12 6.5h-1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
      </svg>
      {isWalk ? '✓ Walk (unset)' : 'Set as walk'}
    </button>

    {#if node?.nextId}
      <div class="menu-divider"></div>
      <button class="menu-item" on:click={handleDisconnect}>
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <path d="M4 4L9 9M9 4L4 9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
        </svg>
        Disconnect next
      </button>
    {/if}

    <div class="menu-divider"></div>
    <button class="menu-item danger" on:click={handleUnlink}>
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <path d="M2 6.5h2.5M8.5 6.5H11M4.5 6.5C4.5 5.1 5.6 4 7 4s2.5 1.1 2.5 2.5S8.4 9 7 9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
      </svg>
      Unlink node
    </button>
  {/if}
</div>

<style>
  .context-menu {
    position: fixed;
    z-index: 1000;
    background: var(--surface);
    border: 1px solid var(--border-bright);
    border-radius: 10px;
    padding: 6px;
    min-width: 190px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04);
    animation: menuIn 0.12s ease;
  }

  @keyframes menuIn {
    from { opacity: 0; transform: scale(0.95) translateY(-4px); }
    to   { opacity: 1; transform: scale(1) translateY(0); }
  }

  .menu-header {
    padding: 4px 8px 8px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }

  .menu-node-label {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--accent);
    font-weight: 500;
  }

  .menu-badges { display: flex; gap: 4px; }

  .badge {
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 700;
    padding: 2px 5px;
    border-radius: 3px;
    letter-spacing: 0.5px;
  }
  .badge.head { background: rgba(78,204,163,0.15); color: var(--success); }
  .badge.tail { background: rgba(192,132,252,0.15); color: #c084fc; }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 7px 10px;
    background: none;
    border: none;
    border-radius: 6px;
    color: var(--text-dim);
    font-family: var(--font-ui);
    font-size: 13px;
    cursor: pointer;
    text-align: left;
    transition: all 0.1s;
  }

  .menu-item:hover          { background: var(--surface2); color: var(--text); }
  .menu-item.danger         { color: var(--danger); }
  .menu-item.danger:hover   { background: rgba(255,91,110,0.1); color: var(--danger); }
  .menu-item.head-item      { color: var(--success); }
  .menu-item.head-item:hover{ background: rgba(78,204,163,0.08); color: var(--success); }
  .menu-item.tail-item      { color: #c084fc; }
  .menu-item.tail-item:hover{ background: rgba(192,132,252,0.08); color: #c084fc; }

  .menu-divider { height: 1px; background: var(--border); margin: 4px 0; }

  .menu-input-row {
    padding: 6px 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .menu-input-row label {
    font-size: 11px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .menu-input-row input {
    background: var(--surface2);
    border: 1px solid var(--border-bright);
    border-radius: 6px;
    color: var(--text);
    font-family: var(--font-mono);
    font-size: 13px;
    padding: 6px 8px;
    outline: none;
    width: 100%;
  }
  .menu-input-row input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-glow);
  }
  .btn-confirm {
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 6px;
    padding: 5px 10px;
    font-family: var(--font-ui);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    align-self: flex-end;
  }
  .btn-confirm:hover { background: #6f9fff; }
  .menu-item.walk-item      { color: #fb923c; }
  .menu-item.walk-item:hover{ background: rgba(251,146,60,0.08); color: #fb923c; }
  .badge.walk { background: rgba(251,146,60,0.15); color: #fb923c; }
</style>