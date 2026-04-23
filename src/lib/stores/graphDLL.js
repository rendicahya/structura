import { writable, get } from 'svelte/store';
import { logOpDLL } from './codeLogDLL.js';

export const nodesDLL = writable([]);
export const edgesDLL = writable([]);
export const headIdDLL = writable(null);
export const tailIdDLL = writable(null);
export const walkIdDLL = writable(null);

let nodeCounter = 0;

export function createNodeDLL(x = 200, y = 200) {
  const id = `dll_${++nodeCounter}`;
  const varName = `node${nodeCounter}`;
  return { id, varName, data: '', x, y, nextId: null, prevId: null };
}

export function addNodeDLL(node, silent = false) {
  nodesDLL.update(ns => [...ns, node]);
  if (!silent) logOpDLL(
    `Node ${node.varName} = new Node();`,
    `${node.varName} = Node()`
  );
}

export function updateNodeDLL(nodeId, patch, silent = false) {
  const ns = get(nodesDLL);
  const old = ns.find(n => n.id === nodeId);
  nodesDLL.update(ns => ns.map(n => n.id === nodeId ? { ...n, ...patch } : n));

  if (!silent && old) {
    if (patch.varName !== undefined) {
      logOpDLL(
        `// renamed: ${old.varName} → ${patch.varName}`,
        `# renamed: ${old.varName} → ${patch.varName}`
      );
    }
    if (patch.data !== undefined && patch.data !== old.data) {
      const updated = get(nodesDLL).find(n => n.id === nodeId);
      const val = formatValue(patch.data);
      const pyVal = formatPythonValue(patch.data);
      logOpDLL(
        `${updated.varName}.data = ${val};`,
        `${updated.varName}.data = ${pyVal}`
      );
    }
  }
}

export function connectNextDLL(fromId, toId, silent = false) {
  // Remove old next edge from fromId
  edgesDLL.update(es => es.filter(e => !(e.from === fromId && e.type === 'next')));
  // Remove old prev edge from toId (someone else's next pointing to toId)
  edgesDLL.update(es => es.filter(e => !(e.to === toId && e.type === 'next')));

  nodesDLL.update(ns => ns.map(n => {
    if (n.id === fromId) return { ...n, nextId: toId };
    if (n.id === toId) return { ...n, prevId: fromId };
    // Clear old prevId if someone else was pointing to toId
    if (n.nextId === toId && n.id !== fromId) return { ...n, nextId: null };
    return n;
  }));

  edgesDLL.update(es => [...es, { from: fromId, to: toId, type: 'next' }]);

  if (!silent) {
    const ns = get(nodesDLL);
    const from = ns.find(n => n.id === fromId);
    const to   = ns.find(n => n.id === toId);
    if (from && to) logOpDLL(
      `${from.varName}.next = ${to.varName};\n${to.varName}.prev = ${from.varName};`,
      `${from.varName}.next = ${to.varName}\n${to.varName}.prev = ${from.varName}`
    );
  }
}

export function connectPrevDLL(fromId, toId, silent = false) {
  // fromId.prev = toId
  edgesDLL.update(es => es.filter(e => !(e.from === fromId && e.type === 'prev')));

  nodesDLL.update(ns => ns.map(n => {
    if (n.id === fromId) return { ...n, prevId: toId };
    if (n.id === toId) return { ...n, nextId: fromId };
    return n;
  }));

  edgesDLL.update(es => [...es, { from: fromId, to: toId, type: 'prev' }]);

  if (!silent) {
    const ns = get(nodesDLL);
    const from = ns.find(n => n.id === fromId);
    const to   = ns.find(n => n.id === toId);
    if (from && to) logOpDLL(
      `${from.varName}.prev = ${to.varName};\n${to.varName}.next = ${from.varName};`,
      `${from.varName}.prev = ${to.varName}\n${to.varName}.next = ${from.varName}`
    );
  }
}

export function disconnectNextDLL(nodeId, silent = false) {
  const ns = get(nodesDLL);
  const node = ns.find(n => n.id === nodeId);
  if (!node) return;
  const successor = ns.find(n => n.id === node.nextId);

  edgesDLL.update(es => es.filter(e => !(e.from === nodeId && e.type === 'next')));
  nodesDLL.update(ns => ns.map(n => {
    if (n.id === nodeId) return { ...n, nextId: null };
    if (successor && n.id === successor.id) return { ...n, prevId: null };
    return n;
  }));

  if (!silent && node) {
    const ops = [`${node.varName}.next = null;`];
    const pyOps = [`${node.varName}.next = None`];
    if (successor) {
      ops.push(`${successor.varName}.prev = null;`);
      pyOps.push(`${successor.varName}.prev = None`);
    }
    logOpDLL(ops, pyOps);
  }
}

export function disconnectPrevDLL(nodeId, silent = false) {
  const ns = get(nodesDLL);
  const node = ns.find(n => n.id === nodeId);
  if (!node) return;
  const predecessor = ns.find(n => n.id === node.prevId);

  edgesDLL.update(es => es.filter(e => !(e.from === nodeId && e.type === 'prev')));
  nodesDLL.update(ns => ns.map(n => {
    if (n.id === nodeId) return { ...n, prevId: null };
    if (predecessor && n.id === predecessor.id) return { ...n, nextId: null };
    return n;
  }));

  if (!silent && node) {
    const ops = [`${node.varName}.prev = null;`];
    const pyOps = [`${node.varName}.prev = None`];
    if (predecessor) {
      ops.push(`${predecessor.varName}.next = null;`);
      pyOps.push(`${predecessor.varName}.next = None`);
    }
    logOpDLL(ops, pyOps);
  }
}

export function removeNodeFromListDLL(nodeId) {
  const ns = get(nodesDLL);
  const target = ns.find(n => n.id === nodeId);
  if (!target) return;

  const predecessor = ns.find(n => n.id === target.prevId);
  const successor   = ns.find(n => n.id === target.nextId);

  const javaOps = [];
  const pyOps   = [];

  if (predecessor && successor) {
    // Skip over target: pred.next = succ, succ.prev = pred
    javaOps.push(`${predecessor.varName}.next = ${successor.varName};`);
    javaOps.push(`${successor.varName}.prev = ${predecessor.varName};`);
    pyOps.push(`${predecessor.varName}.next = ${successor.varName}`);
    pyOps.push(`${successor.varName}.prev = ${predecessor.varName}`);
    // Sever target's pointers
    javaOps.push(`${target.varName}.next = null;`);
    javaOps.push(`${target.varName}.prev = null;`);
    pyOps.push(`${target.varName}.next = None`);
    pyOps.push(`${target.varName}.prev = None`);

    nodesDLL.update(ns => ns.map(n => {
      if (n.id === predecessor.id) return { ...n, nextId: successor.id };
      if (n.id === successor.id)   return { ...n, prevId: predecessor.id };
      if (n.id === nodeId)         return { ...n, nextId: null, prevId: null };
      return n;
    }));
    edgesDLL.update(es => es.filter(e => e.from !== nodeId && e.to !== nodeId));
    edgesDLL.update(es => [
      ...es,
      { from: predecessor.id, to: successor.id, type: 'next' },
      { from: successor.id, to: predecessor.id, type: 'prev' },
    ]);
  } else if (predecessor && !successor) {
    javaOps.push(`${predecessor.varName}.next = null;`);
    javaOps.push(`${target.varName}.prev = null;`);
    pyOps.push(`${predecessor.varName}.next = None`);
    pyOps.push(`${target.varName}.prev = None`);
    nodesDLL.update(ns => ns.map(n => {
      if (n.id === predecessor.id) return { ...n, nextId: null };
      if (n.id === nodeId)         return { ...n, prevId: null };
      return n;
    }));
    edgesDLL.update(es => es.filter(e => e.from !== nodeId && e.to !== nodeId));
  } else if (!predecessor && successor) {
    javaOps.push(`${successor.varName}.prev = null;`);
    javaOps.push(`${target.varName}.next = null;`);
    pyOps.push(`${successor.varName}.prev = None`);
    pyOps.push(`${target.varName}.next = None`);
    nodesDLL.update(ns => ns.map(n => {
      if (n.id === successor.id) return { ...n, prevId: null };
      if (n.id === nodeId)       return { ...n, nextId: null };
      return n;
    }));
    edgesDLL.update(es => es.filter(e => e.from !== nodeId && e.to !== nodeId));
  }

  headIdDLL.update(id => id === nodeId ? null : id);
  tailIdDLL.update(id => id === nodeId ? null : id);
  walkIdDLL.update(id => id === nodeId ? null : id);

  if (javaOps.length > 0) logOpDLL(javaOps, pyOps);
}

export function setHeadDLL(nodeId) {
  headIdDLL.set(nodeId);
  const ns = get(nodesDLL);
  const node = ns.find(n => n.id === nodeId);
  if (node) logOpDLL(`Node head = ${node.varName};`, `head = ${node.varName}`);
  else logOpDLL(`// head unset`, `# head unset`);
}

export function setTailDLL(nodeId) {
  tailIdDLL.set(nodeId);
  const ns = get(nodesDLL);
  const node = ns.find(n => n.id === nodeId);
  if (node) logOpDLL(`Node tail = ${node.varName};`, `tail = ${node.varName}`);
  else logOpDLL(`// tail unset`, `# tail unset`);
}

export function setWalkDLL(nodeId) {
  walkIdDLL.set(nodeId);
  const ns = get(nodesDLL);
  const node = ns.find(n => n.id === nodeId);
  if (node) logOpDLL(`Node walk = ${node.varName};`, `walk = ${node.varName}`);
  else logOpDLL(`// walk unset`, `# walk unset`);
}

export function garbageCollectDLL() {
  const ns = get(nodesDLL);
  const hId = get(headIdDLL);
  const tId = get(tailIdDLL);
  const wId = get(walkIdDLL);
  const reachable = new Set();

  ns.forEach(n => {
    if (n.nextId) { reachable.add(n.nextId); reachable.add(n.id); }
    if (n.prevId) { reachable.add(n.prevId); reachable.add(n.id); }
  });
  if (hId) reachable.add(hId);
  if (tId) reachable.add(tId);
  if (wId) reachable.add(wId);

  const toRemove = ns.filter(n => !reachable.has(n.id));

  if (toRemove.length === 0) {
    logOpDLL('// GC: no unreachable nodes found', '# GC: no unreachable nodes found');
    return;
  }

  const javaOps = toRemove.map(n => `// GC: ${n.varName} collected`);
  const pyOps   = toRemove.map(n => `# GC: ${n.varName} collected`);
  logOpDLL(javaOps, pyOps);

  nodesDLL.update(ns => ns.filter(n => reachable.has(n.id)));
  edgesDLL.update(es => es.filter(e => reachable.has(e.from) && reachable.has(e.to)));
}

export function getSnapshotDLL() {
  return {
    nodes: JSON.parse(JSON.stringify(get(nodesDLL))),
    edges: JSON.parse(JSON.stringify(get(edgesDLL))),
    headId: get(headIdDLL),
    tailId: get(tailIdDLL),
    walkId: get(walkIdDLL),
    counter: nodeCounter,
    codeLog: JSON.parse(JSON.stringify(get(codeLogDLL))),
  };
}

export function applySnapshotDLL(snapshot) {
  nodeCounter = snapshot.counter ?? 0;
  nodesDLL.set(snapshot.nodes ?? []);
  edgesDLL.set(snapshot.edges ?? []);
  headIdDLL.set(snapshot.headId ?? null);
  tailIdDLL.set(snapshot.tailId ?? null);
  walkIdDLL.set(snapshot.walkId ?? null);
  codeLogDLL.set(snapshot.codeLog ?? []);
}

function formatValue(val) {
  if (!val) return 'null';
  if (/^-?\d+(\.\d+)?$/.test(val.trim())) return val.trim();
  return `"${val}"`;
}

function formatPythonValue(val) {
  if (!val) return 'None';
  if (/^-?\d+(\.\d+)?$/.test(val.trim())) return val.trim();
  return `"${val}"`;
}

import { codeLogDLL } from './codeLogDLL.js';