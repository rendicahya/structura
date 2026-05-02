import { writable, get, derived } from 'svelte/store';
import { logOpLinkedQueue, linkedQueueLog } from '../shared/linkedQueueLog.js';

/**
 * @typedef {{ id: string, varName: string, data: string, nextId: string|null }} LinkedQueueNode
 */

/** @type {import('svelte/store').Writable<LinkedQueueNode[]>} */
export const linkedQueueNodes = writable([]);

let nodeCounter = 0;

export const linkedQueueIsEmpty = derived(
  linkedQueueNodes,
  ($nodes) => $nodes.filter(n => isInQueue(n, $nodes)).length === 0
);

/**
 * Check if node is reachable from head
 * @param {LinkedQueueNode} node
 * @param {LinkedQueueNode[]} nodes
 */
function isInQueue(node, nodes) {
  const pointed = new Set(nodes.map(n => n.nextId).filter(Boolean));
  const heads = nodes.filter(n => !pointed.has(n.id) && nodes.some(m => m.id === n.id));
  if (heads.length === 0) return false;
  let current = heads[0];
  while (current) {
    if (current.id === node.id) return true;
    const next = nodes.find(n => n.id === current.nextId);
    current = next ?? null;
  }
  return false;
}

function getQueueChain(nodes) {
  if (nodes.length === 0) return [];
  const pointed = new Set(nodes.map(n => n.nextId).filter(Boolean));
  const tops = nodes.filter(n => !pointed.has(n.id));
  if (tops.length === 0) return [];
  const result = [];
  let current = tops[0];
  while (current) {
    result.push(current);
    const next = nodes.find(n => n.id === current.nextId);
    current = next ?? null;
  }
  return result;
}

export const headNode = derived(
  linkedQueueNodes,
  ($nodes) => {
    const chain = getQueueChain($nodes);
    return chain.length > 0 ? chain[0] : null;
  }
);

export const tailNode = derived(
  linkedQueueNodes,
  ($nodes) => {
    const chain = getQueueChain($nodes);
    return chain.length > 0 ? chain[chain.length - 1] : null;
  }
);

export const queueChain = derived(
  linkedQueueNodes,
  ($nodes) => getQueueChain($nodes)
);

export const unreachableQueueNodes = derived(
  linkedQueueNodes,
  ($nodes) => {
    const chain = getQueueChain($nodes);
    const chainIds = new Set(chain.map(n => n.id));
    return $nodes.filter(n => !chainIds.has(n.id));
  }
);

/**
 * @param {string} value
 */
export function enqueueLinked(value) {
  const id = `lq_${++nodeCounter}`;
  const varName = `node${nodeCounter}`;
  const nodes = get(linkedQueueNodes);
  const tail = nodes.length > 0 ? getQueueChain(nodes).at(-1) : null;

  /** @type {LinkedQueueNode} */
  const newNode = { id, varName, data: value, nextId: null };
  linkedQueueNodes.update(ns => [...ns, newNode]);

  const javaOps = [
    `Node ${varName} = new Node(${formatVal(value)});`,
  ];
  const pyOps = [
    `${varName} = Node(${formatPyVal(value)})`,
  ];
  const cppOps = [
    `Node* ${varName} = new Node(${formatVal(value)});`,
  ];

  if (tail) {
    linkedQueueNodes.update(ns => ns.map(n =>
      n.id === tail.id ? { ...n, nextId: id } : n
    ));
    javaOps.push(`tail.next = ${varName};`);
    javaOps.push(`tail = ${varName};`);
    pyOps.push(`tail.next = ${varName}`);
    pyOps.push(`tail = ${varName}`);
    cppOps.push(`tail->next = ${varName};`);
    cppOps.push(`tail = ${varName};`);
  } else {
    // First node — head and tail both point to it
    javaOps.push(`head = ${varName};`);
    javaOps.push(`tail = ${varName};`);
    pyOps.push(`head = ${varName}`);
    pyOps.push(`tail = ${varName}`);
    cppOps.push(`head = ${varName};`);
    cppOps.push(`tail = ${varName};`);
  }

  logOpLinkedQueue(javaOps, pyOps, cppOps);
  return true;
}

export function dequeueLinked() {
  const nodes = get(linkedQueueNodes);
  const chain = getQueueChain(nodes);
  if (chain.length === 0) return false;

  const head = chain[0];
  const newHead = chain.length > 1 ? chain[1] : null;

  const javaOps = [
    `Node dequeued = head;`,
    `head = head.next;`,
    `dequeued.next = null;`,
  ];
  const pyOps = [
    `dequeued = head`,
    `head = head.next`,
    `dequeued.next = None`,
  ];
  const cppOps = [
    `Node* dequeued = head;`,
    `head = head->next;`,
    `dequeued->next = nullptr;`,
  ];

  logOpLinkedQueue(javaOps, pyOps, cppOps);

  // Sever head dari chain tapi tetap di canvas
  linkedQueueNodes.update(ns => ns.map(n =>
    n.id === head.id ? { ...n, nextId: null } : n
  ));

  return true;
}

export function peekLinkedQueue() {
  const nodes = get(linkedQueueNodes);
  const chain = getQueueChain(nodes);
  if (chain.length === 0) return false;

  const head = chain[0];
  logOpLinkedQueue(
    [`Node peeked = head; // peek → ${head.data}`],
    [`peeked = head  # peek → ${head.data}`],
    [`Node* peeked = head; // peek → ${head.data}`]
  );
  return true;
}

export function garbageCollectLinkedQueue() {
  const nodes = get(linkedQueueNodes);
  const chain = getQueueChain(nodes);
  const chainIds = new Set(chain.map(n => n.id));
  const toRemove = nodes.filter(n => !chainIds.has(n.id));

  if (toRemove.length === 0) {
    logOpLinkedQueue(
      ['// GC: no unreachable nodes found'],
      ['# GC: no unreachable nodes found'],
      ['// GC: no unreachable nodes found']
    );
    return;
  }

  const javaOps = toRemove.map(n => `// GC: ${n.varName} collected`);
  const pyOps   = toRemove.map(n => `# GC: ${n.varName} collected`);
  const cppOps  = toRemove.map(n => `// GC: delete ${n.varName};`);
  logOpLinkedQueue(javaOps, pyOps, cppOps);

  linkedQueueNodes.update(ns => ns.filter(n => chainIds.has(n.id)));
}

export function clearLinkedQueue() {
  linkedQueueNodes.set([]);
  nodeCounter = 0;
}

export function getSnapshotLinkedQueue() {
  return {
    nodes: JSON.parse(JSON.stringify(get(linkedQueueNodes))),
    counter: nodeCounter,
    codeLog: JSON.parse(JSON.stringify(get(linkedQueueLog))),
    _type: 'linked-queue',
  };
}

/**
 * @param {ReturnType<typeof getSnapshotLinkedQueue>} snapshot
 */
export function applySnapshotLinkedQueue(snapshot) {
  nodeCounter = snapshot.counter ?? 0;
  linkedQueueNodes.set(snapshot.nodes ?? []);
  linkedQueueLog.set(snapshot.codeLog ?? []);
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