import { writable, get, derived } from 'svelte/store';
import { logOpLinkedStack, linkedStackLog } from '../shared/linkedStackLog.js';

/**
 * @typedef {{ id: string, varName: string, data: string, nextId: string|null }} LinkedStackNode
 */

/** @type {import('svelte/store').Writable<LinkedStackNode[]>} */
export const linkedStackNodes = writable([]);

let nodeCounter = 0;

/** @type {import('svelte/store').Readable<string|null>} */
export const topId = derived(
  linkedStackNodes,
  ($nodes) => $nodes.length > 0 ? $nodes[0].id : null
);

/** @type {import('svelte/store').Readable<boolean>} */
export const linkedStackIsEmpty = derived(
  linkedStackNodes,
  ($nodes) => $nodes.length === 0
);

/**
 * @param {string} value
 */
export function pushLinkedStack(value) {
  const id = `ls_${++nodeCounter}`;
  const varName = `node${nodeCounter}`;
  const nodes = get(linkedStackNodes);
  const currentTop = nodes.length > 0 ? nodes[0] : null;

  /** @type {LinkedStackNode} */
  const newNode = { id, varName, data: value, nextId: currentTop?.id ?? null };

  linkedStackNodes.update(ns => [newNode, ...ns]);

  const javaOps = [
    `Node ${varName} = new Node(${formatVal(value)});`,
    `${varName}.next = top;`,
    `top = ${varName};`,
  ];
  const pyOps = [
    `${varName} = Node(${formatPyVal(value)})`,
    `${varName}.next = top`,
    `top = ${varName}`,
  ];

  logOpLinkedStack(javaOps, pyOps);
  return true;
}

export function popLinkedStack() {
  const nodes = get(linkedStackNodes);
  if (nodes.length === 0) return false;

  const popped = nodes[0];
  const newTop = nodes.length > 1 ? nodes[1] : null;

  const javaOps = [
    `Node popped = top;`,
    `top = top.next;`,
    `popped.next = null;`,
  ];
  const pyOps = [
    `popped = top`,
    `top = top.next`,
    `popped.next = None`,
  ];

  logOpLinkedStack(javaOps, pyOps);

  // Sever popped node dari list tapi tetap di store untuk GC
  linkedStackNodes.update(ns => {
    const updated = [...ns];
    updated[0] = { ...updated[0], nextId: null };
    return updated.slice(1).concat({ ...popped, nextId: null });
  });

  return true;
}

export function peekLinkedStack() {
  const nodes = get(linkedStackNodes);
  if (nodes.length === 0) return false;

  const top = nodes[0];
  logOpLinkedStack(
    [`Node peeked = top; // peek → ${top.data}`],
    [`peeked = top  # peek → ${top.data}`]
  );
  return true;
}

export function garbageCollectLinkedStack() {
  const nodes = get(linkedStackNodes);
  const reachable = new Set();

  // Reachable: node yang ada di stack (terhubung dari top)
  const stackNodes = nodes.filter((_, i) => {
    // Node yang masih di stack adalah yang punya nextId atau adalah top (index 0 dari filtered)
    return true; // akan difilter di bawah
  });

  // Traverse dari top
  const allNodes = get(linkedStackNodes);
  // Node yang terhubung = node yang nextId-nya ada di allNodes
  const inStack = new Set();
  // Top adalah node pertama yang nextId-nya menunjuk ke node berikutnya secara berurutan
  // Setelah pop, node yang di-pop punya nextId = null dan tidak ditunjuk siapapun
  allNodes.forEach(n => {
    if (n.nextId) inStack.add(n.nextId);
  });
  // Top sendiri (node pertama yang tidak ditunjuk siapapun dan punya nextId atau kosong)
  const pointed = new Set(allNodes.map(n => n.nextId).filter(Boolean));
  const tops = allNodes.filter(n => !pointed.has(n.id));

  // Traverse dari top
  if (tops.length > 0) {
    let current = tops[0];
    while (current) {
      reachable.add(current.id);
      const next = allNodes.find(n => n.id === current.nextId);
      current = next ?? null;
    }
  }

  const toRemove = allNodes.filter(n => !reachable.has(n.id));
  if (toRemove.length === 0) {
    logOpLinkedStack(
      ['// GC: no unreachable nodes found'],
      ['# GC: no unreachable nodes found']
    );
    return;
  }

  const javaOps = toRemove.map(n => `// GC: ${n.varName} collected`);
  const pyOps   = toRemove.map(n => `# GC: ${n.varName} collected`);
  logOpLinkedStack(javaOps, pyOps);

  linkedStackNodes.update(ns => ns.filter(n => reachable.has(n.id)));
}

export function clearLinkedStack() {
  linkedStackNodes.set([]);
  nodeCounter = 0;
}

export function getSnapshotLinkedStack() {
  return {
    nodes: JSON.parse(JSON.stringify(get(linkedStackNodes))),
    counter: nodeCounter,
    codeLog: JSON.parse(JSON.stringify(get(linkedStackLog))),
    _type: 'linked-stack',
  };
}

/**
 * @param {ReturnType<typeof getSnapshotLinkedStack>} snapshot
 */
export function applySnapshotLinkedStack(snapshot) {
  nodeCounter = snapshot.counter ?? 0;
  linkedStackNodes.set(snapshot.nodes ?? []);
  linkedStackLog.set(snapshot.codeLog ?? []);
}

/** @param {string} val */
function formatVal(val) {
  if (!val) return '';
  if (/^-?\d+(\.\d+)?$/.test(val.trim())) return val.trim();
  return `"${val}"`;
}

/** @param {string} val */
function formatPyVal(val) {
  if (!val) return '';
  if (/^-?\d+(\.\d+)?$/.test(val.trim())) return val.trim();
  return `"${val}"`;
}