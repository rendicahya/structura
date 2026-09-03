import { writable, get, derived } from 'svelte/store';
import { logOpDCL, dclLog, clearLogDCL } from '../shared/dclLog.js';
import { formatLiteral, formatPythonLiteral } from '../../utils/formatters.js';
import { walkRing, walkRingReverse, reachableRingIds } from '../../utils/linkedList.js';
import { cloneStoreValue } from '../../utils/storeSnapshot.js';

/**
 * @typedef {{ id: string, varName: string, data: string, nextId: string|null, prevId: string|null }} DCLNode
 */

/** @type {import('svelte/store').Writable<DCLNode[]>} */
export const dclNodes = writable([]);
export const dclHeadId = writable(null);
export const dclTailId = writable(null);

let nodeCounter = 0;

export const dclIsEmpty = derived(
  dclHeadId,
  ($headId) => !$headId
);

export const dclHeadNode = derived(
  [dclNodes, dclHeadId],
  ([$nodes, $headId]) => $nodes.find(n => n.id === $headId) || null
);

export const dclTailNode = derived(
  [dclNodes, dclTailId],
  ([$nodes, $tailId]) => $nodes.find(n => n.id === $tailId) || null
);

export const dclRing = derived(
  [dclNodes, dclHeadId],
  ([$nodes, $headId]) => walkRing($nodes, $headId)
);

export const unreachableDCLNodes = derived(
  [dclNodes, dclHeadId],
  ([$nodes, $headId]) => {
    const ringIds = reachableRingIds($nodes, $headId);
    return $nodes.filter(n => !ringIds.has(n.id));
  }
);

export function initNodeClassDCL() {
  logOpDCL(
    `class Node {\n    String data;\n    Node next;\n    Node prev;\n}`,
    `class Node:\n    def __init__(self):\n        self.data = None\n        self.next = None\n        self.prev = None`,
    `struct Node {\n    std::string data;\n    Node* next;\n    Node* prev;\n    Node() : next(nullptr), prev(nullptr) {}\n};`
  );
}

/**
 * @param {string} value
 */
export function insertHeadDCL(value) {
  const id = `dcl_${++nodeCounter}`;
  const varName = `node${nodeCounter}`;
  const hId = get(dclHeadId);
  const tId = get(dclTailId);

  /** @type {DCLNode} */
  const newNode = { id, varName, data: value, nextId: hId || id, prevId: tId || id };
  dclNodes.update(ns => [...ns, newNode]);

  const javaOps = [`Node ${varName} = new Node(${formatLiteral(value)});`];
  const pyOps = [`${varName} = Node(${formatPythonLiteral(value)})`];
  const cppOps = [`Node* ${varName} = new Node(${formatLiteral(value)});`];

  if (!hId) {
    // First node — the ring is just itself, both links pointing back home.
    dclHeadId.set(id);
    dclTailId.set(id);
    javaOps.push(`${varName}.next = ${varName};`, `${varName}.prev = ${varName};`, `head = ${varName};`, `tail = ${varName};`);
    pyOps.push(`${varName}.next = ${varName}`, `${varName}.prev = ${varName}`, `head = ${varName}`, `tail = ${varName}`);
    cppOps.push(`${varName}->next = ${varName};`, `${varName}->prev = ${varName};`, `head = ${varName};`, `tail = ${varName};`);
  } else {
    javaOps.push(
      `${varName}.next = head;`,
      `${varName}.prev = tail;`,
      `head.prev = ${varName};`,
      `tail.next = ${varName};`,
      `head = ${varName};`
    );
    pyOps.push(
      `${varName}.next = head`,
      `${varName}.prev = tail`,
      `head.prev = ${varName}`,
      `tail.next = ${varName}`,
      `head = ${varName}`
    );
    cppOps.push(
      `${varName}->next = head;`,
      `${varName}->prev = tail;`,
      `head->prev = ${varName};`,
      `tail->next = ${varName};`,
      `head = ${varName};`
    );
    dclNodes.update(ns => ns.map(n => {
      // Single existing node is both head and tail: it now links to the
      // newcomer in both directions.
      if (n.id === hId && n.id === tId) return { ...n, prevId: id, nextId: id };
      if (n.id === hId) return { ...n, prevId: id };
      if (n.id === tId) return { ...n, nextId: id };
      return n;
    }));
    dclHeadId.set(id);
  }

  logOpDCL(javaOps, pyOps, cppOps);
  return true;
}

/**
 * @param {string} value
 */
export function insertTailDCL(value) {
  const id = `dcl_${++nodeCounter}`;
  const varName = `node${nodeCounter}`;
  const hId = get(dclHeadId);
  const tId = get(dclTailId);

  /** @type {DCLNode} */
  const newNode = { id, varName, data: value, nextId: hId || id, prevId: tId || id };
  dclNodes.update(ns => [...ns, newNode]);

  const javaOps = [`Node ${varName} = new Node(${formatLiteral(value)});`];
  const pyOps = [`${varName} = Node(${formatPythonLiteral(value)})`];
  const cppOps = [`Node* ${varName} = new Node(${formatLiteral(value)});`];

  if (!hId) {
    dclHeadId.set(id);
    dclTailId.set(id);
    javaOps.push(`${varName}.next = ${varName};`, `${varName}.prev = ${varName};`, `head = ${varName};`, `tail = ${varName};`);
    pyOps.push(`${varName}.next = ${varName}`, `${varName}.prev = ${varName}`, `head = ${varName}`, `tail = ${varName}`);
    cppOps.push(`${varName}->next = ${varName};`, `${varName}->prev = ${varName};`, `head = ${varName};`, `tail = ${varName};`);
  } else {
    javaOps.push(
      `${varName}.next = head;`,
      `${varName}.prev = tail;`,
      `tail.next = ${varName};`,
      `head.prev = ${varName};`,
      `tail = ${varName};`
    );
    pyOps.push(
      `${varName}.next = head`,
      `${varName}.prev = tail`,
      `tail.next = ${varName}`,
      `head.prev = ${varName}`,
      `tail = ${varName}`
    );
    cppOps.push(
      `${varName}->next = head;`,
      `${varName}->prev = tail;`,
      `tail->next = ${varName};`,
      `head->prev = ${varName};`,
      `tail = ${varName};`
    );
    dclNodes.update(ns => ns.map(n => {
      if (n.id === tId && n.id === hId) return { ...n, nextId: id, prevId: id };
      if (n.id === tId) return { ...n, nextId: id };
      if (n.id === hId) return { ...n, prevId: id };
      return n;
    }));
    dclTailId.set(id);
  }

  logOpDCL(javaOps, pyOps, cppOps);
  return true;
}

export function deleteHeadDCL() {
  const nodes = get(dclNodes);
  const hId = get(dclHeadId);
  const tId = get(dclTailId);
  if (!hId) return false;

  const currentHead = nodes.find(n => n.id === hId);
  if (!currentHead) return false;

  const isOnly = hId === tId;
  let javaOps, pyOps, cppOps;

  if (isOnly) {
    javaOps = [`Node deleted = head;`, `head = null;`, `tail = null;`, `deleted.next = null;`, `deleted.prev = null;`];
    pyOps = [`deleted = head`, `head = None`, `tail = None`, `deleted.next = None`, `deleted.prev = None`];
    cppOps = [`Node* deleted = head;`, `head = nullptr;`, `tail = nullptr;`, `deleted->next = nullptr;`, `deleted->prev = nullptr;`];
    dclHeadId.set(null);
    dclTailId.set(null);
  } else {
    const newHeadId = currentHead.nextId;
    javaOps = [`Node deleted = head;`, `head = head.next;`, `head.prev = tail;`, `tail.next = head;`, `deleted.next = null;`, `deleted.prev = null;`];
    pyOps = [`deleted = head`, `head = head.next`, `head.prev = tail`, `tail.next = head`, `deleted.next = None`, `deleted.prev = None`];
    cppOps = [`Node* deleted = head;`, `head = head->next;`, `head->prev = tail;`, `tail->next = head;`, `deleted->next = nullptr;`, `deleted->prev = nullptr;`];
    dclHeadId.set(newHeadId);
    dclNodes.update(ns => ns.map(n => {
      if (n.id === newHeadId) return { ...n, prevId: tId };
      if (n.id === tId) return { ...n, nextId: newHeadId };
      return n;
    }));
  }

  logOpDCL(javaOps, pyOps, cppOps);
  return true;
}

export function deleteTailDCL() {
  const nodes = get(dclNodes);
  const hId = get(dclHeadId);
  const tId = get(dclTailId);
  if (!hId) return false;

  const currentTail = nodes.find(n => n.id === tId);
  if (!currentTail) return false;

  const isOnly = hId === tId;
  let javaOps, pyOps, cppOps;

  if (isOnly) {
    javaOps = [`Node deleted = tail;`, `head = null;`, `tail = null;`, `deleted.next = null;`, `deleted.prev = null;`];
    pyOps = [`deleted = tail`, `head = None`, `tail = None`, `deleted.next = None`, `deleted.prev = None`];
    cppOps = [`Node* deleted = tail;`, `head = nullptr;`, `tail = nullptr;`, `deleted->next = nullptr;`, `deleted->prev = nullptr;`];
    dclHeadId.set(null);
    dclTailId.set(null);
  } else {
    // Doubly-linked — the predecessor of tail is one hop back along `prev`,
    // no walk from head needed (that's the whole point of the extra pointer).
    const newTailId = currentTail.prevId;

    javaOps = [
      `Node deleted = tail;`,
      `tail = tail.prev;`,
      `tail.next = head;`,
      `head.prev = tail;`,
      `deleted.next = null;`,
      `deleted.prev = null;`,
    ];
    pyOps = [
      `deleted = tail`,
      `tail = tail.prev`,
      `tail.next = head`,
      `head.prev = tail`,
      `deleted.next = None`,
      `deleted.prev = None`,
    ];
    cppOps = [
      `Node* deleted = tail;`,
      `tail = tail->prev;`,
      `tail->next = head;`,
      `head->prev = tail;`,
      `deleted->next = nullptr;`,
      `deleted->prev = nullptr;`,
    ];

    dclNodes.update(ns => ns.map(n => {
      if (n.id === newTailId) return { ...n, nextId: hId };
      if (n.id === hId) return { ...n, prevId: newTailId };
      return n;
    }));
    dclTailId.set(newTailId);
  }

  logOpDCL(javaOps, pyOps, cppOps);
  return true;
}

/**
 * Generates the classic do-while ring-traversal code and returns the
 * forward visiting order (node ids) for the canvas to animate through.
 * @returns {string[]}
 */
export function traverseDCL() {
  const hId = get(dclHeadId);
  if (!hId) return [];

  const javaOps = [
    `Node curr = head;`,
    `do {`,
    `    System.out.print(curr.data + " ");`,
    `    curr = curr.next;`,
    `} while (curr != head);`,
  ];
  const pyOps = [
    `curr = head`,
    `while True:`,
    `    print(curr.data, end=' ')`,
    `    curr = curr.next`,
    `    if curr == head:`,
    `        break`,
  ];
  const cppOps = [
    `Node* curr = head;`,
    `do {`,
    `    std::cout << curr->data << " ";`,
    `    curr = curr->next;`,
    `} while (curr != head);`,
  ];

  logOpDCL(javaOps, pyOps, cppOps);
  return walkRing(get(dclNodes), hId).map(n => n.id);
}

/**
 * Backwards counterpart of {@link traverseDCL}: walks from the tail along
 * `prev` all the way around the ring — only possible because every node
 * carries a back-pointer.
 * @returns {string[]}
 */
export function traverseBackwardDCL() {
  const tId = get(dclTailId);
  if (!tId) return [];

  const javaOps = [
    `Node curr = tail;`,
    `do {`,
    `    System.out.print(curr.data + " ");`,
    `    curr = curr.prev;`,
    `} while (curr != tail);`,
  ];
  const pyOps = [
    `curr = tail`,
    `while True:`,
    `    print(curr.data, end=' ')`,
    `    curr = curr.prev`,
    `    if curr == tail:`,
    `        break`,
  ];
  const cppOps = [
    `Node* curr = tail;`,
    `do {`,
    `    std::cout << curr->data << " ";`,
    `    curr = curr->prev;`,
    `} while (curr != tail);`,
  ];

  logOpDCL(javaOps, pyOps, cppOps);
  return walkRingReverse(get(dclNodes), tId).map(n => n.id);
}

export function garbageCollectDCL() {
  const nodes = get(dclNodes);
  const hId = get(dclHeadId);
  const ringIds = reachableRingIds(nodes, hId);
  const toRemove = nodes.filter(n => !ringIds.has(n.id));

  if (toRemove.length === 0) {
    logOpDCL(
      ['// GC: no unreachable nodes found'],
      ['# GC: no unreachable nodes found'],
      ['// GC: no unreachable nodes found']
    );
    return;
  }

  const javaOps = toRemove.map(n => `// GC: ${n.varName} collected`);
  const pyOps = toRemove.map(n => `# GC: ${n.varName} collected`);
  const cppOps = toRemove.map(n => `// GC: delete ${n.varName};`);
  logOpDCL(javaOps, pyOps, cppOps);

  dclNodes.update(ns => ns.filter(n => ringIds.has(n.id)));
}

export function clearDCL() {
  dclNodes.set([]);
  dclHeadId.set(null);
  dclTailId.set(null);
  nodeCounter = 0;
  clearLogDCL();
  initNodeClassDCL();
}

export function getSnapshotDCL() {
  return {
    nodes: cloneStoreValue(dclNodes),
    headId: get(dclHeadId),
    tailId: get(dclTailId),
    counter: nodeCounter,
    codeLog: cloneStoreValue(dclLog),
    _type: 'doubly-circular-list',
  };
}

/**
 * @param {ReturnType<typeof getSnapshotDCL>} snapshot
 */
export function applySnapshotDCL(snapshot) {
  nodeCounter = snapshot.counter ?? 0;
  dclNodes.set(snapshot.nodes ?? []);
  dclHeadId.set(snapshot.headId ?? null);
  dclTailId.set(snapshot.tailId ?? null);
  dclLog.set(snapshot.codeLog ?? []);
}
