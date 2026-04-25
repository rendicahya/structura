<script>
  import { toasts, removeToast } from '../../stores/shared/toast.js';
  import Toast from './Toast.svelte';
</script>

<div class="toast-container">
  {#each $toasts as t (t.id)}
    <Toast
      message={t.message}
      type={t.type}
      duration={t.duration}
      onDone={() => removeToast(t.id)}
    />
  {/each}
</div>

<style>
  .toast-container {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 3000;
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-end;
  }
</style>