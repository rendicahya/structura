<script>
  import { get } from 'svelte/store';
  import { flip } from 'svelte/animate';
  import { fly } from 'svelte/transition';
  import {
    requests,
    frontRequest,
    queueIsEmpty,
    waitingCount,
    msPending,
    handledCount,
    lastHandled,
    handleFront,
  } from '../../stores/queue/requestQueue.js';

  let { zoom = $bindable(1) } = $props();

  const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
  const PATH_SUGGESTIONS = [
    '/api/users',
    '/api/users/42',
    '/api/orders',
    '/api/orders/7',
    '/api/products',
    '/login',
    '/logout',
    '/checkout',
    '/search?q=shoes',
    '/api/comments',
    '/upload',
    '/health',
  ];

  let method = $state('GET');
  let path = $state('');
  let reqMs = $state(180);

  function submit() {
    const p = path.trim();
    if (!p) return;
    window.dispatchEvent(
      new CustomEvent('requestqueue:submit', {
        detail: { method, path: p, ms: reqMs },
      }),
    );
    path = '';
    reqMs = 60 + Math.round(Math.random() * 600);
  }

  function processOne() {
    window.dispatchEvent(new CustomEvent('requestqueue:process'));
  }

  // --- auto-process loop -------------------------------------------------
  const clampDur = (ms) => Math.max(300, Math.min(3000, ms));

  let auto = $state(false);
  /** @type {{ id: string, progress: number } | null} */
  let processing = $state(null);

  function toggleAuto() {
    if ($queueIsEmpty && !auto) return;
    auto = !auto;
  }

  $effect(() => {
    if (!auto) return;
    let raf;
    let start = 0;
    let dur = 0;
    let reqId;

    const step = (ts) => {
      const front = get(frontRequest);
      if (!front) {
        auto = false;
        processing = null;
        return;
      }
      if (reqId !== front.id) {
        reqId = front.id;
        start = ts;
        dur = clampDur(front.ms);
      }
      const p = Math.min(1, (ts - start) / dur);
      processing = { id: front.id, progress: p };
      if (p >= 1) {
        handleFront(); // dequeue — auto path, not pushed to undo history
        processing = null;
        reqId = undefined;
      }
      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      processing = null;
    };
  });

  // --- helpers -------------------------------------------------------
  const METHOD_COLOR = {
    GET: '#5b8fff',
    POST: '#4ecca3',
    PUT: '#e0a13a',
    PATCH: '#c792ea',
    DELETE: '#ff6b6b',
  };
  function methodColor(m) {
    return METHOD_COLOR[m] ?? '#8a93a6';
  }

  let nowText = $derived(
    processing && $frontRequest
      ? `${$frontRequest.method} ${$frontRequest.path}  ·  ${$frontRequest.ms}ms  ·  ${Math.round(processing.progress * 100)}%`
      : $lastHandled
        ? `Idle · last handled "${$lastHandled.method} ${$lastHandled.path}"`
        : 'Server idle',
  );
</script>

<div class="wrap">
  <div class="stage" style="transform: scale({zoom})">
    <!-- Server -->
    <div class="server-card">
      <div class="device">
        <div class="server">
          <div class="server-top"></div>
          <div class="server-body">
            <div class="slot"></div>
            {#if processing}
              <div class="packet transmitting"></div>
            {/if}
            <div class="server-lights">
              <span class="led" class:on={processing}></span>
              <span class="led amber" class:on={!processing && !$queueIsEmpty}></span>
            </div>
          </div>
          <div class="tray">
            <span class="tray-count">{$handledCount}</span>
            <span class="tray-label">handled</span>
          </div>
        </div>

        <div class="readout">
          <span class="readout-label">Now handling</span>
          <span class="readout-name" class:idle={!processing}>{nowText}</span>
          <div class="platen-bar">
            <div class="platen-fill" style="width: {processing ? processing.progress * 100 : 0}%"></div>
          </div>
        </div>
      </div>

      <div class="controls">
        <button
          class="ctl ghost"
          onclick={processOne}
          disabled={$queueIsEmpty || auto}
          title="Dequeue the front request"
        >
          ▶ Process next
        </button>
        <button
          class="ctl solid"
          onclick={toggleAuto}
          disabled={$queueIsEmpty && !auto}
        >
          {auto ? '⏸ Pause' : '▶ Auto-process'}
        </button>
      </div>
    </div>

    <p class="teach">
      The incoming queue is a <strong>FIFO queue</strong>. The server always
      dequeues the request at the <strong>front</strong> — a request that
      arrives first is served first, no matter how heavy a later request is.
    </p>

    <!-- Submit bar -->
    <div class="submitbar">
      <select class="method" bind:value={method} aria-label="HTTP method" title="Method">
        {#each METHODS as m}<option value={m}>{m}</option>{/each}
      </select>
      <input
        class="path"
        list="rq-suggestions"
        bind:value={path}
        onkeydown={(e) => e.key === 'Enter' && submit()}
        placeholder="Path — e.g. /api/users"
        spellcheck="false"
        autocomplete="off"
      />
      <datalist id="rq-suggestions">
        {#each PATH_SUGGESTIONS as s}<option value={s}></option>{/each}
      </datalist>
      <input
        class="ms"
        type="number"
        min="20"
        max="3000"
        step="10"
        bind:value={reqMs}
        onkeydown={(e) => e.key === 'Enter' && submit()}
        aria-label="Processing time"
        title="Processing time (ms)"
      />
      <span class="ms-unit">ms</span>
      <button class="submit-btn" onclick={submit} title="Enqueue at the rear">
        Submit request
      </button>
    </div>

    <!-- Queue -->
    <div class="queue">
      <div class="q-head">
        <span class="q-name">Request queue</span>
        <span class="q-stat">{$waitingCount} waiting</span>
        <span class="q-stat">{$msPending} ms</span>
      </div>

      {#if $queueIsEmpty}
        <div class="q-empty">No requests queued — submit one above.</div>
      {:else}
        <div class="q-hint">↑ front — the server pulls from here</div>
        <div class="q-list">
          {#each $requests as req, i (req.id)}
            <div
              class="jcard"
              class:front={i === 0}
              class:processing={processing?.id === req.id}
              animate:flip={{ duration: 220 }}
              in:fly={{ y: -10, duration: 180 }}
              out:fly={{ x: -28, duration: 200 }}
            >
              <span class="pos">{i + 1}</span>
              <span class="method-pill" style="background: {methodColor(req.method)}">{req.method}</span>
              <div class="jmeta">
                <span class="jname">{req.path}</span>
                <span class="jsub">{req.ms} ms</span>
              </div>
              <div class="jbadges">
                {#if i === 0}<span class="badge front-badge">front</span>{/if}
                {#if i === $requests.length - 1}<span class="badge">rear</span>{/if}
              </div>
              {#if processing?.id === req.id}
                <div class="jprogress"><div style="width: {processing.progress * 100}%"></div></div>
              {/if}
            </div>
          {/each}
        </div>
        <div class="q-hint bottom">↓ rear — new requests land here</div>
      {/if}
    </div>

    <div class="legend">
      <span><span class="dot in"></span> Submit request: <code>queue.add(req)</code> — enqueue at the rear</span>
      <span><span class="dot out"></span> Process next: <code>queue.remove()</code> — dequeue the front</span>
      <span><span class="dot auto"></span> Auto-process: dequeue repeatedly until the queue drains</span>
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
    gap: 16px;
    padding: 32px 24px 48px;
    width: 100%;
    max-width: 560px;
  }

  /* --- Server --- */
  .server-card {
    background: var(--surface);
    border: 1px solid var(--border-bright);
    border-radius: 14px;
    padding: 18px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.24);
  }
  .device {
    display: flex;
    gap: 18px;
    align-items: center;
  }
  .server {
    width: 116px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .server-top {
    width: 78px;
    height: 12px;
    background: var(--surface2);
    border: 1px solid var(--border-bright);
    border-bottom: none;
    border-radius: 6px 6px 0 0;
  }
  .server-body {
    position: relative;
    width: 116px;
    height: 62px;
    background: linear-gradient(180deg, var(--surface2), var(--surface));
    border: 1px solid var(--border-bright);
    border-radius: 8px;
    overflow: hidden;
  }
  .slot {
    position: absolute;
    top: 14px;
    left: 14px;
    right: 14px;
    height: 5px;
    background: var(--bg);
    border-radius: 3px;
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.4);
  }
  .packet {
    position: absolute;
    top: 18px;
    left: 24px;
    width: 68px;
    height: 40px;
    border-radius: 4px;
    background: linear-gradient(135deg, #5b8fff, #4ecca3);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
  }
  .packet.transmitting {
    animation: feed 1.1s ease-in-out infinite;
  }
  @keyframes feed {
    0% { transform: translateY(-30px); opacity: 0.4; }
    60% { transform: translateY(8px); opacity: 1; }
    100% { transform: translateY(24px); opacity: 0; }
  }
  .server-lights {
    position: absolute;
    bottom: 7px;
    right: 9px;
    display: flex;
    gap: 5px;
  }
  .led {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--border-bright);
    transition: background 0.2s;
  }
  .led.on { background: #4ecca3; box-shadow: 0 0 6px #4ecca3; }
  .led.amber.on { background: #e0a13a; box-shadow: 0 0 6px #e0a13a; }
  .tray {
    margin-top: 6px;
    width: 92px;
    padding: 5px 0 7px;
    background: var(--surface2);
    border: 1px solid var(--border-bright);
    border-top: none;
    border-radius: 0 0 8px 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    line-height: 1.1;
  }
  .tray-count {
    font-family: var(--font-mono);
    font-size: 15px;
    font-weight: 700;
    color: var(--text);
  }
  .tray-label {
    font-family: var(--font-ui);
    font-size: 8.5px;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  .readout {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .readout-label {
    font-family: var(--font-ui);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.7px;
    text-transform: uppercase;
    color: var(--accent);
  }
  .readout-name {
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .readout-name.idle {
    color: var(--text-muted);
  }
  .platen-bar {
    height: 5px;
    border-radius: 3px;
    background: var(--surface2);
    border: 1px solid var(--border);
    overflow: hidden;
  }
  .platen-fill {
    height: 100%;
    background: var(--accent);
    transition: width 0.1s linear;
  }
  .controls {
    display: flex;
    gap: 10px;
    margin-top: 16px;
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
  .ctl:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  .ctl.ghost {
    background: var(--surface2);
    color: var(--text-dim);
  }
  .ctl.ghost:hover:not(:disabled) {
    background: var(--border);
    color: var(--text);
  }
  .ctl.solid {
    background: var(--accent);
    color: #fff;
    border-color: transparent;
  }
  .ctl.solid:hover:not(:disabled) {
    background: #6f9fff;
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
  .legend code {
    font-family: var(--font-mono);
    font-size: 11.5px;
    color: var(--accent);
    background: var(--surface2);
    border-radius: 4px;
    padding: 1px 4px;
  }

  /* --- Submit bar --- */
  .submitbar {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .submitbar select,
  .submitbar input {
    background: var(--surface2);
    border: 1px solid var(--border-bright);
    border-radius: 8px;
    color: var(--text);
    font-family: var(--font-ui);
    font-size: 13px;
    padding: 8px 12px;
    outline: none;
  }
  .submitbar select:focus,
  .submitbar input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-glow);
  }
  .submitbar .method {
    flex-shrink: 0;
    font-family: var(--font-mono);
    font-weight: 700;
    cursor: pointer;
  }
  .submitbar .path {
    flex: 1;
    min-width: 0;
    font-family: var(--font-mono);
  }
  .submitbar .ms {
    width: 66px;
    font-family: var(--font-mono);
    text-align: center;
  }
  .ms-unit {
    font-family: var(--font-ui);
    font-size: 11px;
    color: var(--text-muted);
    margin-left: -2px;
  }
  .submit-btn {
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
  .submit-btn:hover { background: #6f9fff; }

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
  .q-stat {
    font-family: var(--font-mono);
    font-size: 10.5px;
    font-weight: 700;
    color: var(--text-dim);
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 5px;
    padding: 1px 6px;
  }
  .q-stat:first-of-type { margin-left: auto; }
  .q-empty {
    padding: 28px 16px;
    text-align: center;
    font-family: var(--font-ui);
    font-size: 12.5px;
    color: var(--text-muted);
  }
  .q-hint {
    padding: 6px 12px 2px;
    font-family: var(--font-ui);
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  .q-hint.bottom {
    padding: 2px 12px 8px;
  }
  .q-list {
    padding: 4px 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .jcard {
    position: relative;
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 8px 10px;
    border: 1px solid var(--border-bright);
    border-radius: 8px;
    background: var(--surface2);
    overflow: hidden;
  }
  .jcard.front {
    border-color: var(--accent);
  }
  .jcard.processing {
    border-color: #4ecca3;
  }
  .pos {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-muted);
    width: 16px;
    text-align: center;
    flex-shrink: 0;
  }
  .method-pill {
    flex-shrink: 0;
    min-width: 50px;
    height: 22px;
    padding: 0 5px;
    border-radius: 5px;
    color: #fff;
    font-family: var(--font-mono);
    font-size: 9.5px;
    font-weight: 700;
    text-transform: uppercase;
    display: flex;
    align-items: center;
    justify-content: center;
    letter-spacing: 0.3px;
  }
  .jmeta {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
    flex: 1;
  }
  .jname {
    font-family: var(--font-mono);
    font-size: 12.5px;
    font-weight: 600;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .jsub {
    font-family: var(--font-ui);
    font-size: 11px;
    color: var(--text-muted);
  }
  .jbadges {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }
  .badge {
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
  .badge.front-badge {
    color: var(--accent);
    border-color: var(--accent);
  }
  .jprogress {
    position: absolute;
    left: 0;
    bottom: 0;
    width: 100%;
    height: 3px;
    background: transparent;
  }
  .jprogress > div {
    height: 100%;
    background: #4ecca3;
    transition: width 0.1s linear;
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
  .legend .in { background: #5b8fff; }
  .legend .out { background: #4ecca3; }
  .legend .auto { background: #c792ea; }
</style>
