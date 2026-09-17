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
</script>

<div class="wrap">
  <div class="stage" style="transform: scale({zoom})">
    <!-- Server status dashboard -->
    <div class="dash">
      <div class="dash-top">
        <div class="pulse-ring" class:active={!!processing}>
          <span class="pulse-core"></span>
        </div>
        <div class="dash-info">
          <span class="dash-label">Server</span>
          <span class="dash-status" class:busy={!!processing}>
            {processing ? 'handling request' : 'idle — waiting for work'}
          </span>
        </div>
        <div class="dash-count">
          <span class="dash-count-num">{$handledCount}</span>
          <span class="dash-count-label">handled</span>
        </div>
      </div>

      {#if processing && $frontRequest}
        <div class="active-req">
          <span class="method-pill" style="background: {methodColor($frontRequest.method)}"
            >{$frontRequest.method}</span
          >
          <span class="active-path">{$frontRequest.path}</span>
          <span class="active-ms">{Math.round(processing.progress * $frontRequest.ms)} / {$frontRequest.ms} ms</span>
        </div>
      {:else}
        <div class="active-req idle">
          {$lastHandled ? `last handled "${$lastHandled.method} ${$lastHandled.path}"` : 'no requests handled yet'}
        </div>
      {/if}
      <div class="progress-track">
        <div class="progress-fill" style="width: {processing ? processing.progress * 100 : 0}%"></div>
      </div>

      <div class="controls">
        <button class="ctl ghost" onclick={processOne} disabled={$queueIsEmpty || auto} title="Dequeue the front request">
          Process next
        </button>
        <button class="ctl solid" onclick={toggleAuto} disabled={$queueIsEmpty && !auto}>
          {auto ? 'Pause' : 'Auto-process'}
        </button>
      </div>
    </div>

    <p class="teach">
      The incoming queue is a <strong>FIFO queue</strong>. The server always
      handles the request at the <strong>front</strong> — a request that
      arrives first is served first, no matter how heavy a later request is.
    </p>

    <!-- Submit bar -->
    <div class="cmdbar">
      <span class="cmd-prompt">»</span>
      <select class="cmd-method" bind:value={method} aria-label="HTTP method" title="Method">
        {#each METHODS as m}<option value={m}>{m}</option>{/each}
      </select>
      <input
        class="cmd-path"
        list="rq-suggestions"
        bind:value={path}
        onkeydown={(e) => e.key === 'Enter' && submit()}
        placeholder="/path — e.g. /api/users"
        spellcheck="false"
        autocomplete="off"
      />
      <datalist id="rq-suggestions">
        {#each PATH_SUGGESTIONS as s}<option value={s}></option>{/each}
      </datalist>
      <input
        class="cmd-ms"
        type="number"
        min="20"
        max="3000"
        step="10"
        bind:value={reqMs}
        onkeydown={(e) => e.key === 'Enter' && submit()}
        aria-label="Processing time"
        title="Processing time (ms)"
      />
      <span class="cmd-unit">ms</span>
      <button class="cmd-submit" onclick={submit} title="Enqueue at the rear">Send</button>
    </div>

    <!-- Horizontal request pipeline -->
    <div class="pipeline">
      <div class="pl-head">
        <span class="pl-name">Request pipeline</span>
        <span class="pl-stat">{$waitingCount} waiting</span>
        <span class="pl-stat">{$msPending} ms total</span>
      </div>

      {#if $queueIsEmpty}
        <div class="pl-empty">No requests queued — send one above.</div>
      {:else}
        <div class="lane">
          <div class="lane-end lane-end-front">
            <span>server</span>
            <span class="lane-arrow">←</span>
          </div>
          <div class="lane-track">
            {#each $requests as req, i (req.id)}
              <div
                class="ticket"
                class:front={i === 0}
                class:processing={processing?.id === req.id}
                animate:flip={{ duration: 220 }}
                in:fly={{ x: 30, duration: 180 }}
                out:fly={{ x: -30, duration: 200 }}
              >
                <span class="ticket-method" style="background: {methodColor(req.method)}">{req.method}</span>
                <span class="ticket-path">{req.path}</span>
                <span class="ticket-ms">{req.ms} ms</span>
                {#if i === 0}<span class="ticket-tag front-tag">front</span>{/if}
                {#if i === $requests.length - 1 && $requests.length > 1}<span class="ticket-tag">rear</span>{/if}
                {#if processing?.id === req.id}
                  <div class="ticket-progress" style="width: {processing.progress * 100}%"></div>
                {/if}
              </div>
            {/each}
          </div>
          <div class="lane-end lane-end-rear">
            <span class="lane-arrow">←</span>
            <span>new</span>
          </div>
        </div>
      {/if}
    </div>

    <div class="legend">
      <span><span class="dot in"></span> Send request: <code>incoming.add(req)</code> — enqueue at the rear</span>
      <span><span class="dot out"></span> Process next: <code>incoming.remove()</code> — dequeue the front</span>
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
    max-width: 600px;
  }

  /* --- Server dashboard --- */
  .dash {
    background: var(--surface);
    border: 1px solid var(--border-bright);
    border-radius: 14px;
    padding: 18px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.24);
  }
  .dash-top {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .pulse-ring {
    position: relative;
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 2px solid var(--border-bright);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .pulse-core {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--text-muted);
    transition: background 0.2s;
  }
  .pulse-ring.active {
    border-color: #4ecca3;
  }
  .pulse-ring.active .pulse-core {
    background: #4ecca3;
    box-shadow: 0 0 8px #4ecca3;
  }
  .pulse-ring.active::before {
    content: '';
    position: absolute;
    inset: -2px;
    border-radius: 50%;
    border: 2px solid #4ecca3;
    animation: ringpulse 1.1s ease-out infinite;
  }
  @keyframes ringpulse {
    0% { transform: scale(1); opacity: 0.7; }
    100% { transform: scale(1.7); opacity: 0; }
  }
  .dash-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .dash-label {
    font-family: var(--font-ui);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.7px;
    text-transform: uppercase;
    color: var(--accent);
  }
  .dash-status {
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--text-muted);
  }
  .dash-status.busy {
    color: var(--text);
  }
  .dash-count {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    line-height: 1.1;
  }
  .dash-count-num {
    font-family: var(--font-mono);
    font-size: 18px;
    font-weight: 700;
    color: var(--text);
  }
  .dash-count-label {
    font-family: var(--font-ui);
    font-size: 8.5px;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .active-req {
    margin-top: 14px;
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 9px 11px;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 9px;
  }
  .active-req.idle {
    color: var(--text-muted);
    font-family: var(--font-ui);
    font-size: 12px;
  }
  .active-path {
    flex: 1;
    min-width: 0;
    font-family: var(--font-mono);
    font-size: 12.5px;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .active-ms {
    flex-shrink: 0;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-muted);
  }
  .progress-track {
    margin-top: 8px;
    height: 5px;
    border-radius: 3px;
    background: var(--surface2);
    border: 1px solid var(--border);
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    background: #4ecca3;
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

  /* --- Command bar --- */
  .cmdbar {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--surface);
    border: 1px solid var(--border-bright);
    border-radius: 10px;
    padding: 8px 10px;
  }
  .cmd-prompt {
    flex-shrink: 0;
    font-family: var(--font-mono);
    font-weight: 700;
    color: var(--accent);
    padding-left: 2px;
  }
  .cmdbar select,
  .cmdbar input {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 7px;
    color: var(--text);
    font-family: var(--font-mono);
    font-size: 12.5px;
    padding: 7px 10px;
    outline: none;
  }
  .cmdbar select:focus,
  .cmdbar input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-glow);
  }
  .cmd-method {
    flex-shrink: 0;
    font-weight: 700;
    cursor: pointer;
  }
  .cmd-path {
    flex: 1;
    min-width: 0;
  }
  .cmd-ms {
    width: 60px;
    text-align: center;
  }
  .cmd-unit {
    font-family: var(--font-ui);
    font-size: 11px;
    color: var(--text-muted);
    margin-left: -2px;
  }
  .cmd-submit {
    flex-shrink: 0;
    border: none;
    border-radius: 7px;
    padding: 8px 16px;
    background: var(--accent);
    color: #fff;
    font-family: var(--font-ui);
    font-size: 12.5px;
    font-weight: 700;
    cursor: pointer;
  }
  .cmd-submit:hover { background: #6f9fff; }

  /* --- Pipeline --- */
  .pipeline {
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
  }
  .pl-head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 12px;
    background: var(--surface2);
    border-bottom: 1px solid var(--border);
  }
  .pl-name {
    font-family: var(--font-ui);
    font-size: 12px;
    font-weight: 700;
    color: var(--text);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .pl-stat {
    font-family: var(--font-mono);
    font-size: 10.5px;
    font-weight: 700;
    color: var(--text-dim);
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 5px;
    padding: 1px 6px;
  }
  .pl-stat:first-of-type { margin-left: auto; }
  .pl-empty {
    padding: 28px 16px;
    text-align: center;
    font-family: var(--font-ui);
    font-size: 12.5px;
    color: var(--text-muted);
  }

  .lane {
    display: flex;
    align-items: stretch;
    padding: 6px 4px;
  }
  .lane-end {
    flex-shrink: 0;
    width: 48px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    font-family: var(--font-ui);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.3px;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  .lane-end-front { color: var(--accent); }
  .lane-arrow {
    font-size: 13px;
    line-height: 1;
  }
  .lane-track {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    overflow-x: auto;
    padding: 10px 6px;
    position: relative;
  }
  .lane-track::before {
    content: '';
    position: absolute;
    left: 6px;
    right: 6px;
    top: 50%;
    height: 2px;
    background: repeating-linear-gradient(
      to right,
      var(--border) 0,
      var(--border) 6px,
      transparent 6px,
      transparent 12px
    );
    z-index: 0;
  }

  .ticket {
    position: relative;
    z-index: 1;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    min-width: 96px;
    padding: 10px 12px 12px;
    border: 1px solid var(--border-bright);
    border-radius: 10px;
    background: var(--surface2);
    overflow: hidden;
  }
  .ticket.front {
    border-color: var(--accent);
  }
  .ticket.processing {
    border-color: #4ecca3;
  }
  .ticket-method {
    min-width: 50px;
    height: 20px;
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
  .ticket-path {
    max-width: 108px;
    font-family: var(--font-mono);
    font-size: 11.5px;
    font-weight: 600;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ticket-ms {
    font-family: var(--font-ui);
    font-size: 10px;
    color: var(--text-muted);
  }
  .ticket-tag {
    position: absolute;
    top: 4px;
    right: 5px;
    font-family: var(--font-ui);
    font-size: 7px;
    font-weight: 800;
    letter-spacing: 0.3px;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  .ticket-tag.front-tag {
    color: var(--accent);
  }
  .ticket-progress {
    position: absolute;
    left: 0;
    bottom: 0;
    height: 3px;
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
