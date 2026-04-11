import { writable, get } from 'svelte/store';

export const nodes = writable([]);
export const edges = writable([]);

let nodeCounter = 0;

export function createNode(x = 200, y = 200) {
  const id = `node_${++nodeCounter}`;
  const varName = `node${nodeCounter}`;
  return { id, varName, data: '', x, y, nextId: null };
}

export function addNode(node) {
  nodes.update(ns => [...ns, node]);
}

export function removeNode(nodeId) {
  nodes.update(ns => ns.filter(n => n.id !== nodeId));
  edges.update(es => es.filter(e => e.from !== nodeId && e.to !== nodeId));
  // also unlink any node pointing to this
  nodes.update(ns => ns.map(n => n.nextId === nodeId ? { ...n, nextId: null } : n));
}

export function updateNode(nodeId, patch) {
  nodes.update(ns => ns.map(n => n.id === nodeId ? { ...n, ...patch } : n));
}

export function connectNodes(fromId, toId) {
  // remove old edge from this source
  edges.update(es => es.filter(e => e.from !== fromId));
  nodes.update(ns => ns.map(n => n.id === fromId ? { ...n, nextId: toId } : n));
  edges.update(es => [...es, { from: fromId, to: toId }]);
}

export function disconnectNode(nodeId) {
  edges.update(es => es.filter(e => e.from !== nodeId));
  nodes.update(ns => ns.map(n => n.id === nodeId ? { ...n, nextId: null } : n));
}

export function getSnapshot() {
  return {
    nodes: JSON.parse(JSON.stringify(get(nodes))),
    edges: JSON.parse(JSON.stringify(get(edges))),
    counter: nodeCounter,
  };
}

export function applySnapshot(snapshot) {
  nodeCounter = snapshot.counter;
  nodes.set(snapshot.nodes);
  edges.set(snapshot.edges);
}