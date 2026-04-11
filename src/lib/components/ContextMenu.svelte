<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';

  export let x = 0;
  export let y = 0;
  export let node = null;

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

  function handleEditData() {
    editingData = true;
    setTimeout(() => dataInput?.focus(), 10);
  }

  function commitVarName() {
    if (tmpVarName.trim()) {
      dispatch('rename', { varName: tmpVarName.trim() });
    }
    editingVarName = false;
    close();
  }

  function commitData() {
    dispatch('editData', { data: tmpData });
    editingData = false;
    close();
  }

  function handleDelete() {
    dispatch('delete');
    close();
  }

  function handleDisconnect() {
    dispatch('disconnect');
    close();
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') close();
  }

  function handleOutsideClick(e) {
    if (menuEl && !menuEl.contains(e.target)) close();
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
    setTimeout(() => window.addEventListener('mousedown', handleOutsideClick), 0);

    // Adjust position so menu stays in viewport
    const rect = menuEl.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (rect.right > vw) menuEl.style.left = (x - rect.width) + 'px';
    if (rect.bottom > vh) menuEl.style.top = (y - rect.height) + 'px';
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeydown);
    window.removeEventListener('mousedown', handleOutsideClick);
  });
</script>

<div
  class="context-menu"
  bind:this={menuEl}
  style="left: {x}px; top: {y}px;"
>
  <div class="menu-header">
    <span class="menu-node-label">{node?.varName ?? 'Node'}</span>
  </div>

  {#if editingVarName}
    <div class="menu-input-row">
      <label>Variable name</label>
      <input
        bind:this={varNameInput}
        bind:value={tmpVarName}
        on:keydown={(e) => e.key === 'Enter' && commitVarName()}
        placeholder="varName"
        spellcheck="false"
      />
      <button class="btn-confirm" on:click={commitVarName}>Apply</button>
    </div>
  {:else if editingData}
    <div class="menu-input-row">
      <label>Data value</label>
      <input
        bind:this={dataInput}
        bind:value={tmpData}
        on:keydown={(e) => e.key === 'Enter' && commitData()}
        placeholder="value"
        spellcheck="false"
      />
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
    {#if node?.nextId}
      <button class="menu-item" on:click={handleDisconnect}>
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <path d="M4 4L9 9M9 4L4 9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
        </svg>
        Disconnect next
      </button>
    {/if}
    <div class="menu-divider"></div>
    <button class="menu-item danger" on:click={handleDelete}>
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <path d="M2.5 4H10.5M5 4V2.5H8V4M5.5 6V9.5M7.5 6V9.5M3.5 4L4 10.5H9L9.5 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Delete node
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
    min-width: 180px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04);
    animation: menuIn 0.12s ease;
  }

  @keyframes menuIn {
    from { opacity: 0; transform: scale(0.95) translateY(-4px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }

  .menu-header {
    padding: 4px 8px 8px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 4px;
  }

  .menu-node-label {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--accent);
    font-weight: 500;
  }

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

  .menu-item:hover {
    background: var(--surface2);
    color: var(--text);
  }

  .menu-item.danger { color: var(--danger); }
  .menu-item.danger:hover { background: rgba(255, 91, 110, 0.1); color: var(--danger); }

  .menu-divider {
    height: 1px;
    background: var(--border);
    margin: 4px 0;
  }

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
</style>