<script>
  import { get } from 'svelte/store';
  import { untrack } from 'svelte';
  import { flip } from 'svelte/animate';
  import { fly, fade } from 'svelte/transition';
  import {
    tracks,
    currentId,
    currentTrack,
    pqIsEmpty,
    canNext,
    canPrev,
    nextTrack,
    prevTrack,
    jumpTo,
  } from '../../stores/list/playQueue.js';
  import { LIST_EDGE } from '../../utils/canvasConstants.js';

  // Zoom is bindable on every canvas; this demo renders a fixed player
  // mock-up and ignores it.
  let { zoom = $bindable(1) } = $props();

  const SUGGESTIONS = [
    'Levitating — Dua Lipa',
    'Blinding Lights — The Weeknd',
    'As It Was — Harry Styles',
    'good 4 u — Olivia Rodrigo',
    'Anti-Hero — Taylor Swift',
    'Kill Bill — SZA',
    'Flowers — Miley Cyrus',
    'Bad Habit — Steve Lacy',
    'Heat Waves — Glass Animals',
    'Sunflower — Post Malone',
    'Circles — Post Malone',
    'Peaches — Justin Bieber',
  ];

  let entry = $state('');

  function parseEntry(s) {
    const parts = String(s).split(/\s+[—–-]\s+/);
    return {
      title: (parts[0] ?? '').trim(),
      artist: parts.slice(1).join(' – ').trim(),
    };
  }

  function submitAdd(kind) {
    const { title, artist } = parseEntry(entry);
    if (!title) return;
    window.dispatchEvent(
      new CustomEvent(kind === 'next' ? 'playqueue:playnext' : 'playqueue:add', {
        detail: { title, artist },
      }),
    );
    entry = '';
  }

  function removeRow(id) {
    window.dispatchEvent(new CustomEvent('playqueue:remove', { detail: id }));
  }

  // --- fake playback -------------------------------------------------------
  const SONG_MS = 7000;
  let playing = $state(false);
  let progress = $state(0);

  function togglePlay() {
    if ($pqIsEmpty) return;
    playing = !playing;
  }

  $effect(() => {
    if (!playing) return;
    const tick = setInterval(() => {
      progress = Math.min(1, progress + 120 / SONG_MS);
      if (progress >= 1) {
        if (get(canNext)) {
          nextTrack();
          progress = 0;
        } else {
          playing = false;
        }
      }
    }, 120);
    return () => clearInterval(tick);
  });

  // A fresh track always starts from the beginning.
  $effect(() => {
    $currentId;
    untrack(() => {
      progress = 0;
    });
  });

  $effect(() => {
    if ($pqIsEmpty && playing) playing = false;
  });

  // --- cover art ---------------------------------------------------------
  function hashStr(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
  }
  function artGradient(t) {
    const h = hashStr(t.title + '|' + t.artist);
    const a = h % 360;
    const b = (a + 55 + (h % 110)) % 360;
    return `linear-gradient(135deg, hsl(${a} 62% 55%), hsl(${b} 58% 42%))`;
  }
</script>

<div class="wrap">
  <div class="stage">
    <!-- Player -->
    <div class="player">
      {#if $currentTrack}
        {#key $currentTrack.id}
          <div class="now" in:fade={{ duration: 160 }}>
            <div class="art" style="background: {artGradient($currentTrack)}">
              <span class="art-note">♪</span>
            </div>
            <div class="meta">
              <span class="np-label">Now playing</span>
              <span class="np-title">{$currentTrack.title}</span>
              <span class="np-artist">{$currentTrack.artist}</span>
            </div>
          </div>
        {/key}
      {:else}
        <div class="now now-empty">
          <div class="art art-empty"><span class="art-note">♪</span></div>
          <div class="meta">
            <span class="np-label">Now playing</span>
            <span class="np-title dim">Nothing playing</span>
            <span class="np-artist">Add a song to the queue below</span>
          </div>
        </div>
      {/if}

      <div class="bar">
        <div class="bar-fill" style="width: {$currentTrack ? progress * 100 : 0}%"></div>
      </div>

      <div class="controls">
        <button class="ctl" onclick={() => prevTrack()} disabled={!$canPrev} aria-label="Previous" title="current = current.prev">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M6 4h2v12H6zM16 4v12l-8-6z" /></svg>
        </button>
        <button class="ctl play" onclick={togglePlay} disabled={$pqIsEmpty} aria-label={playing ? 'Pause' : 'Play'}>
          {#if playing}
            <svg width="22" height="22" viewBox="0 0 22 22" fill="currentColor"><rect x="5" y="4" width="4" height="14" rx="1" /><rect x="13" y="4" width="4" height="14" rx="1" /></svg>
          {:else}
            <svg width="22" height="22" viewBox="0 0 22 22" fill="currentColor"><path d="M6 4.2v13.6c0 .9.9 1.4 1.6 1L18 12.9c.8-.4.8-1.5 0-2L7.6 3.3C6.9 2.8 6 3.3 6 4.2z" /></svg>
          {/if}
        </button>
        <button class="ctl" onclick={() => nextTrack()} disabled={!$canNext} aria-label="Next" title="current = current.next">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M12 4h2v12h-2zM4 4l8 6-8 6z" /></svg>
        </button>
      </div>
    </div>

    <p class="teach">
      The queue is a <strong>doubly linked list</strong>. <strong>⏭</strong> is
      <code>current = current.next</code>, <strong>⏮</strong> is
      <code>current = current.prev</code> — the list never shifts.
    </p>

    <!-- Add bar -->
    <div class="addbar">
      <input
        list="pq-suggestions"
        bind:value={entry}
        onkeydown={(e) => e.key === 'Enter' && submitAdd('queue')}
        placeholder="Add a song — e.g. Levitating — Dua Lipa"
        spellcheck="false"
        autocomplete="off"
      />
      <datalist id="pq-suggestions">
        {#each SUGGESTIONS as s}<option value={s}></option>{/each}
      </datalist>
      <button class="add-btn" onclick={() => submitAdd('queue')} title="Link a node at the tail">
        + Queue
      </button>
      <button class="add-btn ghost" onclick={() => submitAdd('next')} title="Splice a node right after current — O(1)">
        Play next
      </button>
    </div>

    <!-- Queue -->
    <div class="queue">
      <div class="q-head">
        <span class="q-name">Up next</span>
        <span class="q-count">{$tracks.length}</span>
      </div>

      {#if $pqIsEmpty}
        <div class="q-empty">Your queue is empty — add a song above.</div>
      {:else}
        <div class="q-list">
          {#each $tracks as t, i (t.id)}
            <div
              class="qitem"
              animate:flip={{ duration: 220 }}
              in:fly={{ y: -10, duration: 180 }}
              out:fly={{ x: -14, duration: 160 }}
            >
              {#if i > 0}
                <div class="link" aria-hidden="true">
                  <span style="color: {LIST_EDGE.PREV_COLOR}">▲ prev</span>
                  <span class="rail"></span>
                  <span style="color: {LIST_EDGE.NEXT_COLOR}">next ▼</span>
                </div>
              {/if}
              <div
                class="qrow"
                class:current={t.id === $currentId}
                role="button"
                tabindex="0"
                onclick={() => jumpTo(t.id)}
                onkeydown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    jumpTo(t.id);
                  }
                }}
              >
                <span class="idx">{i + 1}</span>
                <span class="qart" style="background: {artGradient(t)}"></span>
                <div class="qmeta">
                  <span class="qtitle">{t.title}</span>
                  <span class="qartist">{t.artist}</span>
                </div>
                <div class="pills">
                  {#if i === 0}<span class="pill">head</span>{/if}
                  {#if i === $tracks.length - 1}<span class="pill">tail</span>{/if}
                  {#if t.id === $currentId}<span class="pill now-pill">▶ current</span>{/if}
                </div>
                <button
                  class="rm"
                  aria-label="Remove from queue"
                  title="Unlink this node"
                  onclick={(e) => {
                    e.stopPropagation();
                    removeRow(t.id);
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /></svg>
                </button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <div class="legend">
      <span><span class="dot q"></span> + Queue: link a node at the <strong>tail</strong></span>
      <span><span class="dot n"></span> Play next: splice a node after <strong>current</strong> (O(1))</span>
      <span><span class="dot r"></span> ✕: unlink a node, neighbours relink</span>
      <span><span class="dot j"></span> Tap a row: walk <code>current</code> to it</span>
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
    align-items: stretch;
    gap: 16px;
    padding: 32px 24px 48px;
    width: 100%;
    max-width: 560px;
  }

  /* --- Player --- */
  .player {
    background: linear-gradient(160deg, #1f2530, #14181f);
    border: 1px solid var(--border-bright);
    border-radius: 14px;
    padding: 18px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.32);
  }
  .now {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .art {
    width: 76px;
    height: 76px;
    border-radius: 10px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
  }
  .art-empty {
    background: #2a303b;
  }
  .art-note {
    font-size: 30px;
    color: rgba(255, 255, 255, 0.85);
  }
  .meta {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }
  .np-label {
    font-family: var(--font-ui);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.7px;
    text-transform: uppercase;
    color: #1db954;
  }
  .np-title {
    font-family: var(--font-ui);
    font-size: 17px;
    font-weight: 800;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .np-title.dim {
    color: rgba(255, 255, 255, 0.5);
  }
  .np-artist {
    font-family: var(--font-ui);
    font-size: 12.5px;
    color: rgba(255, 255, 255, 0.62);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .bar {
    height: 4px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.14);
    margin: 16px 0 12px;
    overflow: hidden;
  }
  .bar-fill {
    height: 100%;
    background: #1db954;
    border-radius: 2px;
    transition: width 0.12s linear;
  }
  .controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 18px;
  }
  .ctl {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.82);
    cursor: pointer;
    transition: all 0.12s ease;
  }
  .ctl:hover:not(:disabled) {
    color: #fff;
    transform: scale(1.08);
  }
  .ctl:disabled {
    opacity: 0.28;
    cursor: not-allowed;
  }
  .ctl.play {
    width: 48px;
    height: 48px;
    background: #fff;
    color: #12151b;
  }
  .ctl.play:hover:not(:disabled) {
    background: #fff;
    transform: scale(1.06);
  }

  .teach {
    font-family: var(--font-ui);
    font-size: 12.5px;
    color: var(--text-muted);
    text-align: center;
    margin: 0;
    line-height: 1.6;
  }
  .teach strong {
    color: var(--text-dim);
  }
  .teach code,
  .legend code {
    font-family: var(--font-mono);
    font-size: 11.5px;
    color: var(--accent);
    background: var(--surface2);
    border-radius: 4px;
    padding: 1px 4px;
  }

  /* --- Add bar --- */
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
    border: 1px solid transparent;
    border-radius: 8px;
    padding: 8px 14px;
    background: #1db954;
    color: #0b0e12;
    font-family: var(--font-ui);
    font-size: 12.5px;
    font-weight: 700;
    cursor: pointer;
    transition: filter 0.12s ease;
  }
  .add-btn:hover {
    filter: brightness(1.08);
  }
  .add-btn.ghost {
    background: var(--surface2);
    color: var(--text-dim);
    border-color: var(--border);
  }
  .add-btn.ghost:hover {
    background: var(--border);
    color: var(--text);
    filter: none;
  }

  /* --- Queue --- */
  .queue {
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
  }
  .q-head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 12px;
    background: var(--surface2);
    border-bottom: 1px solid var(--border);
  }
  .q-name {
    font-family: var(--font-ui);
    font-size: 12px;
    font-weight: 700;
    color: var(--text);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .q-count {
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
  .q-empty {
    padding: 28px 16px;
    text-align: center;
    font-family: var(--font-ui);
    font-size: 12.5px;
    color: var(--text-muted);
  }
  .q-list {
    padding: 10px;
    display: flex;
    flex-direction: column;
  }
  .qitem {
    display: flex;
    flex-direction: column;
  }
  .link {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 3px 0;
    font-family: var(--font-mono);
    font-size: 8.5px;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    opacity: 0.75;
  }
  .link .rail {
    width: 26px;
    height: 1px;
    background: var(--border-bright);
  }
  .qrow {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 8px 9px;
    border: 1px solid var(--border-bright);
    border-radius: 8px;
    background: var(--surface2);
    cursor: pointer;
    transition: border-color 0.12s ease, background 0.12s ease;
  }
  .qrow:hover {
    border-color: var(--text-muted);
  }
  .qrow.current {
    border-color: #1db954;
  }
  .idx {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-muted);
    width: 16px;
    text-align: center;
    flex-shrink: 0;
  }
  .qart {
    width: 34px;
    height: 34px;
    border-radius: 6px;
    flex-shrink: 0;
  }
  .qmeta {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
    flex: 1;
  }
  .qtitle {
    font-family: var(--font-ui);
    font-size: 12.5px;
    font-weight: 600;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .qartist {
    font-family: var(--font-ui);
    font-size: 11px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pills {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }
  .pill {
    font-family: var(--font-ui);
    font-size: 8px;
    font-weight: 800;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    color: var(--text-muted);
    border: 1px solid var(--border-bright);
    border-radius: 4px;
    padding: 1px 4px;
  }
  .pill.now-pill {
    color: #1db954;
    border-color: #1db954;
  }
  .rm {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 6px;
    border: none;
    background: none;
    color: var(--text-muted);
    cursor: pointer;
    opacity: 0;
    transition: all 0.12s ease;
  }
  .qrow:hover .rm {
    opacity: 1;
  }
  .rm:hover {
    background: var(--danger, #e5484d);
    color: #fff;
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
  .legend .q { background: #1db954; }
  .legend .n { background: #5b8fff; }
  .legend .r { background: #e5484d; }
  .legend .j { background: #c792ea; }
</style>
