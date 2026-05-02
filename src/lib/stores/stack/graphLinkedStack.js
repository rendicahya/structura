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

    logOpLinkedStack(
        [`Node ${varName} = new Node(${formatVal(value)});`, `${varName}.next = top;`, `top = ${varName};`],
        [`${varName} = Node(${formatPyVal(value)})`, `${varName}.next = top`, `top = ${varName}`],
        [`Node* ${varName} = new Node(${formatVal(value)});`, `${varName}->next = top;`, `top = ${varName};`]
    );

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

    linkedStackNodes.update(ns => {
        const updated = [...ns];
        updated[0] = { ...updated[0], nextId: null };
        return updated.slice(1).concat({ ...popped, nextId: null });
    });

    logOpLinkedStack(
        [`Node popped = top;`, `top = top.next;`, `popped.next = null;`],
        [`popped = top`, `top = top.next`, `popped.next = None`],
        [`Node* popped = top;`, `top = top->next;`, `popped->next = nullptr;`]
    );

    return false;
}

export function peekLinkedStack() {
    const nodes = get(linkedStackNodes);

    if (nodes.length === 0) return false;

    const top = nodes[0];

    logOpLinkedStack(
        [`Node peeked = top; // peek → ${top.data}`],
        [`peeked = top  # peek → ${top.data}`],
        [`Node* peeked = top; // peek → ${top.data}`]
    );

    return true;
}

export function garbageCollectLinkedStack() {
    const nodes = get(linkedStackNodes);
    const reachable = new Set();

    const stackNodes = nodes.filter((_, i) => {
        return true;
    });

    const allNodes = get(linkedStackNodes);
    const inStack = new Set();

    allNodes.forEach(n => {
        if (n.nextId) inStack.add(n.nextId);
    });

    const pointed = new Set(allNodes.map(n => n.nextId).filter(Boolean));
    const tops = allNodes.filter(n => !pointed.has(n.id));

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
    const pyOps = toRemove.map(n => `# GC: ${n.varName} collected`);
    const cppOps = toRemove.map(n => `// GC: delete ${n.varName};`);

    logOpLinkedStack(javaOps, pyOps, cppOps);
    logOpLinkedStack(
        ['// GC: no unreachable nodes found'],
        ['# GC: no unreachable nodes found'],
        ['// GC: no unreachable nodes found']
    );
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