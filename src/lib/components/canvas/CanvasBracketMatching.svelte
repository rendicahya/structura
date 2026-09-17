<script>
  import { onDestroy } from 'svelte';
  import { flip } from 'svelte/animate';
  import { fly } from 'svelte/transition';
  import {
    bracketState,
    runCheck,
    stepForward,
    playPause,
    stopRun,
    setBracketSpeed,
  } from '../../stores/stack/bracketMatching.js';

  let { zoom = $bindable(1) } = $props();

  let inputValue = $state('{ a[i] = (b + c) * [d - e] }');

  let active = $derived($bracketState.steps.length > 0);
  let running = $derived(active && !$bracketState.done);
  // Top of the stack first, so the row nearest the strip is what a closing
  // bracket would be checked against.
  let stackView = $derived([...$bracketState.stack].reverse());

  // Whitespace characters don't get a step (see computeSteps), so a
  // character's position in the input no longer lines up with its position
  // in `steps` — map each stepped character back to its step index instead.
  let stepIndexByChar = $derived.by(() => {
    const map = new Map();
    $bracketState.steps.forEach((step, i) => {
      if (step.index !== undefined) map.set(step.index, i);
    });
    return map;
  });

  function handleCheck() {
    runCheck(inputValue);
  }

  function handleSpeedChange(e) {
    setBracketSpeed(Number(e.currentTarget.value));
  }

  /** @param {number} idx */
  function charStatus(idx) {
    const { steps, stepIndex } = $bracketState;
    const sIdx = stepIndexByChar.get(idx);
    if (sIdx === undefined || sIdx > stepIndex) return 'pending';
    const step = steps[sIdx];
    if (!step) return 'pending';
    if (step.kind === 'push') return 'open';
    if (step.kind === 'pop') return 'close';
    if (step.kind === 'error') return 'error';
    return 'skip';
  }

  const isCurrent = (idx) => stepIndexByChar.get(idx) === $bracketState.stepIndex;

  // The auto-play interval lives in the store and would otherwise keep
  // ticking in the background after navigating away from this page.
  onDestroy(() => stopRun());
</script>

<div class="wrap">
  <div class="stage" style="transform: scale({zoom})">
    <div class="panel-window">
      <div class="chrome">
        <div class="dots"><span></span><span></span><span></span></div>
        <span class="filename">isBalanced.java</span>
      </div>

      <div class="runbar">
        <input
          type="text"
          bind:value={inputValue}
          onkeydown={(e) => e.key === 'Enter' && !running && handleCheck()}
          placeholder="Type an expression with brackets…"
          spellcheck="false"
          autocomplete="off"
          disabled={running}
        />
        <button class="go" onclick={handleCheck} disabled={running}>Check</button>
      </div>

      {#if $bracketState.input}
        <div class="strip">
          {#each $bracketState.input.split('') as ch, i}
            <span
              class="cchar status-{charStatus(i)}"
              class:current={isCurrent(i)}
            >{ch === ' ' ? ' ' : ch}</span>
          {/each}
        </div>
      {/if}

      {#if active}
        <div class="playback">
          <button
            class="pbtn"
            aria-label={$bracketState.playing ? 'Pause' : 'Play'}
            onclick={playPause}
            disabled={$bracketState.done}
          >
            {#if $bracketState.playing}
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
            disabled={$bracketState.playing || $bracketState.done}
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M3 2.7v8.6c0 .6.6.9 1.1.6l5.4-4.3c.4-.3.4-1 0-1.3L4.1 2c-.5-.3-1.1 0-1.1.7z" fill="currentColor" />
              <rect x="9.5" y="2" width="2" height="10" rx="1" fill="currentColor" />
            </svg>
          </button>
          <select class="speed" value={$bracketState.speed} onchange={handleSpeedChange}>
            <option value="1400">0.5x</option>
            <option value="700">1x</option>
            <option value="350">2x</option>
          </select>
        </div>
      {/if}
    </div>

    <p class="teach">
      Every open bracket is <strong>pushed</strong>; every close bracket must
      match the <strong>top</strong> of the stack, or the expression is unbalanced.
    </p>

    <div class="stack-col">
      <div class="col-head">
        <span class="col-name">Bracket stack</span>
        <span class="col-count">{stackView.length}</span>
      </div>
      <div class="col-body" class:is-empty={stackView.length === 0}>
        {#if stackView.length === 0}
          <div class="empty-slot">empty</div>
        {:else}
          {#each stackView as frame, i (frame.id)}
            <div
              class="fcard"
              class:top={i === 0}
              animate:flip={{ duration: 200 }}
              in:fly={{ y: -10, duration: 180 }}
              out:fly={{ y: -10, duration: 140 }}
            >
              {#if i === 0}<span class="top-pill">top</span>{/if}
              <span class="fcard-text">{frame.char}</span>
            </div>
          {/each}
        {/if}
      </div>
    </div>

    {#if $bracketState.done}
      {#if $bracketState.result === 'balanced'}
        <div class="result-banner ok" in:fly={{ y: -8, duration: 200 }}>
          ✓ Balanced
        </div>
      {:else}
        <div class="result-banner bad" in:fly={{ y: -8, duration: 200 }}>
          ✗ Unbalanced — {$bracketState.errorMsg}
        </div>
      {/if}
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
    transform-origin: top center;
    transition: transform 0.12s ease;
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

  .runbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
  }
  .runbar input {
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
  .runbar input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-glow);
  }
  .runbar input::placeholder {
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

  .strip {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
    padding: 0 12px 12px;
  }
  .cchar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 24px;
    padding: 0 3px;
    border-radius: 5px;
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--text-muted);
    background: var(--surface2);
    border: 1px solid var(--border);
    transition: all 0.15s ease;
  }
  .cchar.current {
    box-shadow: 0 0 0 2px var(--accent);
  }
  .cchar.status-open {
    color: #5b8fff;
    border-color: #5b8fff;
    background: rgba(91, 143, 255, 0.12);
  }
  .cchar.status-close {
    color: #4ecca3;
    border-color: #4ecca3;
    background: rgba(78, 204, 163, 0.12);
  }
  .cchar.status-error {
    color: #ff6b6b;
    border-color: #ff6b6b;
    background: rgba(255, 107, 107, 0.15);
  }
  .cchar.status-skip {
    color: var(--text-dim);
  }

  .playback {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 12px 12px;
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

  .stack-col {
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
    justify-content: center;
    background: var(--surface2);
    border: 1px solid var(--border-bright);
    border-radius: 7px;
    padding: 8px 10px;
    font-family: var(--font-mono);
    font-size: 13px;
    font-weight: 700;
    color: var(--text-dim);
  }
  .fcard.top {
    border-color: var(--accent);
    color: var(--text);
  }
  .top-pill {
    position: absolute;
    left: 8px;
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
  }

  .result-banner {
    font-family: var(--font-ui);
    font-size: 13px;
    font-weight: 700;
    border-radius: 10px;
    padding: 10px 18px;
    background: var(--surface);
    border: 1px solid var(--border-bright);
    text-align: center;
  }
  .result-banner.ok {
    color: var(--success);
    border-color: var(--success);
  }
  .result-banner.bad {
    color: #ff6b6b;
    border-color: #ff6b6b;
  }
</style>
