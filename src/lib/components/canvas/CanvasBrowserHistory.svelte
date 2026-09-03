<script>
  import { flip } from 'svelte/animate';
  import { fly, fade } from 'svelte/transition';
  import {
    currentPage,
    backStack,
    forwardStack,
    canGoBack,
    canGoForward,
    dummySite,
  } from '../../stores/stack/browserHistory.js';

  // Zoom is bindable on every canvas; this demo renders a fixed browser
  // mock-up and ignores it.
  let { zoom = $bindable(1) } = $props();

  let address = $state('');

  // Keep the address bar showing whatever page is on screen, but let the
  // user freely edit it.
  let lastPageId = $state(null);
  $effect(() => {
    const p = $currentPage;
    if (p && p.id !== lastPageId) {
      address = p.url;
      lastPageId = p.id;
    } else if (!p && lastPageId !== null) {
      address = '';
      lastPageId = null;
    }
  });

  let site = $derived($currentPage ? dummySite($currentPage.url) : null);

  function submitAddress() {
    if (!address.trim()) return;
    window.dispatchEvent(new CustomEvent('browser:visit', { detail: address }));
  }
  const goBack = () => window.dispatchEvent(new CustomEvent('browser:back'));
  const goForward = () => window.dispatchEvent(new CustomEvent('browser:forward'));

  // Top of each stack first, so the row nearest the browser is the one a
  // Back / Forward press would act on.
  let backView = $derived([...$backStack].reverse());
  let forwardView = $derived([...$forwardStack].reverse());

  function shortUrl(url) {
    return url.replace(/^https?:\/\//i, '').replace(/\/$/, '');
  }

  // Deterministic skeleton-bar widths for the fake page body.
  function barWidths(seed, n) {
    const out = [];
    let h = seed;
    for (let i = 0; i < n; i++) {
      h = (h * 1103515245 + 12345) & 0x7fffffff;
      out.push(55 + (h % 45));
    }
    return out;
  }
</script>

<div class="wrap">
  <div class="stage">
    <!-- Browser -->
    <div class="browser">
      <div class="chrome">
        <div class="dots"><span></span><span></span><span></span></div>
        <button class="nav-btn" onclick={goBack} disabled={!$canGoBack} aria-label="Back" title="Back">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <button class="nav-btn" onclick={goForward} disabled={!$canGoForward} aria-label="Forward" title="Forward">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <div class="omnibox">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" class="lock">
            <rect x="3" y="6" width="8" height="6" rx="1.3" stroke="currentColor" stroke-width="1.3" />
            <path d="M4.7 6V4.6a2.3 2.3 0 0 1 4.6 0V6" stroke="currentColor" stroke-width="1.3" />
          </svg>
          <input
            type="text"
            bind:value={address}
            onkeydown={(e) => e.key === 'Enter' && submitAddress()}
            placeholder="Search or type a URL, then press Enter"
            spellcheck="false"
            autocomplete="off"
          />
          <button class="go" onclick={submitAddress} aria-label="Go">Go</button>
        </div>
      </div>

      <div class="viewport">
        {#if $currentPage && site}
          {#key $currentPage.id}
            <div class="page" in:fade={{ duration: 160 }}>
              <div class="site-head" style="--siteHue: {site.hue}">
                <div class="site-brand">
                  <span class="site-mark" style="background: hsl({site.hue} 65% 55%)"></span>
                  {site.title}
                </div>
                <nav class="site-nav">
                  {#each site.navItems as item}<span>{item}</span>{/each}
                </nav>
              </div>
              <div class="site-body">
                <h1 style="color: hsl({site.hue} 45% 42%)">{site.tagline}</h1>
                <p class="site-url">{$currentPage.url}</p>
                {#each barWidths(site.hue + 1, site.paraCount) as _, pi}
                  <div class="para">
                    {#each barWidths(site.hue + pi * 7 + 3, 4) as w}
                      <span class="bar" style="width: {w}%"></span>
                    {/each}
                  </div>
                {/each}
                <div class="card-row">
                  <div class="mini-card" style="border-top-color: hsl({site.hue} 60% 55%)"></div>
                  <div class="mini-card" style="border-top-color: hsl({(site.hue + 40) % 360} 60% 55%)"></div>
                  <div class="mini-card" style="border-top-color: hsl({(site.hue + 80) % 360} 60% 55%)"></div>
                </div>
              </div>
            </div>
          {/key}
        {:else}
          <div class="blank" in:fade={{ duration: 160 }}>
            <div class="blank-glyph">🌐</div>
            <div class="blank-title">New Tab</div>
            <div class="blank-sub">Type a URL in the address bar and press Enter to load a page.</div>
          </div>
        {/if}
      </div>
    </div>

    <p class="teach">
      You drive the browser with <strong>Visit</strong>, <strong>Back</strong> and
      <strong>Forward</strong> only — the two stacks below move on their own.
    </p>

    <!-- The two stacks -->
    <div class="stacks">
      <div class="stack-col">
        <div class="col-head">
          <span class="col-name">Back stack</span>
          <span class="col-tag">stack&nbsp;1</span>
          <span class="col-count">{$backStack.length}</span>
        </div>
        <div class="col-body" class:is-empty={backView.length === 0}>
          {#if backView.length === 0}
            <div class="empty-slot">empty</div>
          {:else}
            {#each backView as page, i (page.id)}
              <div
                class="scard"
                class:top={i === 0}
                animate:flip={{ duration: 200 }}
                in:fly={{ y: -10, duration: 180 }}
                out:fly={{ y: -10, duration: 140 }}
              >
                {#if i === 0}<span class="top-pill">top</span>{/if}
                <span class="scard-url">{shortUrl(page.url)}</span>
              </div>
            {/each}
          {/if}
        </div>
        <div class="col-foot">◀ <strong>Back</strong> pops the top row onto the page</div>
      </div>

      <div class="stack-col">
        <div class="col-head">
          <span class="col-name">Forward stack</span>
          <span class="col-tag">stack&nbsp;2</span>
          <span class="col-count">{$forwardStack.length}</span>
        </div>
        <div class="col-body" class:is-empty={forwardView.length === 0}>
          {#if forwardView.length === 0}
            <div class="empty-slot">empty</div>
          {:else}
            {#each forwardView as page, i (page.id)}
              <div
                class="scard"
                class:top={i === 0}
                animate:flip={{ duration: 200 }}
                in:fly={{ y: -10, duration: 180 }}
                out:fly={{ y: -10, duration: 140 }}
              >
                {#if i === 0}<span class="top-pill">top</span>{/if}
                <span class="scard-url">{shortUrl(page.url)}</span>
              </div>
            {/each}
          {/if}
        </div>
        <div class="col-foot"><strong>Forward</strong> pops the top row onto the page ▶</div>
      </div>
    </div>

    <div class="legend">
      <span><span class="dot visit"></span> Visit: current page → Back stack, Forward stack cleared</span>
      <span><span class="dot back"></span> Back: current page → Forward stack</span>
      <span><span class="dot fwd"></span> Forward: current page → Back stack</span>
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
    align-items: center;
    gap: 16px;
    padding: 32px 24px 48px;
    width: 100%;
    max-width: 640px;
  }

  /* --- Browser shell --- */
  .browser {
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
  .omnibox {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 7px;
    background: var(--bg);
    border: 1px solid var(--border-bright);
    border-radius: 999px;
    padding: 5px 6px 5px 12px;
    min-width: 0;
  }
  .omnibox:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-glow);
  }
  .omnibox .lock {
    color: var(--success);
    flex-shrink: 0;
  }
  .omnibox input {
    flex: 1;
    min-width: 0;
    background: none;
    border: none;
    outline: none;
    color: var(--text);
    font-family: var(--font-mono);
    font-size: 12.5px;
  }
  .omnibox input::placeholder {
    color: var(--text-muted);
  }
  .go {
    flex-shrink: 0;
    border: none;
    border-radius: 999px;
    padding: 4px 12px;
    background: var(--accent);
    color: #fff;
    font-family: var(--font-ui);
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }
  .go:hover {
    background: #6f9fff;
  }

  .viewport {
    height: 300px;
    overflow: hidden;
    background: #fff;
    position: relative;
  }
  :global([data-theme='light']) .viewport {
    background: #fdfdfd;
  }
  .page {
    height: 100%;
    display: flex;
    flex-direction: column;
    color: #1f2430;
  }
  .site-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 18px;
    background: hsl(var(--siteHue) 55% 96%);
    border-bottom: 1px solid hsl(var(--siteHue) 40% 88%);
  }
  .site-brand {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font-ui);
    font-weight: 800;
    font-size: 15px;
    color: #222;
  }
  .site-mark {
    width: 18px;
    height: 18px;
    border-radius: 5px;
  }
  .site-nav {
    display: flex;
    gap: 14px;
  }
  .site-nav span {
    font-family: var(--font-ui);
    font-size: 12px;
    font-weight: 600;
    color: #555;
  }
  .site-body {
    padding: 20px 22px;
    flex: 1;
    overflow: hidden;
  }
  .site-body h1 {
    font-family: var(--font-ui);
    font-size: 19px;
    font-weight: 800;
    margin: 0 0 6px;
  }
  .site-url {
    font-family: var(--font-mono);
    font-size: 11px;
    color: #8a8f99;
    margin: 0 0 16px;
    word-break: break-all;
  }
  .para {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 10px;
  }
  .bar {
    height: 8px;
    border-radius: 4px;
    background: #e7e9ee;
  }
  .card-row {
    display: flex;
    gap: 10px;
    margin-top: 18px;
  }
  .mini-card {
    flex: 1;
    height: 54px;
    border-radius: 8px;
    background: #f1f2f5;
    border-top: 3px solid #ccc;
  }
  .blank {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: #6b7280;
    text-align: center;
    padding: 0 40px;
  }
  .blank-glyph {
    font-size: 40px;
  }
  .blank-title {
    font-family: var(--font-ui);
    font-size: 16px;
    font-weight: 700;
    color: #374151;
  }
  .blank-sub {
    font-family: var(--font-ui);
    font-size: 12.5px;
    line-height: 1.5;
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
    background: var(--accent-dim, var(--surface2));
    color: var(--text);
  }
  .scard-url {
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
  .legend .visit { background: #5b8fff; }
  .legend .back { background: #c792ea; }
  .legend .fwd { background: #4ecca3; }
</style>
