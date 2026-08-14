import { writable, get, derived } from 'svelte/store';
import { logOpBST, bstLog } from '../shared/bstLog.js';
import { cloneStoreValue } from '../../utils/storeSnapshot.js';
import { compareValues } from './treeTraversal.js';

/**
 * @typedef {{ id: string, varName: string, data: string, parentId: string|null, left: string|null, right: string|null, x: number, y: number }} BSTNode
 */

/** @type {import('svelte/store').Writable<BSTNode[]>} */
export const bstNodes = writable([]);

/** @type {import('svelte/store').Writable<string|null>} */
export const bstRootId = writable(null);

let nodeCounter = 0;

const NODE_W = 70;
const NODE_H = 70;
const LEVEL_H = 110;
const MIN_GAP = 20;

export const bstIsEmpty = derived(
    bstNodes,
    ($nodes) => $nodes.length === 0
);

/**
 * Reingold-Tilford-like layout — ordering-agnostic, lays out whatever
 * left/right pointers exist regardless of how they got there.
 * @param {BSTNode[]} nodes
 * @param {string|null} rootId
 */
function layoutBST(nodes, rootId) {
    if (!rootId || nodes.length === 0) return nodes;

    /** @type {Map<string, BSTNode>} */
    const nodeMap = new Map(nodes.map(n => [n.id, { ...n }]));

    /** @type {Map<string, number>} */
    const xPos = new Map();
    let counter = 0;

    function assignX(nodeId) {
        if (!nodeId) return;
        const node = nodeMap.get(nodeId);
        if (!node) return;

        if (node.left) assignX(node.left);
        xPos.set(nodeId, counter++);
        if (node.right) assignX(node.right);
    }

    assignX(rootId);

    /** @type {Map<string, number>} */
    const depth = new Map();

    function assignDepth(nodeId, d) {
        if (!nodeId) return;
        depth.set(nodeId, d);
        const node = nodeMap.get(nodeId);
        if (!node) return;
        if (node.left) assignDepth(node.left, d + 1);
        if (node.right) assignDepth(node.right, d + 1);
    }

    assignDepth(rootId, 0);

    return nodes.map(n => {
        if (xPos.has(n.id)) {
            return {
                ...n,
                x: xPos.get(n.id) * (NODE_W + MIN_GAP),
                y: (depth.get(n.id) ?? 0) * LEVEL_H,
            };
        }
        return n;
    });
}

export function initBST() {
    logOpBST(
        `class Node {\n    String data;\n    Node left;\n    Node right;\n}`,
        `class Node:\n    def __init__(self, data=None):\n        self.data = data\n        self.left = None\n        self.right = None`,
        `struct Node {\n    std::string data;\n    Node* left;\n    Node* right;\n    Node() : left(nullptr), right(nullptr) {}\n};`
    );
}

/**
 * Value-driven insert: walks from the root comparing `value` against each
 * node's data (same left-if-less/right-if-greater convention as
 * computeSearchPath, so the logged insert trail always agrees with what
 * Search will later highlight), then creates the node at the first empty
 * slot found. Duplicate values are rejected outright rather than routed to
 * a side, so no two nodes ever show the same value.
 * @param {string} value
 * @returns {boolean} true if inserted, false if empty/duplicate
 */
export function insertBST(value) {
    const trimmed = (value ?? '').trim();
    if (trimmed === '') return false;

    const nodes = get(bstNodes);
    const root = get(bstRootId);

    if (!root) {
        const id = `bst_${++nodeCounter}`;
        const varName = `node${nodeCounter}`;
        /** @type {BSTNode} */
        const newNode = { id, varName, data: trimmed, parentId: null, left: null, right: null, x: 0, y: 0 };

        bstNodes.update(ns => layoutBST([...ns, newNode], id));
        bstRootId.set(id);

        logOpBST(
            [`Node ${varName} = new Node();`, `root = ${varName};`],
            [`${varName} = Node()`, `root = ${varName}`],
            [`Node* ${varName} = new Node();`, `root = ${varName};`]
        );
        return true;
    }

    let currentId = root;
    let parentId = null;
    let side = null;
    const javaOps = [];
    const pyOps = [];
    const cppOps = [];

    while (currentId) {
        const node = nodes.find(n => n.id === currentId);
        if (!node) break;

        const cmp = compareValues(trimmed, node.data);
        if (cmp === 0) return false;

        const dir = cmp < 0 ? 'left' : 'right';
        const op = cmp < 0 ? '<' : '>';
        javaOps.push(`// compare "${trimmed}" ${op} ${node.varName}.data ("${node.data}") -> go ${dir}`);
        pyOps.push(`# compare "${trimmed}" ${op} ${node.varName}.data ("${node.data}") -> go ${dir}`);
        cppOps.push(`// compare "${trimmed}" ${op} ${node.varName}.data ("${node.data}") -> go ${dir}`);

        parentId = currentId;
        side = dir;
        currentId = dir === 'left' ? node.left : node.right;
    }

    const id = `bst_${++nodeCounter}`;
    const varName = `node${nodeCounter}`;
    const parent = nodes.find(n => n.id === parentId);
    /** @type {BSTNode} */
    const newNode = { id, varName, data: trimmed, parentId, left: null, right: null, x: 0, y: 0 };

    bstNodes.update(ns => {
        let updated = [...ns, newNode];
        updated = updated.map(n => n.id === parentId ? { ...n, [side]: id } : n);
        return layoutBST(updated, get(bstRootId));
    });

    javaOps.push(`Node ${varName} = new Node();`);
    pyOps.push(`${varName} = Node()`);
    cppOps.push(`Node* ${varName} = new Node();`);
    if (parent) {
        javaOps.push(`${parent.varName}.${side} = ${varName};`);
        pyOps.push(`${parent.varName}.${side} = ${varName}`);
        cppOps.push(`${parent.varName}->${side} = ${varName};`);
    }

    logOpBST(javaOps, pyOps, cppOps);
    return true;
}

/**
 * Standard 3-case BST delete. Unlike the generic Tree page's remove (which
 * only detaches and leaves the subtree "unreachable pending GC"), a BST
 * must stay a fully-linked valid tree at every step, so nodes are removed
 * from `bstNodes` immediately.
 * @param {string} nodeId
 */
export function deleteBSTNode(nodeId) {
    const nodes = get(bstNodes);
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    // Case 3: two children — copy in-order successor's value up, then
    // recursively delete the successor (now a leaf or one-child case).
    if (node.left && node.right) {
        let succId = node.right;
        let succNode = nodes.find(n => n.id === succId);
        while (succNode && succNode.left) {
            succId = succNode.left;
            succNode = nodes.find(n => n.id === succId);
        }
        if (!succNode) return;

        logOpBST(
            `${node.varName}.data = ${succNode.varName}.data;`,
            `${node.varName}.data = ${succNode.varName}.data`,
            `${node.varName}->data = ${succNode.varName}->data;`
        );

        bstNodes.update(ns => ns.map(n => n.id === node.id ? { ...n, data: succNode.data } : n));

        deleteBSTNode(succId);
        return;
    }

    const parent = nodes.find(n => n.id === node.parentId);
    const javaOps = [];
    const pyOps = [];
    const cppOps = [];

    // Case 2: exactly one child — splice it into node's old slot.
    if (node.left || node.right) {
        const childId = node.left ?? node.right;
        const childNode = nodes.find(n => n.id === childId);

        if (parent) {
            const side = parent.left === node.id ? 'left' : 'right';
            javaOps.push(`${parent.varName}.${side} = ${childNode.varName};`);
            pyOps.push(`${parent.varName}.${side} = ${childNode.varName}`);
            cppOps.push(`${parent.varName}->${side} = ${childNode.varName};`);
        } else {
            javaOps.push(`root = ${childNode.varName};`);
            pyOps.push(`root = ${childNode.varName}`);
            cppOps.push(`root = ${childNode.varName};`);
            bstRootId.set(childId);
        }

        bstNodes.update(ns => {
            const updated = ns
                .filter(n => n.id !== node.id)
                .map(n => {
                    if (parent && n.id === parent.id) {
                        const side = parent.left === node.id ? 'left' : 'right';
                        return { ...n, [side]: childId };
                    }
                    if (n.id === childId) {
                        return { ...n, parentId: parent ? parent.id : null };
                    }
                    return n;
                });
            return layoutBST(updated, get(bstRootId));
        });

        logOpBST(javaOps, pyOps, cppOps);
        return;
    }

    // Case 1: leaf — just detach and remove.
    if (parent) {
        const side = parent.left === node.id ? 'left' : 'right';
        javaOps.push(`${parent.varName}.${side} = null;`);
        pyOps.push(`${parent.varName}.${side} = None`);
        cppOps.push(`${parent.varName}->${side} = nullptr;`);
    } else {
        javaOps.push(`root = null;`);
        pyOps.push(`root = None`);
        cppOps.push(`root = nullptr;`);
        bstRootId.set(null);
    }

    bstNodes.update(ns => {
        const updated = ns
            .filter(n => n.id !== node.id)
            .map(n => {
                if (parent && n.id === parent.id) {
                    const side = parent.left === node.id ? 'left' : 'right';
                    return { ...n, [side]: null };
                }
                return n;
            });
        return layoutBST(updated, get(bstRootId));
    });

    logOpBST(javaOps, pyOps, cppOps);
}

/**
 * Defensive safety net — normal insert/delete never leaves unreachable
 * nodes, but kept for parity with the Tree page and to recover from bugs.
 */
export function garbageCollectBST() {
    const ns = get(bstNodes);
    const root = get(bstRootId);

    const reachable = new Set();
    function traverse(nodeId) {
        if (!nodeId) return;
        reachable.add(nodeId);
        const node = ns.find(n => n.id === nodeId);
        if (!node) return;
        traverse(node.left);
        traverse(node.right);
    }
    traverse(root);

    const toRemove = ns.filter(n => !reachable.has(n.id));

    if (toRemove.length === 0) {
        logOpBST(
            ['// GC: no unreachable nodes found'],
            ['# GC: no unreachable nodes found'],
            ['// GC: no unreachable nodes found']
        );
        return;
    }

    const javaOps = toRemove.map(n => `// GC: ${n.varName} collected`);
    const pyOps = toRemove.map(n => `# GC: ${n.varName} collected`);
    const cppOps = toRemove.map(n => `// GC: delete ${n.varName};`);
    logOpBST(javaOps, pyOps, cppOps);

    bstNodes.update(ns => ns.filter(n => reachable.has(n.id)));
}

export function clearBST() {
    bstNodes.set([]);
    bstRootId.set(null);
    nodeCounter = 0;
}

export function resetBST() {
    bstNodes.set([]);
    bstRootId.set(null);
    nodeCounter = 0;
}

export function getSnapshotBST() {
    return {
        nodes: cloneStoreValue(bstNodes),
        rootId: get(bstRootId),
        counter: nodeCounter,
        codeLog: cloneStoreValue(bstLog),
        _type: 'bst',
    };
}

/**
 * @param {ReturnType<typeof getSnapshotBST>} snapshot
 */
export function applySnapshotBST(snapshot) {
    nodeCounter = snapshot.counter ?? 0;
    bstNodes.set(snapshot.nodes ?? []);
    bstRootId.set(snapshot.rootId ?? null);
    bstLog.set(snapshot.codeLog ?? []);
}
