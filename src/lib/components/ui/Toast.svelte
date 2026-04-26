<script>
  import { onMount } from "svelte";

  export let message = "";
  export let type = "info"; // 'info' | 'success' | 'warning' | 'error'
  export let duration = 3000;
  export let onDone = () => {};

  let visible = true;
  let progress = 100;
  let interval;

  onMount(() => {
    const step = 100 / (duration / 50);
    interval = setInterval(() => {
      progress -= step;
      if (progress <= 0) {
        clearInterval(interval);
        visible = false;
        setTimeout(onDone, 200);
      }
    }, 50);

    return () => clearInterval(interval);
  });
</script>

<div
  class="toast"
  class:hidden={!visible}
  class:info={type === "info"}
  class:success={type === "success"}
  class:warning={type === "warning"}
  class:error={type === "error"}
>
  <div class="toast-icon">
    {#if type === "success"}
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path
          d="M2 7l3.5 3.5L12 3"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    {:else if type === "warning"}
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path
          d="M7 2L1 12h12L7 2z"
          stroke="currentColor"
          stroke-width="1.3"
          stroke-linejoin="round"
        />
        <path
          d="M7 6v3M7 10.5v.5"
          stroke="currentColor"
          stroke-width="1.3"
          stroke-linecap="round"
        />
      </svg>
    {:else if type === "error"}
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.3" />
        <path
          d="M7 4.5v3M7 9.5v.5"
          stroke="currentColor"
          stroke-width="1.3"
          stroke-linecap="round"
        />
      </svg>
    {:else}
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.3" />
        <path
          d="M7 6.5v3M7 4.5v.5"
          stroke="currentColor"
          stroke-width="1.3"
          stroke-linecap="round"
        />
      </svg>
    {/if}
  </div>
  <span class="toast-msg">{message}</span>
  <div class="toast-progress" style="width: {progress}%"></div>
</div>

<style>
  .toast {
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    border-radius: 10px;
    border: 1px solid var(--border-bright);
    background: var(--surface);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    min-width: 240px;
    max-width: 360px;
    overflow: hidden;
    animation: toastIn 0.2s ease;
    transition:
      opacity 0.2s,
      transform 0.2s;
  }

  .toast.hidden {
    opacity: 0;
    transform: translateX(20px);
  }

  @keyframes toastIn {
    from {
      opacity: 0;
      transform: translateX(20px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .toast-icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .toast.info .toast-icon {
    color: var(--accent);
  }
  .toast.success .toast-icon {
    color: var(--success);
  }
  .toast.warning .toast-icon {
    color: var(--warning);
  }
  .toast.error .toast-icon {
    color: var(--danger);
  }

  .toast-msg {
    font-family: var(--font-ui);
    font-size: 13px;
    color: var(--text);
    flex: 1;
    line-height: 1.4;
  }

  .toast-progress {
    position: absolute;
    bottom: 0;
    left: 0;
    height: 2px;
    transition: width 0.05s linear;
  }

  .toast.info .toast-progress {
    background: var(--accent);
  }
  .toast.success .toast-progress {
    background: var(--success);
  }
  .toast.warning .toast-progress {
    background: var(--warning);
  }
  .toast.error .toast-progress {
    background: var(--danger);
  }
</style>
