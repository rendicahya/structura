/**
 * @typedef {{ id: string, varName: string, data: string, x: number, y: number, nextId: string|null }} SLLNode
 */

/**
 * @typedef {{ nodes: SLLNode[], edges: {from: string, to: string}[], headId: string|null, tailId: string|null, walkId: string|null, counter: number, codeLog: any[] }} SLLSnapshot
 */

import { writable, get, derived } from 'svelte/store';
import { logOp, codeLog } from './sllLog.js';
import { formatValue, formatPythonValue } from '../../utils/formatters.js';

/** @type {import('svelte/store').Writable<SLLNode[]>} */
export const nodes = writable([]);

/** @type {import('svelte/store').Writable<{from: string, to: string}[]>} */
export const edges = writable([]);

/** @type {import('svelte/store').Writable<string|null>} */
export const headId = writable(null);

/** @type {import('svelte/store').Writable<string|null>} */
export const tailId = writable(null);

/** @type {import('svelte/store').Writable<string|null>} */
export const walkId = writable(null);

let nodeCounter = 0;

export function initNodeClass() {
    logOp(
        `class Node {\n    String data;\n    Node next;\n}`,
        `class Node:\n    def __init__(self):\n        self.data = None\n        self.next = None`,
        `struct Node {\n    std::string data;\n    Node* next;\n    Node() : next(nullptr) {}\n};`
    );
}

export function createNode(x = 200, y = 200) {
    const id = `node_${++nodeCounter}`;
    const varName = `node${nodeCounter}`;

    const ns = get(nodes);
    if (ns.length > 0) {
        const last = ns[ns.length - 1];
        x = last.x + 180; // NODE_W (130) + gap (50)
        y = last.y;
    }

    return { id, varName, data: '', x, y, nextId: null };
}

/**
 * @param {SLLNode} node
 * @param {boolean} [silent]
 */
export function addNode(node, silent = false) {
    nodes.update(ns => [...ns, node]);
    if (!silent) logOp(
        `Node ${node.varName} = new Node();`,
        `${node.varName} = Node()`,
        `Node* ${node.varName} = new Node();`
    );
}

/**
 * @param {string|null} nodeId
 */
export function setWalk(nodeId) {
    walkId.set(nodeId);
    const ns = get(nodes);
    const node = ns.find(n => n.id === nodeId);
    if (node) logOp(
        `Node walk = ${node.varName};`,
        `walk = ${node.varName}`,
        `Node* walk = ${node.varName};`
    );
    else logOp(`// walk unset`, `# walk unset`, `// walk unset`);
}

/**
 * @param {string} nodeId
 */
export function removeNodeFromList(nodeId) {
    const ns = get(nodes);
    const predecessor = ns.find(n => n.nextId === nodeId);
    const target = ns.find(n => n.id === nodeId);
    if (!target) return;

    const javaOps = [];
    const pyOps = [];
    const cppOps = [];

    if (predecessor && target.nextId) {
        const successor = ns.find(n => n.id === target.nextId);
        connectNodes(predecessor.id, target.nextId, true);
        javaOps.push(`${predecessor.varName}.next = ${successor?.varName};`);
        javaOps.push(`${target.varName}.next = null;`);
        pyOps.push(`${predecessor.varName}.next = ${successor?.varName}`);
        pyOps.push(`${target.varName}.next = None`);
        cppOps.push(`${predecessor.varName}->next = ${successor?.varName};`);
        cppOps.push(`${target.varName}->next = nullptr;`);
    } else if (predecessor && !target.nextId) {
        disconnectNode(predecessor.id, true);
        javaOps.push(`${predecessor.varName}.next = null;`);
        pyOps.push(`${predecessor.varName}.next = None`);
        cppOps.push(`${predecessor.varName}->next = nullptr;`);
    }

    edges.update(es => es.filter(e => e.from !== nodeId));
    nodes.update(ns => ns.map(n => n.id === nodeId ? { ...n, nextId: null } : n));
    headId.update(id => id === nodeId ? null : id);
    tailId.update(id => id === nodeId ? null : id);
    walkId.update(id => id === nodeId ? null : id);

    if (javaOps.length > 0) logOp(javaOps, pyOps, cppOps);
}

/**
 * @param {string} nodeId
 * @param {Partial<SLLNode>} patch
 * @param {boolean} [silent]
 */
export function updateNode(nodeId, patch, silent = false) {
    const ns = get(nodes);
    const old = ns.find(n => n.id === nodeId);
    nodes.update(ns => ns.map(n => n.id === nodeId ? { ...n, ...patch } : n));

    if (!silent && old) {
        if (patch.varName !== undefined) {
            logOp(
                `// renamed: ${old.varName} → ${patch.varName}`,
                `# renamed: ${old.varName} → ${patch.varName}`,
                `// renamed: ${old.varName} → ${patch.varName}`
            );
        }
        if (patch.data !== undefined && patch.data !== old.data) {
            const updated = get(nodes).find(n => n.id === nodeId);
            if (!updated) return;
            const val = formatValue(patch.data);
            const pyVal = formatPythonValue(patch.data);
            const cppVal = formatCppValue(patch.data);
            logOp(
                `${updated.varName}.data = ${val};`,
                `${updated.varName}.data = ${pyVal}`,
                `${updated.varName}->data = ${cppVal};`
            );
        }
    }
}

/**
 * @param {string} fromId
 * @param {string} toId
 * @param {boolean} [silent]
 */
export function connectNodes(fromId, toId, silent = false) {
    edges.update(es => es.filter(e => e.from !== fromId));
    nodes.update(ns => ns.map(n => n.id === fromId ? { ...n, nextId: toId } : n));
    edges.update(es => [...es, { from: fromId, to: toId }]);

    if (!silent) {
        const ns = get(nodes);
        const from = ns.find(n => n.id === fromId);
        const to = ns.find(n => n.id === toId);
        if (from && to) logOp(
            `${from.varName}.next = ${to.varName};`,
            `${from.varName}.next = ${to.varName}`,
            `${from.varName}->next = ${to.varName};`
        );
    }
}

/**
 * @param {string} nodeId
 * @param {boolean} [silent]
 */
export function disconnectNode(nodeId, silent = false) {
    const ns = get(nodes);
    const node = ns.find(n => n.id === nodeId);
    edges.update(es => es.filter(e => e.from !== nodeId));
    nodes.update(ns => ns.map(n => n.id === nodeId ? { ...n, nextId: null } : n));
    if (!silent && node) logOp(
        `${node.varName}.next = null;`,
        `${node.varName}.next = None`,
        `${node.varName}->next = nullptr;`
    );
}

/**
 * @param {string|null} nodeId
 */
export function setHead(nodeId) {
    headId.set(nodeId);
    const ns = get(nodes);
    const node = ns.find(n => n.id === nodeId);
    if (node) logOp(
        `Node head = ${node.varName};`,
        `head = ${node.varName}`,
        `Node* head = ${node.varName};`
    );
    else logOp(`// head unset`, `# head unset`, `// head unset`);
}

/**
 * @param {string|null} nodeId
 */
export function setTail(nodeId) {
    tailId.set(nodeId);
    const ns = get(nodes);
    const node = ns.find(n => n.id === nodeId);
    if (node) logOp(
        `Node tail = ${node.varName};`,
        `tail = ${node.varName}`,
        `Node* tail = ${node.varName};`
    );
    else logOp(`// tail unset`, `# tail unset`, `// tail unset`);
}

export function garbageCollect() {
    const ns = get(nodes);
    const hId = get(headId);
    const tId = get(tailId);
    const wId = get(walkId);
    const reachable = new Set();

    ns.forEach(n => { if (n.nextId) { reachable.add(n.nextId); reachable.add(n.id); } });
    if (hId) reachable.add(hId);
    if (tId) reachable.add(tId);
    if (wId) reachable.add(wId);

    const toRemove = ns.filter(n => !reachable.has(n.id));

    if (toRemove.length === 0) {
        logOp(
            '// GC: no unreachable nodes found',
            '# GC: no unreachable nodes found',
            '// GC: no unreachable nodes found'
        );
        return;
    }

    const javaOps = toRemove.map(n => `// GC: ${n.varName} collected`);
    const pyOps = toRemove.map(n => `# GC: ${n.varName} collected`);
    const cppOps = toRemove.map(n => `// GC: delete ${n.varName};`);
    logOp(javaOps, pyOps, cppOps);

    nodes.update(ns => ns.filter(n => reachable.has(n.id)));
    edges.update(es => es.filter(e => reachable.has(e.from) && reachable.has(e.to)));
}

export const unreachableCount = derived(
    [nodes, edges, headId, tailId, walkId],
    ([$nodes, $edges, $headId, $tailId, $walkId]) => {
        const reachable = new Set();
        $nodes.forEach(n => { if (n.nextId) { reachable.add(n.nextId); reachable.add(n.id); } });
        if ($headId) reachable.add($headId);
        if ($tailId) reachable.add($tailId);
        if ($walkId) reachable.add($walkId);
        return $nodes.filter(n => !reachable.has(n.id)).length;
    }
);

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

/**
 * @param {SLLSnapshot} snapshot
 */
export function applySnapshot(snapshot) {
    nodeCounter = snapshot.counter ?? 0;
    nodes.set(snapshot.nodes ?? []);
    edges.set(snapshot.edges ?? []);
    headId.set(snapshot.headId ?? null);
    tailId.set(snapshot.tailId ?? null);
    walkId.set(snapshot.walkId ?? null);
    codeLog.set(snapshot.codeLog ?? []);
}