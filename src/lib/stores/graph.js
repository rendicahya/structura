import { writable, get } from 'svelte/store';
import { logOp, codeLog } from './codeLog.js';

export const nodes = writable([]);
export const edges = writable([]);
export const headId = writable(null);
export const tailId = writable(null);
export const walkId = writable(null);

let nodeCounter = 0;

export function createNode(x = 200, y = 200) {
  const id = `node_${++nodeCounter}`;
  const varName = `node${nodeCounter}`;
  return { id, varName, data: '', x, y, nextId: null };
}

export function addNode(node, silent = false) {
  nodes.update(ns => [...ns, node]);
  if (!silent) logOp(
    `Node ${node.varName} = new Node();`,
    `${node.varName} = Node()`
  );
}

export function setWalk(nodeId) {
  walkId.set(nodeId);
  const ns = get(nodes);
  const node = ns.find(n => n.id === nodeId);
  if (node) logOp(
    `Node walk = ${node.varName};`,
    `walk = ${node.varName}`
  );
  else logOp(`// walk unset`, `# walk unset`);
}

export function removeNodeFromList(nodeId) {
  const ns = get(nodes);
  const predecessor = ns.find(n => n.nextId === nodeId);
  const target = ns.find(n => n.id === nodeId);
  if (!target) return;

  const javaOps = [];
  const pyOps   = [];

  if (predecessor && target.nextId) {
    const successor = ns.find(n => n.id === target.nextId);
    connectNodes(predecessor.id, target.nextId, true);
    javaOps.push(`${predecessor.varName}.next = ${successor?.varName};`);
    pyOps.push(`${predecessor.varName}.next = ${successor?.varName}`);
    // Disconnect target from successor
    javaOps.push(`${target.varName}.next = null;`);
    pyOps.push(`${target.varName}.next = None`);
  } else if (predecessor && !target.nextId) {
    disconnectNode(predecessor.id, true);
    javaOps.push(`${predecessor.varName}.next = null;`);
    pyOps.push(`${predecessor.varName}.next = None`);
  }

  edges.update(es => es.filter(e => e.from !== nodeId));
  nodes.update(ns => ns.map(n => n.id === nodeId ? { ...n, nextId: null } : n));
  headId.update(id => id === nodeId ? null : id);
  tailId.update(id => id === nodeId ? null : id);
  walkId.update(id => id === nodeId ? null : id);

  if (javaOps.length > 0) logOp(javaOps, pyOps);
}

export function updateNode(nodeId, patch, silent = false) {
  const ns = get(nodes);
  const old = ns.find(n => n.id === nodeId);
  nodes.update(ns => ns.map(n => n.id === nodeId ? { ...n, ...patch } : n));

  if (!silent && old) {
    if (patch.varName !== undefined) {
      logOp(
        `// renamed: ${old.varName} → ${patch.varName}`,
        `# renamed: ${old.varName} → ${patch.varName}`
      );
    }
    if (patch.data !== undefined && patch.data !== old.data) {
      const updated = get(nodes).find(n => n.id === nodeId);
      const val = formatValue(patch.data);
      const pyVal = formatPythonValue(patch.data);
      logOp(
        `${updated.varName}.data = ${val};`,
        `${updated.varName}.data = ${pyVal}`
      );
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
    if (from && to) logOp(
      `${from.varName}.next = ${to.varName};`,
      `${from.varName}.next = ${to.varName}`
    );
  }
}

export function disconnectNode(nodeId, silent = false) {
  const ns = get(nodes);
  const node = ns.find(n => n.id === nodeId);
  edges.update(es => es.filter(e => e.from !== nodeId));
  nodes.update(ns => ns.map(n => n.id === nodeId ? { ...n, nextId: null } : n));
  if (!silent && node) logOp(
    `${node.varName}.next = null;`,
    `${node.varName}.next = None`
  );
}

export function setHead(nodeId) {
  headId.set(nodeId);
  const ns = get(nodes);
  const node = ns.find(n => n.id === nodeId);
  if (node) logOp(
    `Node head = ${node.varName};`,
    `head = ${node.varName}`
  );
  else logOp(`// head unset`, `# head unset`);
}

export function setTail(nodeId) {
  tailId.set(nodeId);
  const ns = get(nodes);
  const node = ns.find(n => n.id === nodeId);
  if (node) logOp(
    `Node tail = ${node.varName};`,
    `tail = ${node.varName}`
  );
  else logOp(`// tail unset`, `# tail unset`);
}

export function garbageCollect() {
  const ns = get(nodes);
  const hId = get(headId);
  const tId = get(tailId);
  const reachable = new Set();

  ns.forEach(n => { if (n.nextId) reachable.add(n.nextId); });
  ns.forEach(n => { if (n.nextId) reachable.add(n.id); });
  if (hId) reachable.add(hId);
  if (tId) reachable.add(tId);

  const toRemove = ns.filter(n => !reachable.has(n.id));

  if (toRemove.length === 0) {
    logOp('// GC: no unreachable nodes found', '# GC: no unreachable nodes found');
    return;
  }

  const javaOps = toRemove.map(n => `// GC: ${n.varName} collected`);
  const pyOps   = toRemove.map(n => `# GC: ${n.varName} collected`);
  logOp(javaOps, pyOps);

  nodes.update(ns => ns.filter(n => reachable.has(n.id)));
  edges.update(es => es.filter(e =>
    reachable.has(e.from) && reachable.has(e.to)
  ));
}

// Helpers
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

export function getSnapshot() {
  return {
    nodes: JSON.parse(JSON.stringify(get(nodes))),
    edges: JSON.parse(JSON.stringify(get(edges))),
    headId: get(headId),
    tailId: get(tailId),
    walkId: get(walkId),
    counter: nodeCounter,
    codeLog: JSON.parse(JSON.stringify(get(codeLog))),
  };
}

export function applySnapshot(snapshot) {
  nodeCounter = snapshot.counter ?? 0;
  nodes.set(snapshot.nodes ?? []);
  edges.set(snapshot.edges ?? []);
  headId.set(snapshot.headId ?? null);
  tailId.set(snapshot.tailId ?? null);
  walkId.set(snapshot.walkId ?? null);
  codeLog.set(snapshot.codeLog ?? []);
}