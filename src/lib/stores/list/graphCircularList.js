import { writable, get, derived } from 'svelte/store';
import { logOpCircularList, circularListLog, clearLogCircularList } from '../shared/circularListLog.js';
import { formatLiteral, formatPythonLiteral } from '../../utils/formatters.js';
import { walkRing, reachableRingIds } from '../../utils/linkedList.js';
import { cloneStoreValue } from '../../utils/storeSnapshot.js';

/**
 * @typedef {{ id: string, varName: string, data: string, nextId: string|null }} CircularListNode
 */

/** @type {import('svelte/store').Writable<CircularListNode[]>} */
export const circularListNodes = writable([]);
export const headId = writable(null);
export const tailId = writable(null);

let nodeCounter = 0;

export const circularListIsEmpty = derived(
  headId,
  ($headId) => !$headId
);

export const headNode = derived(
  [circularListNodes, headId],
  ([$nodes, $headId]) => $nodes.find(n => n.id === $headId) || null
);

export const tailNode = derived(
  [circularListNodes, tailId],
  ([$nodes, $tailId]) => $nodes.find(n => n.id === $tailId) || null
);

export const listRing = derived(
  [circularListNodes, headId],
  ([$nodes, $headId]) => walkRing($nodes, $headId)
);

export const unreachableListNodes = derived(
  [circularListNodes, headId],
  ([$nodes, $headId]) => {
    const ringIds = reachableRingIds($nodes, $headId);
    return $nodes.filter(n => !ringIds.has(n.id));
  }
);

export function initNodeClassCircularList() {
  logOpCircularList(
    `class Node {\n    String data;\n    Node next;\n}`,
    `class Node:\n    def __init__(self):\n        self.data = None\n        self.next = None`,
    `struct Node {\n    std::string data;\n    Node* next;\n    Node() : next(nullptr) {}\n};`
  );
}

/**
 * @param {string} value
 */
export function insertHeadCircular(value) {
  const id = `cl_${++nodeCounter}`;
  const varName = `node${nodeCounter}`;
  const hId = get(headId);
  const tId = get(tailId);

  /** @type {CircularListNode} */
  const newNode = { id, varName, data: value, nextId: hId || id };
  circularListNodes.update(ns => [...ns, newNode]);

  const javaOps = [`Node ${varName} = new Node(${formatLiteral(value)});`];
  const pyOps = [`${varName} = Node(${formatPythonLiteral(value)})`];
  const cppOps = [`Node* ${varName} = new Node(${formatLiteral(value)});`];

  if (!hId) {
    // First node — the ring is just itself, pointing back to itself.
    headId.set(id);
    tailId.set(id);
    javaOps.push(`${varName}.next = ${varName};`, `head = ${varName};`, `tail = ${varName};`);
    pyOps.push(`${varName}.next = ${varName}`, `head = ${varName}`, `tail = ${varName}`);
    cppOps.push(`${varName}->next = ${varName};`, `head = ${varName};`, `tail = ${varName};`);
  } else {
    javaOps.push(`${varName}.next = head;`, `head = ${varName};`, `tail.next = head;`);
    pyOps.push(`${varName}.next = head`, `head = ${varName}`, `tail.next = head`);
    cppOps.push(`${varName}->next = head;`, `head = ${varName};`, `tail->next = head;`);
    headId.set(id);
    circularListNodes.update(ns => ns.map(n =>
      n.id === tId ? { ...n, nextId: id } : n
    ));
  }

  logOpCircularList(javaOps, pyOps, cppOps);
  return true;
}

/**
 * @param {string} value
 */
export function insertTailCircular(value) {
  const id = `cl_${++nodeCounter}`;
  const varName = `node${nodeCounter}`;
  const hId = get(headId);
  const tId = get(tailId);

  /** @type {CircularListNode} */
  const newNode = { id, varName, data: value, nextId: hId || id };
  circularListNodes.update(ns => [...ns, newNode]);

  const javaOps = [`Node ${varName} = new Node(${formatLiteral(value)});`];
  const pyOps = [`${varName} = Node(${formatPythonLiteral(value)})`];
  const cppOps = [`Node* ${varName} = new Node(${formatLiteral(value)});`];

  if (!hId) {
    headId.set(id);
    tailId.set(id);
    javaOps.push(`${varName}.next = ${varName};`, `head = ${varName};`, `tail = ${varName};`);
    pyOps.push(`${varName}.next = ${varName}`, `head = ${varName}`, `tail = ${varName}`);
    cppOps.push(`${varName}->next = ${varName};`, `head = ${varName};`, `tail = ${varName};`);
  } else {
    javaOps.push(`${varName}.next = head;`, `tail.next = ${varName};`, `tail = ${varName};`);
    pyOps.push(`${varName}.next = head`, `tail.next = ${varName}`, `tail = ${varName}`);
    cppOps.push(`${varName}->next = head;`, `tail->next = ${varName};`, `tail = ${varName};`);
    circularListNodes.update(ns => ns.map(n =>
      n.id === tId ? { ...n, nextId: id } : n
    ));
    tailId.set(id);
  }

  logOpCircularList(javaOps, pyOps, cppOps);
  return true;
}

export function deleteHeadCircular() {
  const nodes = get(circularListNodes);
  const hId = get(headId);
  const tId = get(tailId);
  if (!hId) return false;

  const currentHead = nodes.find(n => n.id === hId);
  if (!currentHead) return false;

  const isOnly = hId === tId;

  let javaOps, pyOps, cppOps;

  if (isOnly) {
    javaOps = [`Node deleted = head;`, `head = null;`, `tail = null;`, `deleted.next = null;`];
    pyOps = [`deleted = head`, `head = None`, `tail = None`, `deleted.next = None`];
    cppOps = [`Node* deleted = head;`, `head = nullptr;`, `tail = nullptr;`, `deleted->next = nullptr;`];
    headId.set(null);
    tailId.set(null);
  } else {
    const newHeadId = currentHead.nextId;
    javaOps = [`Node deleted = head;`, `head = head.next;`, `tail.next = head;`, `deleted.next = null;`];
    pyOps = [`deleted = head`, `head = head.next`, `tail.next = head`, `deleted.next = None`];
    cppOps = [`Node* deleted = head;`, `head = head->next;`, `tail->next = head;`, `deleted->next = nullptr;`];
    headId.set(newHeadId);
    circularListNodes.update(ns => ns.map(n =>
      n.id === tId ? { ...n, nextId: newHeadId } : n
    ));
  }

  logOpCircularList(javaOps, pyOps, cppOps);
  return true;
}

export function deleteTailCircular() {
  const nodes = get(circularListNodes);
  const hId = get(headId);
  const tId = get(tailId);
  if (!hId) return false;

  const isOnly = hId === tId;
  let javaOps, pyOps, cppOps;

  if (isOnly) {
    javaOps = [`Node deleted = tail;`, `head = null;`, `tail = null;`, `deleted.next = null;`];
    pyOps = [`deleted = tail`, `head = None`, `tail = None`, `deleted.next = None`];
    cppOps = [`Node* deleted = tail;`, `head = nullptr;`, `tail = nullptr;`, `deleted->next = nullptr;`];
    headId.set(null);
    tailId.set(null);
  } else {
    // Singly-linked — no prev pointer, so walk from head to find the node
    // just before tail (the one whose next needs to become the new tail's
    // successor, i.e. head).
    let prev = nodes.find(n => n.id === hId);
    while (prev && prev.nextId !== tId) {
      prev = nodes.find(n => n.id === prev.nextId);
    }
    if (!prev) return false;
    const newTailId = prev.id;

    javaOps = [
      `Node curr = head;`,
      `while (curr.next != tail) {`,
      `    curr = curr.next;`,
      `}`,
      `Node deleted = tail;`,
      `curr.next = head;`,
      `tail = curr;`,
      `deleted.next = null;`,
    ];
    pyOps = [
      `curr = head`,
      `while curr.next != tail:`,
      `    curr = curr.next`,
      `deleted = tail`,
      `curr.next = head`,
      `tail = curr`,
      `deleted.next = None`,
    ];
    cppOps = [
      `Node* curr = head;`,
      `while (curr->next != tail) {`,
      `    curr = curr->next;`,
      `}`,
      `Node* deleted = tail;`,
      `curr->next = head;`,
      `tail = curr;`,
      `deleted->next = nullptr;`,
    ];

    circularListNodes.update(ns => ns.map(n =>
      n.id === newTailId ? { ...n, nextId: hId } : n
    ));
    tailId.set(newTailId);
  }

  logOpCircularList(javaOps, pyOps, cppOps);
  return true;
}

/**
 * Generates the classic do-while ring-traversal code and returns the
 * visiting order (node ids) for the canvas to animate through.
 * @returns {string[]}
 */
export function traverseCircular() {
  const hId = get(headId);
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

  logOpCircularList(javaOps, pyOps, cppOps);
  return walkRing(get(circularListNodes), hId).map(n => n.id);
}

export function garbageCollectCircularList() {
  const nodes = get(circularListNodes);
  const hId = get(headId);
  const ringIds = reachableRingIds(nodes, hId);
  const toRemove = nodes.filter(n => !ringIds.has(n.id));

  if (toRemove.length === 0) {
    logOpCircularList(
      ['// GC: no unreachable nodes found'],
      ['# GC: no unreachable nodes found'],
      ['// GC: no unreachable nodes found']
    );
    return;
  }

  const javaOps = toRemove.map(n => `// GC: ${n.varName} collected`);
  const pyOps = toRemove.map(n => `# GC: ${n.varName} collected`);
  const cppOps = toRemove.map(n => `// GC: delete ${n.varName};`);
  logOpCircularList(javaOps, pyOps, cppOps);

  circularListNodes.update(ns => ns.filter(n => ringIds.has(n.id)));
}

export function clearCircularList() {
  circularListNodes.set([]);
  headId.set(null);
  tailId.set(null);
  nodeCounter = 0;
  clearLogCircularList();
  initNodeClassCircularList();
}

export function getSnapshotCircularList() {
  return {
    nodes: cloneStoreValue(circularListNodes),
    headId: get(headId),
    tailId: get(tailId),
    counter: nodeCounter,
    codeLog: cloneStoreValue(circularListLog),
    _type: 'circular-list',
  };
}

/**
 * @param {ReturnType<typeof getSnapshotCircularList>} snapshot
 */
export function applySnapshotCircularList(snapshot) {
  nodeCounter = snapshot.counter ?? 0;
  circularListNodes.set(snapshot.nodes ?? []);
  headId.set(snapshot.headId ?? null);
  tailId.set(snapshot.tailId ?? null);
  circularListLog.set(snapshot.codeLog ?? []);
}
