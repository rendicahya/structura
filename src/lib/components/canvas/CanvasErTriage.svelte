<script>
  import { get } from 'svelte/store';
  import { flip } from 'svelte/animate';
  import { fly } from 'svelte/transition';
  import {
    erHeap,
    erNext,
    erIsEmpty,
    erWaiting,
    erSeenCount,
    erLastSeen,
    seeNext,
    ACUITY,
  } from '../../stores/heap/erTriage.js';

  // Zoom is bindable on every canvas; this demo renders a fixed triage board
  // and ignores it.
  let { zoom = $bindable(1) } = $props();

  const NAME_SUGGESTIONS = [
    'Ida Ayu', 'Omar Faruk', 'Siti Rahma', 'Budi Santoso', 'Nina Wijaya',
    'Rex Aldi', 'Maya Putri', 'Tono Hartono', 'Lena Sari', 'Gilang Pratama',
  ];
  const COMPLAINT_SUGGESTIONS = [
    'Chest pain', 'Shortness of breath', 'Severe bleeding', 'Deep laceration',
    'Broken wrist', 'High fever', 'Abdominal pain', 'Sprained ankle',
    'Migraine', 'Sore throat', 'Minor rash',
  ];

  let name = $state('');
  let lvl = $state(3);
  let complaint = $state('');

  function admit() {
    const nm = name.trim();
    if (!nm) return;
    window.dispatchEvent(
      new CustomEvent('ertriage:admit', {
        detail: { name: nm, level: lvl, complaint: complaint.trim() },
      }),
    );
    name = '';
    complaint = '';
    lvl = 3;
  }

  function seeOne() {
    window.dispatchEvent(new CustomEvent('ertriage:see'));
  }

  // --- auto-triage loop (drains the heap; not pushed to undo history) ---
  let auto = $state(false);

  function toggleAuto() {
    if ($erIsEmpty && !auto) return;
    auto = !auto;
  }

  $effect(() => {
    if (!auto) return;
    const id = setInterval(() => {
      if (get(erIsEmpty)) {
        auto = false;
        return;
      }
      seeNext();
    }, 1500);
    return () => clearInterval(id);
  });

  // --- heap geometry -------------------------------------------------
  const TREE_W = 540;
  const ROW_H = 78;
  const NODE_W = 116;

  const depthOf = (i) => Math.floor(Math.log2(i + 1));
  const rowStart = (d) => 2 ** d - 1;
  function nodeX(i) {
    const d = depthOf(i);
    const posInRow = i - rowStart(d);
    return ((posInRow + 0.5) / 2 ** d) * TREE_W;
  }
  const nodeTop = (i) => depthOf(i) * ROW_H + 10;
  const nodeCY = (i) => nodeTop(i) + 23;

  let maxDepth = $derived($erHeap.length ? depthOf($erHeap.length - 1) : 0);
  let treeH = $derived((maxDepth + 1) * ROW_H + 12);

  let edges = $derived(
    $erHeap.map((p, i) => i).filter((i) => i > 0).map((i) => {
      const parent = (i - 1) >> 1;
      return { i, x1: nodeX(parent), y1: nodeCY(parent), x2: nodeX(i), y2: nodeCY(i) };
    }),
  );

  // --- serve-order preview (the punchline: arrival order ≠ serve order) ---
  let serveOrder = $derived.by(() => {
    const h = $erHeap.map((p) => p);
    const cmp = (a, b) => a.level - b.level || a.seq - b.seq;
    const out = [];
    while (h.length) {
      out.push(h[0]);
      const last = h.pop();
      if (h.length) {
        h[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1;
          const r = 2 * i + 2;
          let b = i;
          if (l < h.length && cmp(h[l], h[b]) < 0) b = l;
          if (r < h.length && cmp(h[r], h[b]) < 0) b = r;
          if (b === i) break;
          [h[i], h[b]] = [h[b], h[i]];
          i = b;
        }
      }
    }
    return out;
  });

  const initials = (n) =>
    n.split(/\s+/).slice(0, 2).map((w) => w[0] ?? '').join('').toUpperCase();
</script>

<div class="wrap">
  <div class="stage">
    <!-- Now serving -->
    <div class="serving-card">
      <span class="serving-label">Now serving</span>
      {#if $erNext}
        {#key $erNext.id}
          <div class="serving-body" in:fly={{ y: 8, duration: 200 }}>
            <span
              class="lvl-badge big"
              style="background: {ACUITY[$erNext.level].color}"
            >
              {$erNext.level}
            </span>
            <div class="serving-meta">
              <span class="serving-name">{$erNext.name}</span>
              <span class="serving-sub">
                {ACUITY[$erNext.level].label} · {$erNext.complaint}
              </span>
            </div>
          </div>
        {/key}
      {:else}
        <div class="serving-body idle">
          {#if $erLastSeen}
            Waiting room clear — last seen “{$erLastSeen.name}”
          {:else}
            No patients waiting
          {/if}
        </div>
      {/if}

      <div class="controls">
        <button class="ctl ghost" onclick={seeOne} disabled={$erIsEmpty || auto}>
          ▶ See next patient
        </button>
        <button class="ctl solid" onclick={toggleAuto} disabled={$erIsEmpty && !auto}>
          {auto ? '⏸ Pause' : '▶ Auto-triage'}
        </button>
      </div>
      <div class="stat-row">
        <span><strong>{$erWaiting}</strong> waiting</span>
        <span><strong>{$erSeenCount}</strong> seen</span>
      </div>
    </div>

    <p class="teach">
      A plain queue sees patients in arrival order. A <strong>priority queue</strong>
      (binary min-heap) always serves the <strong>lowest acuity number</strong> —
      the most critical — first. It sits at the <strong>root</strong>; admitting
      sifts up, seeing a patient sifts the replacement down. Both O(log n).
    </p>

    <!-- Heap tree -->
    <div class="heap">
      <div class="heap-head"><span class="heap-name">The heap</span></div>
      {#if $erIsEmpty}
        <div class="heap-empty">Admit a patient below to build the heap.</div>
      {:else}
        <div class="tree-scroll">
          <div class="tree" style="width: {TREE_W}px; height: {treeH}px">
            <svg class="tree-edges" width={TREE_W} height={treeH}>
              {#each edges as e (e.i)}
                <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} />
              {/each}
            </svg>
            {#each $erHeap as p, i (p.id)}
              <div
                class="tnode"
                class:root={i === 0}
                style="left: {nodeX(i)}px; top: {nodeTop(i)}px; width: {NODE_W}px; border-color: {ACUITY[p.level].color}"
                animate:flip={{ duration: 260 }}
              >
                <span class="tnode-lvl" style="background: {ACUITY[p.level].color}">{p.level}</span>
                <span class="tnode-name" title={p.name}>{initials(p.name)}</span>
                <span class="tnode-idx">i={i}</span>
              </div>
            {/each}
          </div>
        </div>

        <div class="array-row">
          <span class="array-label">array</span>
          {#each $erHeap as p, i (p.id)}
            <span class="acell" class:root={i === 0} style="border-color: {ACUITY[p.level].color}">
              <span class="acell-lvl">L{p.level}</span>
              <span class="acell-idx">{i}</span>
            </span>
          {/each}
        </div>

        <div class="serve-row">
          <span class="serve-label">serve order</span>
          {#each serveOrder as p, i (p.id)}
            <span class="schip" style="border-color: {ACUITY[p.level].color}">
              {#if i > 0}<span class="sarrow">▸</span>{/if}{p.name}
            </span>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Admit form -->
    <div class="admitbar">
      <input
        class="name"
        list="er-names"
        bind:value={name}
        onkeydown={(e) => e.key === 'Enter' && admit()}
        placeholder="Patient name"
        autocomplete="off"
        spellcheck="false"
      />
      <datalist id="er-names">
        {#each NAME_SUGGESTIONS as s}<option value={s}></option>{/each}
      </datalist>
      <input
        class="complaint"
        list="er-complaints"
        bind:value={complaint}
        onkeydown={(e) => e.key === 'Enter' && admit()}
        placeholder="Complaint"
        autocomplete="off"
        spellcheck="false"
      />
      <datalist id="er-complaints">
        {#each COMPLAINT_SUGGESTIONS as s}<option value={s}></option>{/each}
      </datalist>
      <button class="admit-btn" onclick={admit}>Admit</button>
    </div>

    <div class="lvlpick">
      <span class="lvlpick-label">Acuity</span>
      {#each [1, 2, 3, 4, 5] as l}
        <button
          class="lvlopt"
          class:sel={lvl === l}
          style={lvl === l ? `background:${ACUITY[l].color};border-color:${ACUITY[l].color};color:#fff` : `border-color:${ACUITY[l].color};color:${ACUITY[l].color}`}
          onclick={() => (lvl = l)}
        >
          {l} · {ACUITY[l].label}
        </button>
      {/each}
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
    max-width: 600px;
  }

  /* --- Now serving --- */
  .serving-card {
    background: var(--surface);
    border: 1px solid var(--border-bright);
    border-radius: 14px;
    padding: 16px 18px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.24);
  }
  .serving-label {
    font-family: var(--font-ui);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.7px;
    text-transform: uppercase;
    color: var(--accent);
  }
  .serving-body {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-top: 10px;
    min-height: 46px;
  }
  .serving-body.idle {
    font-family: var(--font-ui);
    font-size: 13px;
    color: var(--text-muted);
  }
  .lvl-badge {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-family: var(--font-mono);
    font-weight: 800;
    border-radius: 8px;
  }
  .lvl-badge.big {
    width: 46px;
    height: 46px;
    font-size: 22px;
  }
  .serving-meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .serving-name {
    font-family: var(--font-ui);
    font-size: 16px;
    font-weight: 700;
    color: var(--text);
  }
  .serving-sub {
    font-family: var(--font-ui);
    font-size: 12px;
    color: var(--text-muted);
  }
  .controls {
    display: flex;
    gap: 10px;
    margin-top: 14px;
  }
  .ctl {
    flex: 1;
    border-radius: 8px;
    padding: 9px 12px;
    font-family: var(--font-ui);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    border: 1px solid var(--border);
    transition: all 0.13s ease;
  }
  .ctl:disabled { opacity: 0.35; cursor: not-allowed; }
  .ctl.ghost { background: var(--surface2); color: var(--text-dim); }
  .ctl.ghost:hover:not(:disabled) { background: var(--border); color: var(--text); }
  .ctl.solid { background: var(--accent); color: #fff; border-color: transparent; }
  .ctl.solid:hover:not(:disabled) { background: #6f9fff; }
  .stat-row {
    display: flex;
    gap: 16px;
    margin-top: 10px;
    font-family: var(--font-ui);
    font-size: 11.5px;
    color: var(--text-muted);
  }
  .stat-row strong { color: var(--text); font-family: var(--font-mono); }

  .teach {
    font-family: var(--font-ui);
    font-size: 12.5px;
    color: var(--text-muted);
    text-align: center;
    margin: 0;
    line-height: 1.6;
  }
  .teach strong { color: var(--text-dim); }

  /* --- Heap --- */
  .heap {
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
  }
  .heap-head {
    padding: 9px 12px;
    background: var(--surface2);
    border-bottom: 1px solid var(--border);
  }
  .heap-name {
    font-family: var(--font-ui);
    font-size: 12px;
    font-weight: 700;
    color: var(--text);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .heap-empty {
    padding: 28px 16px;
    text-align: center;
    font-family: var(--font-ui);
    font-size: 12.5px;
    color: var(--text-muted);
  }
  .tree-scroll {
    overflow-x: auto;
    padding: 8px 12px 4px;
  }
  .tree {
    position: relative;
    margin: 0 auto;
  }
  .tree-edges {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .tree-edges line {
    stroke: var(--border-bright);
    stroke-width: 1.5;
  }
  .tnode {
    position: absolute;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 6px;
    height: 46px;
    padding: 0 8px;
    background: var(--surface2);
    border: 1.5px solid var(--border-bright);
    border-radius: 9px;
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.2);
  }
  .tnode.root {
    box-shadow: 0 0 0 2px var(--accent), 0 3px 12px rgba(0, 0, 0, 0.3);
  }
  .tnode-lvl {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    border-radius: 5px;
    color: #fff;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .tnode-name {
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 700;
    color: var(--text);
  }
  .tnode-idx {
    font-family: var(--font-mono);
    font-size: 8.5px;
    color: var(--text-muted);
    margin-left: auto;
  }
  .array-row,
  .serve-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 5px;
    padding: 8px 12px;
    border-top: 1px dashed var(--border);
  }
  .array-label,
  .serve-label {
    font-family: var(--font-ui);
    font-size: 8.5px;
    font-weight: 700;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-right: 4px;
  }
  .acell {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 30px;
    padding: 2px 4px;
    background: var(--surface2);
    border: 1px solid var(--border-bright);
    border-radius: 5px;
    line-height: 1.2;
  }
  .acell.root { box-shadow: 0 0 0 1.5px var(--accent); }
  .acell-lvl {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    color: var(--text);
  }
  .acell-idx {
    font-family: var(--font-mono);
    font-size: 8px;
    color: var(--text-muted);
  }
  .schip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 7px;
    background: var(--surface2);
    border: 1px solid var(--border-bright);
    border-radius: 999px;
    font-family: var(--font-ui);
    font-size: 11px;
    color: var(--text);
  }
  .sarrow { color: var(--text-muted); }

  /* --- Admit form --- */
  .admitbar {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .admitbar input {
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
  .admitbar input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-glow);
  }
  .admitbar .name { flex: 1; }
  .admitbar .complaint { flex: 1.3; }
  .admit-btn {
    flex-shrink: 0;
    border: none;
    border-radius: 8px;
    padding: 8px 16px;
    background: var(--accent);
    color: #fff;
    font-family: var(--font-ui);
    font-size: 12.5px;
    font-weight: 700;
    cursor: pointer;
  }
  .admit-btn:hover { background: #6f9fff; }

  .lvlpick {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
  }
  .lvlpick-label {
    font-family: var(--font-ui);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-right: 2px;
  }
  .lvlopt {
    padding: 5px 9px;
    border-radius: 7px;
    border: 1px solid var(--border-bright);
    background: var(--surface2);
    font-family: var(--font-ui);
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.12s ease;
  }
</style>
