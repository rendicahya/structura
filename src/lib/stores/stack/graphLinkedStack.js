import { writable, get, derived } from 'svelte/store';
import { logOpLinkedStack, linkedStackLog, clearLogLinkedStack } from '../shared/linkedStackLog.js';
import { formatLiteral, formatPythonLiteral } from '../../utils/formatters.js';
import { reachableIds } from '../../utils/linkedList.js';
import { cloneStoreValue } from '../../utils/storeSnapshot.js';

/**
 * @typedef {{ id: string, varName: string, data: string, nextId: string|null }} LinkedStackNode
 */

/** @type {import('svelte/store').Writable<LinkedStackNode[]>} */
export const linkedStackNodes = writable([]);

/** @type {import('svelte/store').Writable<string|null>} */
export const topId = writable(null);

let nodeCounter = 0;

/** @type {import('svelte/store').Readable<boolean>} */
export const linkedStackIsEmpty = derived(
    topId,
    ($topId) => $topId === null
);

export function initNodeClassLinkedStack() {
    logOpLinkedStack(
        `class Node {\n    String data;\n    Node next;\n}`,
        `class Node:\n    def __init__(self):\n        self.data = None\n        self.next = None`,
        `struct Node {\n    std::string data;\n    Node* next;\n    Node() : next(nullptr) {}\n};`
    );
}

/**
 * @param {string} value
 */
export function pushLinkedStack(value) {
    const id = `ls_${++nodeCounter}`;
    const varName = `node${nodeCounter}`;
    const currentTopId = get(topId);

    /** @type {LinkedStackNode} */
    const newNode = { id, varName, data: value, nextId: currentTopId };

    linkedStackNodes.update(ns => [...ns, newNode]);
    topId.set(id);

    logOpLinkedStack(
        [`Node ${varName} = new Node(${formatLiteral(value)});`, `${varName}.next = top;`, `top = ${varName};`],
        [`${varName} = Node(${formatPythonLiteral(value)})`, `${varName}.next = top`, `top = ${varName}`],
        [`Node* ${varName} = new Node(${formatLiteral(value)});`, `${varName}->next = top;`, `top = ${varName};`]
    );

    return true;
}

export function popLinkedStack() {
    const currentTopId = get(topId);
    if (!currentTopId) return false;

    const nodes = get(linkedStackNodes);
    const popped = nodes.find(n => n.id === currentTopId);
    if (!popped) return false;

    logOpLinkedStack(
        [`Node popped = top;`, `top = top.next;`, `popped.next = null;`],
        [`popped = top`, `top = top.next`, `popped.next = None`],
        [`Node* popped = top;`, `top = top->next;`, `popped->next = nullptr;`]
    );

    // Update top pointer to next node
    topId.set(popped.nextId);

    // Detach popped node from the stack (make it unreachable)
    linkedStackNodes.update(ns => {
        return ns.map(n => n.id === popped.id ? { ...n, nextId: null } : n);
    });

    return true;
}

export function peekLinkedStack() {
    const currentTopId = get(topId);
    if (!currentTopId) return false;

    const nodes = get(linkedStackNodes);
    const topNode = nodes.find(n => n.id === currentTopId);
    if (!topNode) return false;

    logOpLinkedStack(
        [`Node peeked = top; // peek → ${topNode.data}`],
        [`peeked = top  # peek → ${topNode.data}`],
        [`Node* peeked = top; // peek → ${topNode.data}`]
    );

    return true;
}

export function garbageCollectLinkedStack() {
    const allNodes = get(linkedStackNodes);
    const reachable = reachableIds(allNodes, get(topId));
    const toRemove = allNodes.filter(n => !reachable.has(n.id));

    if (toRemove.length === 0) {
        logOpLinkedStack(
            ['// GC: no unreachable nodes found'],
            ['# GC: no unreachable nodes found'],
            ['// GC: no unreachable nodes found']
        );
        return;
    }

    const javaOps = toRemove.map(n => `// GC: ${n.varName} collected`);
    const pyOps = toRemove.map(n => `# GC: ${n.varName} collected`);
    const cppOps = toRemove.map(n => `// GC: delete ${n.varName};`);

    logOpLinkedStack(javaOps, pyOps, cppOps);
    
    linkedStackNodes.set(allNodes.filter(n => reachable.has(n.id)));
}

export function clearLinkedStack() {
    linkedStackNodes.set([]);
    topId.set(null);
    nodeCounter = 0;
    clearLogLinkedStack();
    initNodeClassLinkedStack();
}

export function getSnapshotLinkedStack() {
    return {
        nodes: cloneStoreValue(linkedStackNodes),
        topId: get(topId),
        counter: nodeCounter,
        codeLog: cloneStoreValue(linkedStackLog),
        _type: 'linked-stack',
    };
}

/**
 * @param {ReturnType<typeof getSnapshotLinkedStack>} snapshot
 */
export function applySnapshotLinkedStack(snapshot) {
    nodeCounter = snapshot.counter ?? 0;
    linkedStackNodes.set(snapshot.nodes ?? []);
    topId.set(snapshot.topId ?? null);
    linkedStackLog.set(snapshot.codeLog ?? []);
}
