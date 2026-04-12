import { writable, get } from 'svelte/store';
import { logOp } from './codeLog.js';

export const nodes = writable([]);
export const edges = writable([]);
export const headId = writable(null);
export const tailId = writable(null);

let nodeCounter = 0;

export function createNode(x = 200, y = 200) {
  const id = `node_${++nodeCounter}`;
  const varName = `node${nodeCounter}`;
  return { id, varName, data: '', x, y, nextId: null };
}

export function addNode(node, silent = false) {
  nodes.update(ns => [...ns, node]);
  if (!silent) logOp(`Node ${node.varName} = new Node();`);
}

export function removeNodeFromList(nodeId, lang = 'java') {
  const ns = get(nodes);
  const predecessor = ns.find(n => n.nextId === nodeId);
  const target = ns.find(n => n.id === nodeId);
  if (!target) return;

  const ops = [];

  if (predecessor && target.nextId) {
    const successor = ns.find(n => n.id === target.nextId);
    connectNodes(predecessor.id, target.nextId, true);
    if (lang === 'python') ops.push(`${predecessor.varName}.next = ${successor?.varName}`);
    else ops.push(`${predecessor.varName}.next = ${successor?.varName};`);
  } else if (predecessor && !target.nextId) {
    disconnectNode(predecessor.id, true);
    if (lang === 'python') ops.push(`${predecessor.varName}.next = None`);
    else ops.push(`${predecessor.varName}.next = null;`);
  }

  // Sever outgoing edge of the removed node too
  edges.update(es => es.filter(e => e.from !== nodeId));
  nodes.update(ns => ns.map(n => n.id === nodeId ? { ...n, nextId: null } : n));

  headId.update(id => id === nodeId ? null : id);
  tailId.update(id => id === nodeId ? null : id);

  if (ops.length > 0) logOp(ops);
}

export function updateNode(nodeId, patch, silent = false) {
  const ns = get(nodes);
  const old = ns.find(n => n.id === nodeId);
  nodes.update(ns => ns.map(n => n.id === nodeId ? { ...n, ...patch } : n));

  if (!silent && old) {
    if (patch.varName !== undefined) {
      logOp(`// renamed: ${old.varName} → ${patch.varName}`);
    }
    if (patch.data !== undefined && patch.data !== old.data) {
      const updated = get(nodes).find(n => n.id === nodeId);
      logOp(`${updated.varName}.data = ${formatValue(patch.data)};`);
    }
  }
}

export function connectNodes(fromId, toId, silent = false) {
  edges.update(es => es.filter(e => e.from !== fromId));
  nodes.update(ns => ns.map(n => n.id === fromId ? { ...n, nextId: toId } : n));
  edges.update(es => [...es, { from: fromId, to: toId }]);

  if (!silent) {
    const ns = get(nodes);
    const from = ns.find(n => n.id === fromId);
    const to   = ns.find(n => n.id === toId);
    if (from && to) logOp(`${from.varName}.next = ${to.varName};`);
  }
}

export function disconnectNode(nodeId, silent = false) {
  const ns = get(nodes);
  const node = ns.find(n => n.id === nodeId);
  edges.update(es => es.filter(e => e.from !== nodeId));
  nodes.update(ns => ns.map(n => n.id === nodeId ? { ...n, nextId: null } : n));
  if (!silent && node) logOp(`${node.varName}.next = null;`);
}

export function setHead(nodeId) {
  headId.set(nodeId);
  const ns = get(nodes);
  const node = ns.find(n => n.id === nodeId);
  if (node) logOp(`Node head = ${node.varName};`);
  else logOp(`// head unset`);
}

export function setTail(nodeId) {
  tailId.set(nodeId);
  const ns = get(nodes);
  const node = ns.find(n => n.id === nodeId);
  if (node) logOp(`Node tail = ${node.varName};`);
  else logOp(`// tail unset`);
}

// Garbage collect: remove nodes not reachable and not head/tail
export function garbageCollect() {
  const ns = get(nodes);
  const hId = get(headId);
  const tId = get(tailId);
  const reachable = new Set();

  // Nodes pointed to by someone
  ns.forEach(n => { if (n.nextId) reachable.add(n.nextId); });
  // Nodes pointing to someone
  ns.forEach(n => { if (n.nextId) reachable.add(n.id); });
  // Head and tail always safe
  if (hId) reachable.add(hId);
  if (tId) reachable.add(tId);

  const toRemove = ns.filter(n => !reachable.has(n.id));
  if (toRemove.length === 0) return false;

  const ops = toRemove.map(n => `// GC: ${n.varName} collected`);
  logOp(ops);

  nodes.update(ns => ns.filter(n => reachable.has(n.id)));
  edges.update(es => es.filter(e =>
    reachable.has(e.from) && reachable.has(e.to)
  ));

  return true;
}

// Helper
function formatValue(val) {
  if (!val) return 'null';
  if (/^-?\d+(\.\d+)?$/.test(val.trim())) return val.trim();
  return `"${val}"`;
}

export function getSnapshot() {
  return {
    nodes: JSON.parse(JSON.stringify(get(nodes))),
    edges: JSON.parse(JSON.stringify(get(edges))),
    headId: get(headId),
    tailId: get(tailId),
    counter: nodeCounter,
  };
}

export function applySnapshot(snapshot) {
  nodeCounter = snapshot.counter ?? 0;
  nodes.set(snapshot.nodes ?? []);
  edges.set(snapshot.edges ?? []);
  headId.set(snapshot.headId ?? null);
  tailId.set(snapshot.tailId ?? null);
}