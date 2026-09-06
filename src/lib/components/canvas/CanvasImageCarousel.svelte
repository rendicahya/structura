<script>
  import { flip } from 'svelte/animate';
  import { fade } from 'svelte/transition';
  import {
    slides,
    icIsEmpty,
    icCount,
    currentSlideId,
    currentSlide,
    currentSlideIndex,
  } from '../../stores/list/imageCarousel.js';

  // Zoom is bindable on every canvas; this demo renders a fixed carousel
  // mock-up and ignores it.
  let { zoom = $bindable(1) } = $props();

  const SUGGESTIONS = ['Sunrise', 'Harbour', 'Old Town', 'Desert Road', 'Night Market', 'Rice Terrace', 'Snow Peak', 'Tide Pool'];

  let entry = $state('');

  function add() {
    const caption = entry.trim();
    if (!caption) return;
    window.dispatchEvent(new CustomEvent('carousel:add', { detail: { caption } }));
    entry = '';
  }

  const emit = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));

  function grad(hue) {
    return `linear-gradient(135deg, hsl(${hue} 68% 56%), hsl(${(hue + 42) % 360} 64% 44%))`;
  }

  let idx = $derived($currentSlideIndex);
  let prevCap = $derived($icCount ? $slides[(idx - 1 + $icCount) % $icCount]?.caption : null);
  let nextCap = $derived($icCount ? $slides[(idx + 1) % $icCount]?.caption : null);
</script>

<div class="wrap">
  <div class="stage">
    <div class="head">
      <span class="title">Image Carousel</span>
      <span class="meta">
        {#if $icIsEmpty}no slides{:else}slide {idx + 1} / {$icCount}{/if}
      </span>
    </div>

    <div class="addbar">
      <input
        list="ic-suggestions"
        bind:value={entry}
        onkeydown={(e) => e.key === 'Enter' && add()}
        placeholder="Add a slide caption and press Enter"
        autocomplete="off"
        spellcheck="false"
      />
      <datalist id="ic-suggestions">
        {#each SUGGESTIONS as s}<option value={s}></option>{/each}
      </datalist>
      <button class="add-btn" onclick={add}>Add slide</button>
    </div>

    <p class="teach">
      Each slide is a <strong>node</strong> with <code>next</code> and
      <code>prev</code>. The ring closes both ways —
      <code>tail.next = head</code> and <code>head.prev = tail</code> — so
      <strong>Next</strong> past the last slide and <strong>Prev</strong> before
      the first each wrap in a single hop.
    </p>

    <!-- Viewer -->
    <div class="viewer">
      {#if $icIsEmpty}
        <div class="viewer-empty">Add a slide to build the ring.</div>
      {:else if $currentSlide}
        <button class="nav prev" onclick={() => emit('carousel:prev')} aria-label="Previous slide">‹</button>
        {#key $currentSlide.id}
          <div class="frame" style="background:{grad($currentSlide.hue)}" in:fade={{ duration: 160 }}>
            <span class="frame-idx">#{idx}</span>
            <span class="frame-cap">{$currentSlide.caption}</span>
          </div>
        {/key}
        <button class="nav next" onclick={() => emit('carousel:next')} aria-label="Next slide">›</button>
      {/if}
    </div>

    {#if !$icIsEmpty}
      <div class="wrapline">
        <code>prev</code> → <span class="wrapcap">{prevCap}</span>
        <span class="wrapsep">·</span>
        <span class="wrapcap">{nextCap}</span> ← <code>next</code>
      </div>

      <!-- Filmstrip -->
      <div class="strip">
        {#each $slides as s, i (s.id)}
          <div class="thumb-wrap" animate:flip={{ duration: 200 }}>
            <button
              class="thumb"
              class:current={s.id === $currentSlideId}
              style="background:{grad(s.hue)}"
              onclick={() => emit('carousel:goto', s.id)}
              title={s.caption}
            >
              <span class="thumb-idx">{i}</span>
            </button>
            <button class="thumb-rm" aria-label="Remove {s.caption}" onclick={() => emit('carousel:remove', s.id)}>✕</button>
            <span class="thumb-cap" class:on={s.id === $currentSlideId}>{s.caption}</span>
          </div>
        {/each}
      </div>
    {/if}

    <div class="legend">
      <span><span class="dot next"></span> Next: <code>current = current.next</code> (wraps at the tail)</span>
      <span><span class="dot prev"></span> Prev: <code>current = current.prev</code> (wraps at the head)</span>
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
    gap: 14px;
    padding: 28px 24px 48px;
    width: 100%;
    max-width: 560px;
  }
  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }
  .title {
    font-family: var(--font-ui);
    font-size: 16px;
    font-weight: 800;
    color: var(--text);
  }
  .meta {
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

  .viewer {
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 200px;
  }
  .viewer-empty {
    flex: 1;
    text-align: center;
    padding: 72px 0;
    border: 1px dashed var(--border-bright);
    border-radius: 14px;
    font-family: var(--font-ui);
    font-size: 12.5px;
    color: var(--text-muted);
  }
  .frame {
    flex: 1;
    height: 200px;
    border-radius: 14px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    color: #fff;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.32);
  }
  .frame-idx {
    font-family: var(--font-mono);
    font-size: 11px;
    opacity: 0.85;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  }
  .frame-cap {
    font-family: var(--font-ui);
    font-size: 20px;
    font-weight: 800;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.45);
  }
  .nav {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 1px solid var(--border-bright);
    background: var(--surface2);
    color: var(--text);
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .nav:hover { background: var(--accent); border-color: var(--accent); color: #fff; }

  .wrapline {
    text-align: center;
    font-family: var(--font-ui);
    font-size: 11.5px;
    color: var(--text-muted);
  }
  .wrapline code {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--accent);
  }
  .wrapcap { color: var(--text-dim); font-weight: 600; }
  .wrapsep { margin: 0 8px; opacity: 0.5; }

  .strip {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    padding: 4px 2px 8px;
  }
  .thumb-wrap {
    position: relative;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    width: 64px;
  }
  .thumb {
    width: 64px;
    height: 44px;
    border-radius: 8px;
    border: 2px solid transparent;
    cursor: pointer;
    position: relative;
    padding: 0;
  }
  .thumb.current {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-glow);
  }
  .thumb-idx {
    position: absolute;
    left: 3px;
    bottom: 2px;
    font-family: var(--font-mono);
    font-size: 8.5px;
    color: #fff;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  }
  .thumb-rm {
    position: absolute;
    top: -6px;
    right: -6px;
    width: 15px;
    height: 15px;
    border-radius: 50%;
    border: 1px solid var(--border-bright);
    background: var(--surface);
    color: var(--text-muted);
    font-size: 7.5px;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .thumb-rm:hover { background: #e5773e; border-color: #e5773e; color: #fff; }
  .thumb-cap {
    font-family: var(--font-ui);
    font-size: 9px;
    color: var(--text-muted);
    max-width: 64px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .thumb-cap.on { color: var(--text); font-weight: 700; }

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
  .legend .next { background: #5b8fff; }
  .legend .prev { background: #e5773e; }
</style>
