<script>
  const { onclose } = $props();

  function close() {
    onclose?.();
  }

  function onKeydown(e) {
    if (e.key === "Escape") close();
  }

  const shortcuts = [
    { category: "Canvas" },
    { key: "Drag canvas", desc: "Pan around" },
    { key: "Scroll", desc: "Zoom in / out" },
    { key: "Right click", desc: "Add node at position" },
    { category: "Nodes" },
    { key: "Drag node", desc: "Move node" },
    { key: "Double click", desc: "Edit data value" },
    { key: "Right click", desc: "Open node menu" },
    { key: "Drag port →", desc: "Connect next pointer" },
    { key: "Drag port ←", desc: "Connect prev pointer (DLL)" },
    { category: "Keyboard" },
    { key: "Ctrl + Z", desc: "Undo" },
    { key: "Ctrl + Y", desc: "Redo" },
    { key: "Escape", desc: "Close menu / cancel edit" },
  ];
</script>

<svelte:window on:keydown={onKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="overlay" onmousedown={close}>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="guide" onmousedown={(e) => e.stopPropagation()}>
    <div class="guide-header">
      <span class="guide-title">Keyboard Shortcuts</span>
      <button class="close-btn" aria-label="Close" onclick={close}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M2 2l10 10M12 2L2 12"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
        </svg>
      </button>
    </div>

    <div class="guide-body">
      {#each shortcuts as item}
        {#if item.category}
          <div class="category">{item.category}</div>
        {:else}
          <div class="shortcut-row">
            <kbd class="key">{item.key}</kbd>
            <span class="desc">{item.desc}</span>
          </div>
        {/if}
      {/each}
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 2000;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.15s ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .guide {
    background: var(--surface);
    border: 1px solid var(--border-bright);
    border-radius: 14px;
    width: 360px;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
    animation: slideIn 0.15s ease;
    overflow: hidden;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-12px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .guide-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
  }

  .guide-title {
    font-family: var(--font-ui);
    font-size: 14px;
    font-weight: 700;
    color: var(--text);
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.1s;
  }
  .close-btn:hover {
    background: var(--surface2);
    color: var(--text);
  }

  .guide-body {
    padding: 12px 20px 20px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .category {
    font-family: var(--font-ui);
    font-size: 10px;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.8px;
    margin-top: 12px;
    margin-bottom: 4px;
  }

  .shortcut-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 5px 0;
  }

  .key {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-dim);
    background: var(--surface2);
    border: 1px solid var(--border-bright);
    border-radius: 5px;
    padding: 3px 8px;
    white-space: nowrap;
  }

  .desc {
    font-family: var(--font-ui);
    font-size: 13px;
    color: var(--text-dim);
  }
</style>
