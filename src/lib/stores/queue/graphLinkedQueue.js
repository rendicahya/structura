import { writable, get, derived } from 'svelte/store';
import { logOpLinkedQueue, linkedQueueLog } from '../shared/linkedQueueLog.js';

/**
 * @typedef {{ id: string, varName: string, data: string, nextId: string|null }} LinkedQueueNode
 */

/** @type {import('svelte/store').Writable<LinkedQueueNode[]>} */
export const linkedQueueNodes = writable([]);
export const headId = writable(null);
export const tailId = writable(null);

let nodeCounter = 0;

export const linkedQueueIsEmpty = derived(
  headId,
  ($headId) => !$headId
);

function getQueueChain(nodes, hId) {
  if (!hId) return [];
  const result = [];
  let current = nodes.find(n => n.id === hId);
  while (current) {
    result.push(current);
    const nextId = current.nextId;
    current = nextId ? nodes.find(n => n.id === nextId) : null;
  }
  return result;
}

export const headNode = derived(
  [linkedQueueNodes, headId],
  ([$nodes, $headId]) => $nodes.find(n => n.id === $headId) || null
);

export const tailNode = derived(
  [linkedQueueNodes, tailId],
  ([$nodes, $tailId]) => $nodes.find(n => n.id === $tailId) || null
);

export const queueChain = derived(
  [linkedQueueNodes, headId],
  ([$nodes, $headId]) => getQueueChain($nodes, $headId)
);

export const unreachableQueueNodes = derived(
  [linkedQueueNodes, headId],
  ([$nodes, $headId]) => {
    const chain = getQueueChain($nodes, $headId);
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
  const hId = get(headId);
  const tId = get(tailId);

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

  if (tId) {
    linkedQueueNodes.update(ns => ns.map(n =>
      n.id === tId ? { ...n, nextId: id } : n
    ));
    tailId.set(id);
    javaOps.push(`tail.next = ${varName};`);
    javaOps.push(`tail = ${varName};`);
    pyOps.push(`tail.next = ${varName}`);
    pyOps.push(`tail = ${varName}`);
    cppOps.push(`tail->next = ${varName};`);
    cppOps.push(`tail = ${varName};`);
  } else {
    // First node — head and tail both point to it
    headId.set(id);
    tailId.set(id);
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
  const hId = get(headId);
  if (!hId) return false;

  const currentHead = nodes.find(n => n.id === hId);
  if (!currentHead) return false;

  const nextHeadId = currentHead.nextId;

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

  // Update headId
  headId.set(nextHeadId);
  if (!nextHeadId) {
    tailId.set(null);
  }

  // Sever head dari chain tapi tetap di canvas (biar jadi unreachable)
  linkedQueueNodes.update(ns => ns.map(n =>
    n.id === hId ? { ...n, nextId: null } : n
  ));

  return true;
}

export function peekLinkedQueue() {
  const hId = get(headId);
  if (!hId) return false;

  const nodes = get(linkedQueueNodes);
  const head = nodes.find(n => n.id === hId);
  if (!head) return false;

  logOpLinkedQueue(
    [`Node peeked = head; // peek → ${head.data}`],
    [`peeked = head  # peek → ${head.data}`],
    [`Node* peeked = head; // peek → ${head.data}`]
  );
  return true;
}

export function garbageCollectLinkedQueue() {
  const nodes = get(linkedQueueNodes);
  const hId = get(headId);
  const chain = getQueueChain(nodes, hId);
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
  headId.set(null);
  tailId.set(null);
  nodeCounter = 0;
}

export function getSnapshotLinkedQueue() {
  return {
    nodes: JSON.parse(JSON.stringify(get(linkedQueueNodes))),
    headId: get(headId),
    tailId: get(tailId),
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
  headId.set(snapshot.headId ?? null);
  tailId.set(snapshot.tailId ?? null);
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