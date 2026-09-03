<script>
  import { flip } from 'svelte/animate';
  import { fly } from 'svelte/transition';
  import {
    pbBuckets,
    pbLookup,
    pbCount,
    pbIsEmpty,
    lookup,
    PB_BUCKETS,
    bucketOf,
  } from '../../stores/hash/phoneBook.js';

  // Zoom is bindable on every canvas; this demo renders a fixed contacts
  // mock-up and ignores it.
  let { zoom = $bindable(1) } = $props();

  const NAME_SUGGESTIONS = [
    'Ida', 'Omar', 'Sara', 'Budi', 'Nina', 'Rex', 'Maya', 'Tono', 'Lena', 'Gilang',
  ];

  let query = $state('');
  let cname = $state('');
  let cphone = $state('');

  function doLookup() {
    const q = query.trim();
    if (!q) return;
    lookup(q); // pure read — straight to the store, not undoable
  }

  function addContact() {
    const nm = cname.trim();
    if (!nm) return;
    window.dispatchEvent(
      new CustomEvent('phonebook:add', { detail: { name: nm, phone: cphone.trim() } }),
    );
    cname = '';
    cphone = '';
  }

  function removeRow(id) {
    window.dispatchEvent(new CustomEvent('phonebook:remove', { detail: id }));
  }

  // Live bucket preview for whatever is typed in the search box.
  let previewBucket = $derived(query.trim() ? bucketOf(query.trim()) : -1);
</script>

<div class="wrap">
  <div class="stage">
    <div class="phone">
      <div class="phone-head">
        <span class="phone-title">Contacts</span>
        <span class="phone-count">{$pbCount} saved · {PB_BUCKETS} buckets</span>
      </div>

      <!-- Search -->
      <div class="searchbar">
        <input
          list="pb-names"
          bind:value={query}
          onkeydown={(e) => e.key === 'Enter' && doLookup()}
          placeholder="Search a name"
          autocomplete="off"
          spellcheck="false"
        />
        <datalist id="pb-names">
          {#each NAME_SUGGESTIONS as s}<option value={s}></option>{/each}
        </datalist>
        <button class="look-btn" onclick={doLookup} disabled={!query.trim()}>Look up</button>
      </div>

      {#if query.trim()}
        <div class="hash-hint">
          hash(<code>{query.trim()}</code>) → bucket <strong>{previewBucket}</strong>
        </div>
      {/if}

      {#if $pbLookup}
        {#key $pbLookup.name + $pbLookup.steps}
          <div
            class="result"
            class:ok={$pbLookup.foundId}
            class:miss={!$pbLookup.foundId}
            in:fly={{ y: -6, duration: 160 }}
          >
            {#if $pbLookup.foundId}
              Found “{$pbLookup.name}” in bucket {$pbLookup.bucket} after
              {$pbLookup.steps} comparison{$pbLookup.steps === 1 ? '' : 's'}
            {:else}
              “{$pbLookup.name}” is not in the book — bucket {$pbLookup.bucket}
              scanned ({$pbLookup.steps} link{$pbLookup.steps === 1 ? '' : 's'})
            {/if}
          </div>
        {/key}
      {/if}
    </div>

    <p class="teach">
      Each name is hashed to a bucket in <strong>O(1)</strong>. Names that hash
      to the same bucket share it as a small linked-list <strong>chain</strong>
      (a collision). A lookup hashes once, then walks only that one chain —
      never all {$pbCount || 'N'} contacts.
    </p>

    <!-- Buckets -->
    <div class="buckets">
      {#each $pbBuckets as chain, b (b)}
        <div
          class="bucket"
          class:probe={$pbLookup?.bucket === b}
          class:live={previewBucket === b}
        >
          <span class="bidx">{b}</span>
          <div class="chain">
            {#if chain.length === 0}
              <span class="empty">— empty —</span>
            {:else}
              {#each chain as c, i (c.id)}
                <span class="chain-item" animate:flip={{ duration: 200 }}>
                  {#if i > 0}<span class="arrow">→</span>{/if}
                  <span class="chip" class:hit={$pbLookup?.foundId === c.id}>
                    <span class="chip-name">{c.name}</span>
                    <span class="chip-phone">{c.phone}</span>
                    <button class="chip-x" aria-label="Delete" onclick={() => removeRow(c.id)}>✕</button>
                  </span>
                </span>
              {/each}
              <span class="null">→ ∅</span>
            {/if}
          </div>
          {#if chain.length > 1}
            <span class="collide" title="{chain.length} entries collide here">collision ×{chain.length}</span>
          {/if}
        </div>
      {/each}
    </div>

    <!-- Add -->
    <div class="addbar">
      <input
        class="name"
        bind:value={cname}
        onkeydown={(e) => e.key === 'Enter' && addContact()}
        placeholder="Name"
        autocomplete="off"
        spellcheck="false"
      />
      <input
        class="phone-in"
        bind:value={cphone}
        onkeydown={(e) => e.key === 'Enter' && addContact()}
        placeholder="0812-3456-7890"
        autocomplete="off"
        spellcheck="false"
      />
      <button class="add-btn" onclick={addContact}>Add contact</button>
    </div>

    <div class="legend">
      <span><span class="dot in"></span> Add: <code>hash(name)</code> then append to that bucket's chain</span>
      <span><span class="dot look"></span> Look up: hash once, then walk one chain — O(1 + chain length)</span>
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
    max-width: 560px;
  }

  /* --- Phone --- */
  .phone {
    background: var(--surface);
    border: 1px solid var(--border-bright);
    border-radius: 14px;
    padding: 16px 18px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.24);
  }
  .phone-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 12px;
  }
  .phone-title {
    font-family: var(--font-ui);
    font-size: 16px;
    font-weight: 800;
    color: var(--text);
  }
  .phone-count {
    font-family: var(--font-mono);
    font-size: 10.5px;
    color: var(--text-muted);
  }
  .searchbar {
    display: flex;
    gap: 8px;
  }
  .searchbar input {
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
  .searchbar input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-glow);
  }
  .look-btn {
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
  .look-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .hash-hint {
    margin-top: 8px;
    font-family: var(--font-ui);
    font-size: 11.5px;
    color: var(--text-muted);
  }
  .hash-hint code {
    font-family: var(--font-mono);
    color: var(--accent);
  }
  .hash-hint strong { color: var(--text); font-family: var(--font-mono); }
  .result {
    margin-top: 10px;
    padding: 7px 10px;
    border-radius: 7px;
    font-family: var(--font-ui);
    font-size: 12px;
    font-weight: 600;
    border: 1px solid var(--border-bright);
  }
  .result.ok {
    color: #4ecca3;
    border-color: #4ecca3;
    background: color-mix(in srgb, #4ecca3 12%, transparent);
  }
  .result.miss {
    color: #e5773e;
    border-color: #e5773e;
    background: color-mix(in srgb, #e5773e 12%, transparent);
  }

  .teach {
    font-family: var(--font-ui);
    font-size: 12.5px;
    color: var(--text-muted);
    text-align: center;
    margin: 0;
    line-height: 1.6;
  }
  .teach strong { color: var(--text-dim); }

  /* --- Buckets --- */
  .buckets {
    display: flex;
    flex-direction: column;
    gap: 5px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px;
  }
  .bucket {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border: 1px solid transparent;
    border-radius: 8px;
    min-height: 38px;
    transition: background 0.15s, border-color 0.15s;
  }
  .bucket.live { background: var(--surface2); }
  .bucket.probe {
    background: color-mix(in srgb, var(--accent) 10%, transparent);
    border-color: var(--accent);
  }
  .bidx {
    flex-shrink: 0;
    width: 22px;
    height: 22px;
    border-radius: 6px;
    background: var(--surface2);
    border: 1px solid var(--border-bright);
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    color: var(--text-dim);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .chain {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
    flex: 1;
    min-width: 0;
  }
  .empty {
    font-family: var(--font-ui);
    font-size: 11px;
    color: var(--text-muted);
    opacity: 0.6;
  }
  .arrow,
  .null {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-muted);
  }
  .chain-item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 4px 3px 8px;
    background: var(--surface2);
    border: 1px solid var(--border-bright);
    border-radius: 7px;
  }
  .chip.hit {
    border-color: #4ecca3;
    box-shadow: 0 0 0 2px color-mix(in srgb, #4ecca3 40%, transparent);
  }
  .chip-name {
    font-family: var(--font-ui);
    font-size: 12px;
    font-weight: 700;
    color: var(--text);
  }
  .chip-phone {
    font-family: var(--font-mono);
    font-size: 10.5px;
    color: var(--text-muted);
  }
  .chip-x {
    border: none;
    background: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 10px;
    padding: 2px 3px;
    border-radius: 4px;
    line-height: 1;
  }
  .chip-x:hover { background: var(--border); color: var(--text); }
  .collide {
    flex-shrink: 0;
    font-family: var(--font-ui);
    font-size: 8.5px;
    font-weight: 800;
    letter-spacing: 0.3px;
    text-transform: uppercase;
    color: #e0a13a;
    border: 1px solid #e0a13a;
    border-radius: 4px;
    padding: 1px 4px;
  }

  /* --- Add bar --- */
  .addbar {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .addbar input {
    background: var(--surface2);
    border: 1px solid var(--border-bright);
    border-radius: 8px;
    color: var(--text);
    font-family: var(--font-ui);
    font-size: 13px;
    padding: 8px 12px;
    outline: none;
    min-width: 0;
  }
  .addbar input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-glow);
  }
  .addbar .name { flex: 1; }
  .addbar .phone-in { flex: 1.2; font-family: var(--font-mono); }
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
  .legend .in { background: #5b8fff; }
  .legend .look { background: #4ecca3; }
</style>
