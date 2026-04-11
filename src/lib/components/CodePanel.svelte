<script>
  import { nodes, edges } from '../stores/graph.js';

  function generateCode(ns, es) {
    if (ns.length === 0) return '// Add nodes to generate code';

    let lines = [];
    lines.push('// ─── Node class ───────────────────────────');
    lines.push('class Node {');
    lines.push('    int data;');
    lines.push('    Node next;');
    lines.push('');
    lines.push('    Node(int data) {');
    lines.push('        this.data = data;');
    lines.push('        this.next = null;');
    lines.push('    }');
    lines.push('}');
    lines.push('');
    lines.push('// ─── Nodes ─────────────────────────────────');

    for (const n of ns) {
      const dataVal = n.data !== '' ? n.data : '0';
      lines.push(`Node ${n.varName} = new Node(${dataVal});`);
    }

    const linked = es.length > 0;
    if (linked) {
      lines.push('');
      lines.push('// ─── Links ─────────────────────────────────');
      for (const e of es) {
        const fromNode = ns.find(n => n.id === e.from);
        const toNode = ns.find(n => n.id === e.to);
        if (fromNode && toNode) {
          lines.push(`${fromNode.varName}.next = ${toNode.varName};`);
        }
      }
    }

    // Detect head (not pointed to by anyone)
    const targets = new Set(es.map(e => e.to));
    const heads = ns.filter(n => !targets.has(n.id));
    if (heads.length > 0 && linked) {
      lines.push('');
      lines.push('// ─── Head pointer ──────────────────────────');
      lines.push(`Node head = ${heads[0].varName};`);
    }

    return lines.join('\n');
  }

  $: code = generateCode($nodes, $edges);

  // Syntax highlight
  function highlight(code) {
    return code
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/(\/\/[^\n]*)/g, '<span class="c">$1</span>')
      .replace(/\b(class|new|int|void|null|this|Node)\b/g, '<span class="kw">$1</span>')
      .replace(/\b(\d+)\b/g, '<span class="num">$1</span>')
      .replace(/"([^"]*)"/g, '<span class="str">"$1"</span>')
      .replace(/\b([a-z][a-zA-Z0-9]*)\s*(?==)/g, '<span class="var">$1</span>')
  }

  $: highlighted = highlight(code);
</script>

<div class="code-panel">
  <div class="code-header">
    <div class="lang-badge">
      <span class="lang-dot"></span>
      Java
    </div>
    <button class="copy-btn" on:click={() => navigator.clipboard.writeText(code)} title="Copy code">
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.3"/>
        <path d="M3 9H2.5A1.5 1.5 0 0 1 1 7.5V2.5A1.5 1.5 0 0 1 2.5 1H7.5A1.5 1.5 0 0 1 9 2.5V3" stroke="currentColor" stroke-width="1.3"/>
      </svg>
      Copy
    </button>
  </div>
  <div class="code-body">
    <pre><code>{@html highlighted}</code></pre>
  </div>
</div>

<style>
  .code-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--code-bg);
    overflow: hidden;
  }

  .code-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .lang-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text-dim);
    font-weight: 500;
  }

  .lang-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: var(--warning);
  }

  .copy-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 5px;
    color: var(--text-dim);
    font-family: var(--font-ui);
    font-size: 12px;
    padding: 4px 8px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .copy-btn:hover { background: var(--border); color: var(--text); }

  .code-body {
    flex: 1;
    overflow: auto;
    padding: 16px;
  }

  pre {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 12.5px;
    line-height: 1.7;
    color: var(--text-dim);
    white-space: pre;
  }

  :global(.kw) { color: #c792ea; font-weight: 500; }
  :global(.num) { color: #f78c6c; }
  :global(.str) { color: #c3e88d; }
  :global(.c)   { color: #546e7a; font-style: italic; }
  :global(.var) { color: #82aaff; }
</style>