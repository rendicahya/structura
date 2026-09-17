<script>
  import { flip } from 'svelte/animate';
  import { fly } from 'svelte/transition';
  import {
    documentText,
    undoStack,
    redoStack,
    canUndoEdit,
    canRedoEdit,
  } from '../../stores/stack/undoRedoEditor.js';

  let { zoom = $bindable(1) } = $props();

  let typed = $state('');
  let editorEl = $state();

  function submitType() {
    if (!typed) return;
    window.dispatchEvent(new CustomEvent('editor:type', { detail: typed }));
    typed = '';
  }

  const doUndo = () => window.dispatchEvent(new CustomEvent('editor:undo'));
  const doRedo = () => window.dispatchEvent(new CustomEvent('editor:redo'));

  // Keep the editor scrolled to the bottom as the document grows.
  $effect(() => {
    void $documentText;
    if (editorEl) editorEl.scrollTop = editorEl.scrollHeight;
  });

  // Top of each stack first, so the row nearest the editor is the one an
  // Undo / Redo press would act on.
  let undoView = $derived([...$undoStack].reverse());
  let redoView = $derived([...$redoStack].reverse());

  function preview(text) {
    if (!text) return '(empty)';
    const oneLine = text.replace(/\s+/g, ' ').trim();
    return oneLine.length > 34 ? oneLine.slice(0, 34) + '…' : oneLine || '(empty)';
  }
</script>

<div class="wrap">
  <div class="stage" style="transform: scale({zoom})">
    <!-- Editor -->
    <div class="editor">
      <div class="chrome">
        <div class="dots"><span></span><span></span><span></span></div>
        <span class="filename">document.txt</span>
        <button class="nav-btn" onclick={doUndo} disabled={!$canUndoEdit} aria-label="Undo" title="Undo">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 6H10C12.2 6 14 7.5 14 9.5C14 11.5 12.2 13 10 13H6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
            <path d="M6.3 3.5L4 6L6.3 8.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <button class="nav-btn" onclick={doRedo} disabled={!$canRedoEdit} aria-label="Redo" title="Redo">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M12 6H6C3.8 6 2 7.5 2 9.5C2 11.5 3.8 13 6 13H10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
            <path d="M9.7 3.5L12 6L9.7 8.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>

      <div class="body" bind:this={editorEl}>
        {#if $documentText}
          <span class="doc-text">{$documentText}</span><span class="caret"></span>
        {:else}
          <span class="placeholder">Type below, then press Enter to commit the edit…</span><span class="caret"></span>
        {/if}
      </div>

      <div class="typebar">
        <input
          type="text"
          bind:value={typed}
          onkeydown={(e) => e.key === 'Enter' && submitType()}
          placeholder="Type text to append…"
          spellcheck="false"
          autocomplete="off"
        />
        <button class="go" onclick={submitType} disabled={!typed}>Type</button>
      </div>
    </div>

    <p class="teach">
      You drive the editor with <strong>Type</strong>, <strong>Undo</strong> and
      <strong>Redo</strong> only — the two stacks below move on their own.
    </p>

    <!-- The two stacks -->
    {#snippet stackColumn(label, tag, view, foot)}
      <div class="stack-col">
        <div class="col-head">
          <span class="col-name">{label}</span>
          <span class="col-tag">{tag}</span>
          <span class="col-count">{view.length}</span>
        </div>
        <div class="col-body" class:is-empty={view.length === 0}>
          {#if view.length === 0}
            <div class="empty-slot">empty</div>
          {:else}
            {#each view as snap, i (snap.id)}
              <div
                class="scard"
                class:top={i === 0}
                animate:flip={{ duration: 200 }}
                in:fly={{ y: -10, duration: 180 }}
                out:fly={{ y: -10, duration: 140 }}
              >
                {#if i === 0}<span class="top-pill">top</span>{/if}
                <span class="scard-text">{preview(snap.text)}</span>
              </div>
            {/each}
          {/if}
        </div>
        <div class="col-foot">{@render foot()}</div>
      </div>
    {/snippet}

    {#snippet undoFoot()}◀ <strong>Undo</strong> pops the top row into the document{/snippet}
    {#snippet redoFoot()}<strong>Redo</strong> pops the top row into the document ▶{/snippet}

    <div class="stacks">
      {@render stackColumn('Undo stack', 'stack 1', undoView, undoFoot)}
      {@render stackColumn('Redo stack', 'stack 2', redoView, redoFoot)}
    </div>

    <div class="legend">
      <span><span class="dot type"></span> Type: current text → Undo stack, Redo stack cleared</span>
      <span><span class="dot undo"></span> Undo: current text → Redo stack</span>
      <span><span class="dot redo"></span> Redo: current text → Undo stack</span>
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
    transform-origin: top center;
    transition: transform 0.12s ease;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 32px 24px 48px;
    width: 100%;
    max-width: 640px;
  }

  /* --- Editor shell --- */
  .editor {
    width: 100%;
    background: var(--surface);
    border: 1px solid var(--border-bright);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.28);
  }
  .chrome {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 12px;
    background: var(--toolbar-bg);
    border-bottom: 1px solid var(--border);
  }
  .dots {
    display: flex;
    gap: 5px;
    margin-right: 4px;
  }
  .dots span {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--border-bright);
  }
  .filename {
    flex: 1;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text-muted);
  }
  .nav-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 7px;
    border: 1px solid var(--border);
    background: var(--surface2);
    color: var(--text-dim);
    cursor: pointer;
    transition: all 0.12s ease;
    flex-shrink: 0;
  }
  .nav-btn:hover:not(:disabled) {
    background: var(--border);
    color: var(--text);
  }
  .nav-btn:disabled {
    opacity: 0.32;
    cursor: not-allowed;
  }

  .body {
    height: 220px;
    overflow-y: auto;
    background: #fff;
    padding: 16px 18px;
    font-family: var(--font-mono);
    font-size: 13px;
    line-height: 1.7;
    color: #1f2430;
    white-space: pre-wrap;
    word-break: break-word;
  }
  :global([data-theme='light']) .body {
    background: #fdfdfd;
  }
  .placeholder {
    color: #9aa0ab;
  }
  .caret {
    display: inline-block;
    width: 2px;
    height: 1em;
    vertical-align: text-bottom;
    background: #5b8fff;
    margin-left: 1px;
    animation: blink 1s step-start infinite;
  }
  @keyframes blink {
    50% {
      opacity: 0;
    }
  }

  .typebar {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 9px 12px;
    background: var(--bg);
    border-top: 1px solid var(--border);
  }
  .typebar input {
    flex: 1;
    min-width: 0;
    background: var(--surface2);
    border: 1px solid var(--border-bright);
    border-radius: 999px;
    padding: 7px 14px;
    color: var(--text);
    font-family: var(--font-mono);
    font-size: 12.5px;
    outline: none;
  }
  .typebar input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-glow);
  }
  .typebar input::placeholder {
    color: var(--text-muted);
  }
  .go {
    flex-shrink: 0;
    border: none;
    border-radius: 999px;
    padding: 6px 14px;
    background: var(--accent);
    color: #fff;
    font-family: var(--font-ui);
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }
  .go:hover:not(:disabled) {
    background: #6f9fff;
  }
  .go:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .teach {
    font-family: var(--font-ui);
    font-size: 12.5px;
    color: var(--text-muted);
    text-align: center;
    margin: 0;
    max-width: 460px;
    line-height: 1.5;
  }
  .teach strong {
    color: var(--text-dim);
  }

  /* --- Stacks --- */
  .stacks {
    display: flex;
    gap: 16px;
    width: 100%;
  }
  .stack-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
  }
  .col-head {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    background: var(--surface2);
    border-bottom: 1px solid var(--border);
  }
  .col-name {
    font-family: var(--font-ui);
    font-size: 12px;
    font-weight: 700;
    color: var(--text);
  }
  .col-tag {
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    color: var(--text-muted);
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 1px 5px;
    white-space: nowrap;
  }
  .col-count {
    margin-left: auto;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    color: var(--text-dim);
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 5px;
    min-width: 20px;
    text-align: center;
    padding: 1px 4px;
  }
  .col-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 8px;
    min-height: 132px;
  }
  .col-body.is-empty {
    align-items: center;
    justify-content: center;
  }
  .empty-slot {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-muted);
    border: 1px dashed var(--border-bright);
    border-radius: 6px;
    padding: 8px 16px;
    width: 100%;
    text-align: center;
  }
  .scard {
    position: relative;
    display: flex;
    align-items: center;
    background: var(--surface2);
    border: 1px solid var(--border-bright);
    border-radius: 7px;
    padding: 8px 10px;
    font-family: var(--font-mono);
    font-size: 11.5px;
    color: var(--text-dim);
  }
  .scard.top {
    border-color: var(--accent);
    color: var(--text);
  }
  .scard-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .top-pill {
    flex-shrink: 0;
    font-family: var(--font-ui);
    font-size: 8px;
    font-weight: 800;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: var(--accent);
    border: 1px solid var(--accent);
    border-radius: 4px;
    padding: 0 4px;
    margin-right: 7px;
  }
  .col-foot {
    padding: 7px 10px;
    border-top: 1px solid var(--border);
    font-family: var(--font-ui);
    font-size: 10.5px;
    color: var(--text-muted);
    text-align: center;
  }
  .col-foot strong {
    color: var(--text-dim);
  }

  .legend {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-family: var(--font-ui);
    font-size: 11px;
    color: var(--text-muted);
  }
  .legend .dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-right: 6px;
    vertical-align: middle;
  }
  .legend .type { background: #5b8fff; }
  .legend .undo { background: #c792ea; }
  .legend .redo { background: #4ecca3; }
</style>
