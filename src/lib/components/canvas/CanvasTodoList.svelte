<script>
  import { flip } from 'svelte/animate';
  import { fly } from 'svelte/transition';
  import {
    todos,
    tdIsEmpty,
    tdCount,
    tdRemaining,
  } from '../../stores/list/todoList.js';

  // Zoom is bindable on every canvas; this demo renders a fixed checklist
  // mock-up and ignores it.
  let { zoom = $bindable(1) } = $props();

  const SUGGESTIONS = [
    'Buy groceries',
    'Finish lab report',
    'Call the dentist',
    'Reply to emails',
    'Water the plants',
    'Read one chapter',
    'Push the branch',
    'Book train tickets',
  ];

  let entry = $state('');

  function add() {
    const text = entry.trim();
    if (!text) return;
    window.dispatchEvent(new CustomEvent('todolist:add', { detail: { text } }));
    entry = '';
  }

  function toggle(id) {
    window.dispatchEvent(new CustomEvent('todolist:toggle', { detail: id }));
  }

  function remove(id) {
    window.dispatchEvent(new CustomEvent('todolist:remove', { detail: id }));
  }

  function clearDone() {
    window.dispatchEvent(new CustomEvent('todolist:cleardone'));
  }

  let doneCount = $derived($tdCount - $tdRemaining);
</script>

<div class="wrap">
  <div class="stage">
    <div class="app">
      <div class="app-head">
        <span class="app-title">Tasks</span>
        <span class="app-count">{$tdRemaining} of {$tdCount} left</span>
      </div>

      <!-- Add -->
      <div class="addbar">
        <input
          list="td-suggestions"
          bind:value={entry}
          onkeydown={(e) => e.key === 'Enter' && add()}
          placeholder="Add a task and press Enter"
          autocomplete="off"
          spellcheck="false"
        />
        <datalist id="td-suggestions">
          {#each SUGGESTIONS as s}<option value={s}></option>{/each}
        </datalist>
        <button class="add-btn" onclick={add}>Add task</button>
      </div>
    </div>

    <p class="teach">
      Each task is a <strong>node</strong> pointing to <code>next</code>. A new
      task is linked at the <strong>tail</strong>, which means walking the whole
      chain from <code>head</code> — <strong>O(n)</strong>. Deleting one relinks
      its predecessor's <code>next</code> around it.
    </p>

    <!-- Linked list -->
    <div class="list">
      {#if $tdIsEmpty}
        <div class="list-empty"><code>head → ∅</code> — the list is empty.</div>
      {:else}
        <div class="ptr-head">head</div>
        <div class="nodes">
          {#each $todos as t, i (t.id)}
            <div class="node-wrap" animate:flip={{ duration: 220 }}>
              <div
                class="node"
                class:done={t.done}
                in:fly={{ y: -8, duration: 160 }}
                out:fly={{ x: -24, duration: 160 }}
              >
                <button
                  class="check"
                  class:on={t.done}
                  aria-label={t.done ? 'Mark not done' : 'Mark done'}
                  onclick={() => toggle(t.id)}
                >
                  {t.done ? '✓' : ''}
                </button>
                <span class="text">{t.text}</span>
                <span class="idx">#{i}</span>
                <button class="rm" aria-label="Delete" onclick={() => remove(t.id)}>✕</button>
              </div>
              <div class="link">
                <span class="link-line"></span>
                <span class="link-label">next ▼</span>
              </div>
            </div>
          {/each}
          <div class="tail">∅</div>
        </div>
      {/if}
    </div>

    <div class="footer">
      <button class="clear-btn" onclick={clearDone} disabled={doneCount === 0}>
        Clear completed{doneCount ? ` (${doneCount})` : ''}
      </button>
      <div class="legend">
        <span><span class="dot add"></span> Add: walk to tail, then <code>cur.next = n</code></span>
        <span><span class="dot del"></span> Delete: <code>prev.next = cur.next</code></span>
      </div>
    </div>
  </div>
</div>

<style>
  .wrap {
    width: 100%;
    height: 100%;
    background: var(--bg);
    overflow: auto;
    display: flex;
    justify-content: center;
  }
  .stage {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 32px 24px 48px;
    width: 100%;
    max-width: 520px;
  }

  /* --- App --- */
  .app {
    background: var(--surface);
    border: 1px solid var(--border-bright);
    border-radius: 14px;
    padding: 16px 18px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.24);
  }
  .app-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 12px;
  }
  .app-title {
    font-family: var(--font-ui);
    font-size: 16px;
    font-weight: 800;
    color: var(--text);
  }
  .app-count {
    font-family: var(--font-mono);
    font-size: 10.5px;
    color: var(--text-muted);
  }
  .addbar {
    display: flex;
    gap: 8px;
  }
  .addbar input {
    flex: 1;
    min-width: 0;
    background: var(--surface2);
    border: 1px solid var(--border-bright);
    border-radius: 8px;
    color: var(--text);
    font-family: var(--font-ui);
    font-size: 13px;
    padding: 8px 12px;
    outline: none;
  }
  .addbar input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-glow);
  }
  .add-btn {
    flex-shrink: 0;
    border: none;
    border-radius: 8px;
    padding: 8px 14px;
    background: var(--accent);
    color: #fff;
    font-family: var(--font-ui);
    font-size: 12.5px;
    font-weight: 700;
    cursor: pointer;
  }
  .add-btn:hover { background: #6f9fff; }

  .teach {
    font-family: var(--font-ui);
    font-size: 12.5px;
    color: var(--text-muted);
    text-align: center;
    margin: 0;
    line-height: 1.6;
  }
  .teach strong { color: var(--text-dim); }
  .teach code {
    font-family: var(--font-mono);
    font-size: 11.5px;
    color: var(--accent);
  }

  /* --- List --- */
  .list {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 14px 16px 18px;
  }
  .list-empty {
    text-align: center;
    font-family: var(--font-ui);
    font-size: 12.5px;
    color: var(--text-muted);
    padding: 12px 0;
  }
  .list-empty code { font-family: var(--font-mono); color: var(--text-dim); }
  .ptr-head {
    display: inline-block;
    font-family: var(--font-mono);
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    color: var(--accent);
    border: 1px solid var(--accent);
    border-radius: 4px;
    padding: 1px 5px;
    margin-bottom: 4px;
  }
  .nodes {
    display: flex;
    flex-direction: column;
  }
  .node-wrap {
    display: flex;
    flex-direction: column;
  }
  .node {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 10px;
    background: var(--surface2);
    border: 1px solid var(--border-bright);
    border-radius: 9px;
  }
  .node.done { opacity: 0.6; }
  .check {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    border-radius: 6px;
    border: 1.5px solid var(--border-bright);
    background: var(--bg);
    color: #fff;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }
  .check.on {
    background: #4ecca3;
    border-color: #4ecca3;
  }
  .text {
    flex: 1;
    min-width: 0;
    font-family: var(--font-ui);
    font-size: 13px;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .node.done .text {
    text-decoration: line-through;
    color: var(--text-muted);
  }
  .idx {
    font-family: var(--font-mono);
    font-size: 9.5px;
    color: var(--text-muted);
    flex-shrink: 0;
  }
  .rm {
    flex-shrink: 0;
    border: none;
    background: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 11px;
    padding: 2px 4px;
    border-radius: 4px;
    line-height: 1;
  }
  .rm:hover { background: var(--border); color: var(--text); }
  .link {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 22px;
    padding-left: 14px;
  }
  .link-line {
    width: 1.5px;
    height: 100%;
    background: var(--border-bright);
  }
  .link-label {
    font-family: var(--font-mono);
    font-size: 8.5px;
    font-weight: 700;
    letter-spacing: 0.3px;
    text-transform: uppercase;
    color: #5b8fff;
  }
  .tail {
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--text-muted);
    padding-left: 9px;
  }

  /* --- Footer --- */
  .footer {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .clear-btn {
    align-self: flex-start;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 7px 12px;
    background: var(--surface2);
    color: var(--text-dim);
    font-family: var(--font-ui);
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }
  .clear-btn:hover:not(:disabled) { background: var(--border); color: var(--text); }
  .clear-btn:disabled { opacity: 0.35; cursor: not-allowed; }
  .legend {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-family: var(--font-ui);
    font-size: 11px;
    color: var(--text-muted);
  }
  .legend code {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--accent);
    background: var(--surface2);
    border-radius: 4px;
    padding: 1px 4px;
  }
  .legend .dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-right: 6px;
    vertical-align: middle;
  }
  .legend .add { background: #5b8fff; }
  .legend .del { background: #e5773e; }
</style>
