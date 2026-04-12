<script>
  import { nodes, edges, headId, tailId } from '../stores/graph.js';

  let lang = 'java';

  function isInt(val) {
    return /^-?\d+$/.test((val ?? '').trim());
  }
  function isFloat(val) {
    return /^-?\d+\.\d+$/.test((val ?? '').trim());
  }
  function isNumeric(val) {
    return isInt(val) || isFloat(val);
  }

  // Determine the best Java type for "data" across all nodes
  function inferJavaType(ns) {
    const values = ns.map(n => n.data).filter(v => v !== '' && v != null);
    if (values.length === 0) return 'String';
    if (values.every(v => isInt(v))) return 'int';
    if (values.every(v => isNumeric(v))) return 'double';
    return 'String';
  }

  function formatJavaData(val, type) {
    if (val === '' || val == null) return null; // empty → no-arg constructor
    if (type === 'int' || type === 'double') return val.trim();
    return `"${val}"`;
  }

  function formatPythonData(val) {
    if (val === '' || val == null) return null;
    if (isNumeric(val)) return val.trim();
    return `"${val}"`;
  }

  function generateJava(ns, es, hId, tId) {
    if (ns.length === 0) return '// Add nodes to generate code';
    const type = inferJavaType(ns);
    const lines = [];
    lines.push('// ─── Node class ───────────────────────────');
    lines.push('class Node {');
    lines.push(`    ${type} data;`);
    lines.push('    Node next;');
    lines.push('');
    // No-arg constructor
    lines.push('    Node() {');
    lines.push('        this.next = null;');
    lines.push('    }');
    lines.push('');
    // Data constructor
    lines.push(`    Node(${type} data) {`);
    lines.push('        this.data = data;');
    lines.push('        this.next = null;');
    lines.push('    }');
    lines.push('}');
    lines.push('');
    lines.push('// ─── Nodes ─────────────────────────────────');
    for (const n of ns) {
      const d = formatJavaData(n.data, type);
      lines.push(`Node ${n.varName} = new Node(${d ?? ''});`);
    }
    if (es.length > 0) {
      lines.push('');
      lines.push('// ─── Links ─────────────────────────────────');
      for (const e of es) {
        const f = ns.find(n => n.id === e.from);
        const t = ns.find(n => n.id === e.to);
        if (f && t) lines.push(`${f.varName}.next = ${t.varName};`);
      }
    }
    const hn = ns.find(n => n.id === hId);
    const tn = ns.find(n => n.id === tId);
    if (hn || tn) {
      lines.push('');
      lines.push('// ─── Pointers ──────────────────────────────');
      if (hn) lines.push(`Node head = ${hn.varName};`);
      if (tn) lines.push(`Node tail = ${tn.varName};`);
    }
    return lines.join('\n');
  }

  function generatePython(ns, es, hId, tId) {
    if (ns.length === 0) return '# Add nodes to generate code';
    const lines = [];
    lines.push('# ─── Node class ───────────────────────────');
    lines.push('class Node:');
    lines.push('    def __init__(self, data=None):');
    lines.push('        self.data = data');
    lines.push('        self.next = None');
    lines.push('');
    lines.push('# ─── Nodes ─────────────────────────────────');
    for (const n of ns) {
      const d = formatPythonData(n.data);
      lines.push(`${n.varName} = Node(${d ?? ''})`);
    }
    if (es.length > 0) {
      lines.push('');
      lines.push('# ─── Links ─────────────────────────────────');
      for (const e of es) {
        const f = ns.find(n => n.id === e.from);
        const t = ns.find(n => n.id === e.to);
        if (f && t) lines.push(`${f.varName}.next = ${t.varName}`);
      }
    }
    const hn = ns.find(n => n.id === hId);
    const tn = ns.find(n => n.id === tId);
    if (hn || tn) {
      lines.push('');
      lines.push('# ─── Pointers ──────────────────────────────');
      if (hn) lines.push(`head = ${hn.varName}`);
      if (tn) lines.push(`tail = ${tn.varName}`);
    }
    return lines.join('\n');
  }

  $: code = lang === 'java'
    ? generateJava($nodes, $edges, $headId, $tailId)
    : generatePython($nodes, $edges, $headId, $tailId);

  const JAVA_KW   = new Set(['class','new','int','double','String','void','null','this','Node','return']);
  const PYTHON_KW = new Set(['class','def','self','None','True','False','return','import','from','if','else','elif','and','or','not','in']);

  function highlight(raw, language) {
    const KW = language === 'java' ? JAVA_KW : PYTHON_KW;
    const commentChar = language === 'java' ? '//' : '#';
    const tokens = [];
    let i = 0;
    while (i < raw.length) {
      if (raw.slice(i, i + commentChar.length) === commentChar) {
        const end = raw.indexOf('\n', i);
        const text = end === -1 ? raw.slice(i) : raw.slice(i, end);
        tokens.push({ type: 'comment', text }); i += text.length; continue;
      }
      if (raw[i] === '"') {
        let j = i + 1;
        while (j < raw.length && raw[j] !== '"') j++;
        tokens.push({ type: 'string', text: raw.slice(i, j + 1) }); i = j + 1; continue;
      }
      if (raw[i] === "'") {
        let j = i + 1;
        while (j < raw.length && raw[j] !== "'") j++;
        tokens.push({ type: 'string', text: raw.slice(i, j + 1) }); i = j + 1; continue;
      }
      if (/[0-9]/.test(raw[i]) || (raw[i] === '-' && /[0-9]/.test(raw[i+1] ?? ''))) {
        let j = i + 1;
        while (j < raw.length && /[0-9.]/.test(raw[j])) j++;
        tokens.push({ type: 'number', text: raw.slice(i, j) }); i = j; continue;
      }
      if (/[a-zA-Z_]/.test(raw[i])) {
        let j = i + 1;
        while (j < raw.length && /[a-zA-Z0-9_]/.test(raw[j])) j++;
        const word = raw.slice(i, j);
        tokens.push({ type: KW.has(word) ? 'keyword' : 'ident', text: word }); i = j; continue;
      }
      tokens.push({ type: 'plain', text: raw[i] }); i++;
    }
    function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
    return tokens.map(t => {
      switch (t.type) {
        case 'keyword': return `<span class="kw">${esc(t.text)}</span>`;
        case 'number':  return `<span class="num">${esc(t.text)}</span>`;
        case 'string':  return `<span class="str">${esc(t.text)}</span>`;
        case 'comment': return `<span class="c">${esc(t.text)}</span>`;
        default:        return esc(t.text);
      }
    }).join('');
  }

  $: highlighted = highlight(code, lang);

  let copied = false;
  let copyTimer;
  function handleCopy() {
    navigator.clipboard.writeText(code);
    copied = true;
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => copied = false, 2000);
  }
</script>

<div class="code-panel">
  <div class="code-header">
    <div class="lang-tabs">
      <button class="lang-tab" class:active={lang === 'java'} on:click={() => lang = 'java'}>
        <span class="dot java-dot"></span>Java
      </button>
      <button class="lang-tab" class:active={lang === 'python'} on:click={() => lang = 'python'}>
        <span class="dot python-dot"></span>Python
      </button>
    </div>
    <button class="copy-btn" class:copied on:click={handleCopy}>
      {#if copied}
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <path d="M2 7L5 10L11 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Copied!
      {:else}
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.3"/>
          <path d="M3 9H2.5A1.5 1.5 0 0 1 1 7.5V2.5A1.5 1.5 0 0 1 2.5 1H7.5A1.5 1.5 0 0 1 9 2.5V3" stroke="currentColor" stroke-width="1.3"/>
        </svg>
        Copy
      {/if}
    </button>
  </div>
  <div class="code-body">
    <pre><code>{@html highlighted}</code></pre>
  </div>
</div>

<style>
  .code-panel { display: flex; flex-direction: column; height: 100%; background: var(--code-bg); overflow: hidden; }
  .code-header { display: flex; align-items: center; justify-content: space-between; padding: 6px 12px 0; border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .lang-tabs { display: flex; gap: 2px; }
  .lang-tab { display: flex; align-items: center; gap: 6px; padding: 7px 12px; background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-muted); font-family: var(--font-mono); font-size: 12px; font-weight: 500; cursor: pointer; margin-bottom: -1px; transition: all 0.15s; }
  .lang-tab:hover { color: var(--text-dim); }
  .lang-tab.active { color: var(--text); border-bottom-color: var(--accent); }
  .dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .java-dot { background: var(--warning); }
  .python-dot { background: #4b8bbe; }
  .copy-btn { display: flex; align-items: center; gap: 5px; background: var(--surface2); border: 1px solid var(--border); border-radius: 5px; color: var(--text-dim); font-family: var(--font-ui); font-size: 12px; padding: 4px 8px; cursor: pointer; transition: all 0.15s; min-width: 70px; justify-content: center; margin-bottom: 6px; }
  .copy-btn:hover { background: var(--border); color: var(--text); }
  .copy-btn.copied { background: rgba(78,204,163,0.12); border-color: var(--success); color: var(--success); }
  .code-body { flex: 1; overflow: auto; padding: 16px; }
  pre { margin: 0; font-family: var(--font-mono); font-size: 12.5px; line-height: 1.7; color: var(--text-dim); white-space: pre; }
  :global(.kw)  { color: #c792ea; font-weight: 500; }
  :global(.num) { color: #f78c6c; }
  :global(.str) { color: #c3e88d; }
  :global(.c)   { color: #546e7a; font-style: italic; }
</style>