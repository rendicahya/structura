<script>
  import { flip } from 'svelte/animate';
  import { fade } from 'svelte/transition';
  import {
    players,
    trIsEmpty,
    trCount,
    currentTurnId,
    currentPlayer,
    roundNumber,
    turnsTaken,
  } from '../../stores/list/turnRotation.js';

  // Zoom is bindable on every canvas; this demo renders a fixed circular
  // mock-up and ignores it.
  let { zoom = $bindable(1) } = $props();

  const SUGGESTIONS = ['Alice', 'Bob', 'Chandra', 'Dewi', 'Eka', 'Farid', 'Gita', 'Hadi'];

  let entry = $state('');

  function add() {
    const name = entry.trim();
    if (!name) return;
    window.dispatchEvent(new CustomEvent('turnrotation:add', { detail: { name } }));
    entry = '';
  }

  function remove(id) {
    window.dispatchEvent(new CustomEvent('turnrotation:remove', { detail: id }));
  }

  function nextTurn() {
    window.dispatchEvent(new CustomEvent('turnrotation:next'));
  }

  // --- Ring geometry: seat every player on a circle, head at the top. ---
  const BOX = 360;
  const C = BOX / 2;
  const R = 128;

  let seats = $derived(
    $players.map((p, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / Math.max($players.length, 1);
      return {
        ...p,
        i,
        x: C + R * Math.cos(angle),
        y: C + R * Math.sin(angle),
      };
    }),
  );

  // One arrow per ring hop, including the closing tail → head edge. Each is
  // trimmed back from both seat centres so the arrowhead sits outside the chip.
  let hops = $derived.by(() => {
    const n = seats.length;
    if (n < 2) return [];
    const PAD = 34;
    return seats.map((a, k) => {
      const b = seats[(k + 1) % n];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      return {
        key: a.id,
        x1: a.x + ux * PAD,
        y1: a.y + uy * PAD,
        x2: b.x - ux * PAD,
        y2: b.y - uy * PAD,
        closing: k === n - 1,
      };
    });
  });
</script>

<div class="wrap">
  <div class="stage">
    <div class="head">
      <span class="title">Turn Order</span>
      <span class="meta">
        {#if $trIsEmpty}no players{:else}Round {$roundNumber} · {$trCount} player{$trCount === 1 ? '' : 's'} · {$turnsTaken} turn{$turnsTaken === 1 ? '' : 's'}{/if}
      </span>
    </div>

    <div class="addbar">
      <input
        list="tr-suggestions"
        bind:value={entry}
        onkeydown={(e) => e.key === 'Enter' && add()}
        placeholder="Seat a player and press Enter"
        autocomplete="off"
        spellcheck="false"
      />
      <datalist id="tr-suggestions">
        {#each SUGGESTIONS as s}<option value={s}></option>{/each}
      </datalist>
      <button class="add-btn" onclick={add}>Seat player</button>
    </div>

    <p class="teach">
      Every player is a <strong>node</strong> pointing to <code>next</code>. The
      last player's <code>next</code> loops back to <code>head</code>, so after
      the final player it is player&nbsp;1's turn again — no index, no bounds
      check, just <code>current = current.next</code>.
    </p>

    <div class="ring" style="width:{BOX}px;height:{BOX}px">
      {#if $trIsEmpty}
        <div class="ring-empty">Seat a player to start the ring.</div>
      {:else}
        <svg class="links" viewBox="0 0 {BOX} {BOX}" aria-hidden="true">
          <defs>
            <marker id="tr-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="var(--text-muted)" />
            </marker>
            <marker id="tr-arrow-hot" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="var(--accent)" />
            </marker>
          </defs>
          {#if seats.length === 1}
            <!-- 1-node ring: a self-loop above the lone player -->
            <path
              d="M {C - 16} {C - 26} A 26 26 0 1 1 {C + 16} {C - 26}"
              fill="none"
              stroke="var(--accent)"
              stroke-width="2"
              marker-end="url(#tr-arrow-hot)"
            />
          {/if}
          {#each hops as h (h.key)}
            <line
              x1={h.x1}
              y1={h.y1}
              x2={h.x2}
              y2={h.y2}
              stroke={h.closing ? 'var(--accent)' : 'var(--text-muted)'}
              stroke-width={h.closing ? 2 : 1.5}
              stroke-dasharray={h.closing ? '5 4' : 'none'}
              marker-end={h.closing ? 'url(#tr-arrow-hot)' : 'url(#tr-arrow)'}
            />
          {/each}
        </svg>

        <div class="hub">
          {#if $currentPlayer}
            <span class="hub-label">now playing</span>
            <span class="hub-name" in:fade={{ duration: 140 }}>{$currentPlayer.name}</span>
          {/if}
          <button class="hub-btn" onclick={nextTurn}>Next turn ▶</button>
        </div>

        {#each seats as s (s.id)}
          <div
            class="seat"
            class:current={s.id === $currentTurnId}
            class:head={s.i === 0}
            style="left:{s.x}px;top:{s.y}px"
            animate:flip={{ duration: 220 }}
          >
            {#if s.i === 0}<span class="tag head-tag">head</span>{/if}
            {#if s.id === $currentTurnId}<span class="tag turn-tag">turn</span>{/if}
            <span class="seat-name">{s.name}</span>
            <span class="seat-idx">#{s.i}</span>
            <button class="seat-rm" aria-label="Remove {s.name}" onclick={() => remove(s.id)}>✕</button>
          </div>
        {/each}
      {/if}
    </div>

    <div class="legend">
      <span><span class="swatch solid"></span> <code>next</code> hop</span>
      <span><span class="swatch dashed"></span> <code>tail.next = head</code> — the link that closes the ring</span>
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
    padding: 28px 24px 48px;
    width: 100%;
    max-width: 560px;
  }
  .head {
    width: 100%;
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
    width: 100%;
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

  .ring {
    position: relative;
    flex-shrink: 0;
    margin: 4px 0;
  }
  .ring-empty {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    font-family: var(--font-ui);
    font-size: 12.5px;
    color: var(--text-muted);
    border: 1px dashed var(--border-bright);
    border-radius: 50%;
  }
  .links {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    overflow: visible;
  }
  .hub {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    text-align: center;
    pointer-events: auto;
  }
  .hub-label {
    font-family: var(--font-mono);
    font-size: 8.5px;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  .hub-name {
    font-family: var(--font-ui);
    font-size: 15px;
    font-weight: 800;
    color: var(--text);
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .hub-btn {
    margin-top: 2px;
    border: 1px solid var(--accent);
    background: var(--accent-glow);
    color: var(--accent);
    font-family: var(--font-ui);
    font-size: 11.5px;
    font-weight: 700;
    border-radius: 999px;
    padding: 5px 12px;
    cursor: pointer;
  }
  .hub-btn:hover { background: var(--accent); color: #fff; }

  .seat {
    position: absolute;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    width: 72px;
    padding: 8px 6px;
    background: var(--surface2);
    border: 1px solid var(--border-bright);
    border-radius: 10px;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.22);
  }
  .seat.current {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-glow), 0 6px 20px rgba(0, 0, 0, 0.28);
  }
  .seat-name {
    font-family: var(--font-ui);
    font-size: 12px;
    font-weight: 700;
    color: var(--text);
    max-width: 64px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .seat-idx {
    font-family: var(--font-mono);
    font-size: 9px;
    color: var(--text-muted);
  }
  .seat-rm {
    position: absolute;
    top: -7px;
    right: -7px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 1px solid var(--border-bright);
    background: var(--surface);
    color: var(--text-muted);
    font-size: 8px;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .seat-rm:hover { background: #e5773e; border-color: #e5773e; color: #fff; }
  .tag {
    position: absolute;
    font-family: var(--font-mono);
    font-size: 7.5px;
    font-weight: 700;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    border-radius: 3px;
    padding: 1px 4px;
    line-height: 1.3;
  }
  .head-tag {
    top: -9px;
    left: -6px;
    color: var(--text-dim);
    background: var(--surface);
    border: 1px solid var(--border-bright);
  }
  .turn-tag {
    bottom: -9px;
    color: #fff;
    background: var(--accent);
  }

  .legend {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-family: var(--font-ui);
    font-size: 11px;
    color: var(--text-muted);
    align-self: flex-start;
  }
  .legend code {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--accent);
    background: var(--surface2);
    border-radius: 4px;
    padding: 1px 4px;
  }
  .swatch {
    display: inline-block;
    width: 18px;
    height: 0;
    border-top-width: 2px;
    vertical-align: middle;
    margin-right: 4px;
  }
  .swatch.solid { border-top-style: solid; border-top-color: var(--text-muted); }
  .swatch.dashed { border-top-style: dashed; border-top-color: var(--accent); }
</style>
