<script>
  import { onDestroy } from 'svelte';
  import { flip } from 'svelte/animate';
  import { fly, fade } from 'svelte/transition';
  import {
    callStackState,
    runFactorial,
    stepForward,
    playPause,
    stopRun,
    setCallStackSpeed,
  } from '../../stores/stack/functionCallStack.js';

  // Zoom is bindable on every canvas; this demo renders a fixed mock-up and
  // ignores it.
  let { zoom = $bindable(1) } = $props();

  let nInput = $state('5');

  let active = $derived($callStackState.steps.length > 0);
  let running = $derived(active && !$callStackState.done);
  // Top of the stack first, so the row nearest the code panel is the frame
  // currently executing.
  let framesView = $derived([...$callStackState.frames].reverse());

  function handleRun() {
    runFactorial(nInput);
  }

  function handleSpeedChange(e) {
    setCallStackSpeed(Number(e.currentTarget.value));
  }

  // The auto-play interval lives in the store and would otherwise keep
  // ticking in the background after navigating away from this page.
  onDestroy(() => stopRun());

  const CODE_LINES = [
    'int factorial(int n) {',
    '    if (n <= 1) return 1;',
    '    int sub = factorial(n - 1);',
    '    return n * sub;',
    '}',
  ];
</script>

<div class="wrap">
  <div class="stage">
    <div class="panel-window">
      <div class="chrome">
        <div class="dots"><span></span><span></span><span></span></div>
        <span class="filename">factorial.java</span>
      </div>

      <div class="code">
        {#each CODE_LINES as line, i}
          <div
            class="code-line"
            class:highlight={
              $callStackState.frames.length > 0 &&
              ((i === 1 && $callStackState.frames.at(-1)?.n <= 1) ||
                (i === 2 && $callStackState.frames.at(-1)?.n > 1))
            }
          >{line}</div>
        {/each}
      </div>

      <div class="runbar">
        <label for="fc-n">n =</label>
        <input
          id="fc-n"
          type="number"
          min="0"
          max="10"
          bind:value={nInput}
          onkeydown={(e) => e.key === 'Enter' && !running && handleRun()}
          disabled={running}
        />
        <button class="go" onclick={handleRun} disabled={running}>Run factorial(n)</button>

        {#if active}
          <div class="playback">
            <button
              class="pbtn"
              aria-label={$callStackState.playing ? 'Pause' : 'Play'}
              onclick={playPause}
              disabled={$callStackState.done}
            >
              {#if $callStackState.playing}
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                  <rect x="3" y="2" width="3" height="10" rx="1" fill="currentColor" />
                  <rect x="8" y="2" width="3" height="10" rx="1" fill="currentColor" />
                </svg>
              {:else}
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                  <path d="M3.5 2.3v9.4c0 .6.6.9 1.1.6l7.6-4.7c.5-.3.5-1 0-1.3L4.6 1.6c-.5-.3-1.1 0-1.1.7z" fill="currentColor" />
                </svg>
              {/if}
            </button>
            <button
              class="pbtn"
              aria-label="Step forward"
              onclick={stepForward}
              disabled={$callStackState.playing || $callStackState.done}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <path d="M3 2.7v8.6c0 .6.6.9 1.1.6l5.4-4.3c.4-.3.4-1 0-1.3L4.1 2c-.5-.3-1.1 0-1.1.7z" fill="currentColor" />
                <rect x="9.5" y="2" width="2" height="10" rx="1" fill="currentColor" />
              </svg>
            </button>
            <select class="speed" value={$callStackState.speed} onchange={handleSpeedChange}>
              <option value="1400">0.5x</option>
              <option value="700">1x</option>
              <option value="350">2x</option>
            </select>
          </div>
        {/if}
      </div>
    </div>

    <p class="teach">
      Each call to <strong>factorial</strong> pushes a frame; each return pops one.
      The stack never has more than <strong>n + 1</strong> frames on it at once.
    </p>

    <div class="callstack-col">
      <div class="col-head">
        <span class="col-name">Call stack</span>
        <span class="col-count">{framesView.length}</span>
      </div>
      <div class="col-body" class:is-empty={framesView.length === 0}>
        {#if framesView.length === 0}
          <div class="empty-slot">empty</div>
        {:else}
          {#each framesView as frame, i (frame.id)}
            <div
              class="fcard"
              class:top={i === 0}
              animate:flip={{ duration: 200 }}
              in:fly={{ y: -10, duration: 180 }}
              out:fly={{ y: -10, duration: 140 }}
            >
              {#if i === 0}<span class="top-pill">top</span>{/if}
              <span class="fcard-text">factorial({frame.n})</span>
            </div>
          {/each}
        {/if}
      </div>
    </div>

    {#if $callStackState.lastReturn}
      {#key $callStackState.stepIndex}
        <div class="return-bubble" in:fly={{ y: -8, duration: 180 }} out:fade={{ duration: 120 }}>
          ↩ factorial({$callStackState.lastReturn.n}) returns <strong>{$callStackState.lastReturn.value}</strong>
        </div>
      {/key}
    {/if}

    {#if $callStackState.done}
      <div class="result-banner" in:fly={{ y: -8, duration: 200 }}>
        Result: factorial({$callStackState.n}) = <strong>{$callStackState.result}</strong>
      </div>
    {/if}
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
    align-items: center;
    gap: 16px;
    padding: 32px 24px 48px;
    width: 100%;
    max-width: 560px;
  }

  .panel-window {
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
  }
  .dots span {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--border-bright);
  }
  .filename {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text-muted);
  }

  .code {
    background: #1e2128;
    padding: 14px 16px;
    font-family: var(--font-mono);
    font-size: 12.5px;
    line-height: 1.7;
  }
  .code-line {
    color: #c3c9d4;
    white-space: pre;
    border-radius: 4px;
    padding: 0 6px;
    margin: 0 -6px;
    transition: background 0.15s ease;
  }
  .code-line.highlight {
    background: rgba(91, 143, 255, 0.22);
    color: #e8ecf5;
  }

  .runbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: var(--bg);
    border-top: 1px solid var(--border);
  }
  .runbar label {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text-dim);
  }
  .runbar input {
    width: 56px;
    background: var(--surface2);
    border: 1px solid var(--border-bright);
    border-radius: 7px;
    padding: 6px 8px;
    color: var(--text);
    font-family: var(--font-mono);
    font-size: 12.5px;
    outline: none;
  }
  .runbar input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-glow);
  }
  .go {
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
  .playback {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
  }
  .pbtn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 7px;
    border: 1px solid var(--border);
    background: var(--surface2);
    color: var(--text-dim);
    cursor: pointer;
    transition: all 0.12s ease;
  }
  .pbtn:hover:not(:disabled) {
    background: var(--border);
    color: var(--text);
  }
  .pbtn:disabled {
    opacity: 0.32;
    cursor: not-allowed;
  }
  .speed {
    font-family: var(--font-ui);
    font-size: 11px;
    font-weight: 600;
    color: var(--text-dim);
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 5px 4px;
    cursor: pointer;
    width: 54px;
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

  .callstack-col {
    width: 100%;
    max-width: 260px;
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
  .fcard {
    position: relative;
    display: flex;
    align-items: center;
    background: var(--surface2);
    border: 1px solid var(--border-bright);
    border-radius: 7px;
    padding: 8px 10px;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text-dim);
  }
  .fcard.top {
    border-color: var(--accent);
    color: var(--text);
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

  .return-bubble {
    font-family: var(--font-mono);
    font-size: 12.5px;
    color: var(--text-dim);
    background: var(--surface2);
    border: 1px solid var(--border-bright);
    border-radius: 999px;
    padding: 6px 14px;
  }
  .return-bubble strong {
    color: var(--success);
  }

  .result-banner {
    font-family: var(--font-ui);
    font-size: 13px;
    font-weight: 600;
    color: var(--text-dim);
    background: var(--surface);
    border: 1px solid var(--success);
    border-radius: 10px;
    padding: 10px 18px;
  }
  .result-banner strong {
    color: var(--success);
  }
</style>
