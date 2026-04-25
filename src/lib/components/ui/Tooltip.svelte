<script>
  export let text = '';
  export let shortcut = '';

  let visible = false;
  let x = 0;
  let y = 0;
  let triggerEl;

  function show() {
    const rect = triggerEl.getBoundingClientRect();
    x = rect.left + rect.width / 2;
    y = rect.bottom + 6;
    visible = true;
  }

  function hide() { visible = false; }
</script>

<div
  class="tooltip-wrapper"
  bind:this={triggerEl}
  on:mouseenter={show}
  on:mouseleave={hide}
  on:focusin={show}
  on:focusout={hide}
>
  <slot />
</div>

{#if visible}
  <div class="tooltip" style="left: {x}px; top: {y}px;">
    <span class="tooltip-text">{text}</span>
    {#if shortcut}
      <span class="tooltip-shortcut">{shortcut}</span>
    {/if}
  </div>
{/if}

<style>
  .tooltip-wrapper {
    display: inline-flex;
  }

  .tooltip {
    position: fixed;
    transform: translateX(-50%);
    z-index: 9999;
    background: var(--surface2);
    border: 1px solid var(--border-bright);
    border-radius: 6px;
    padding: 5px 9px;
    display: flex;
    align-items: center;
    gap: 7px;
    white-space: nowrap;
    pointer-events: none;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    animation: tipIn 0.1s ease;
  }

  @keyframes tipIn {
    from { opacity: 0; transform: translateX(-50%) translateY(-3px); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  .tooltip-text {
    font-family: var(--font-ui);
    font-size: 12px;
    font-weight: 500;
    color: var(--text);
  }

  .tooltip-shortcut {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-muted);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 1px 5px;
  }
</style>