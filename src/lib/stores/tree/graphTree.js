import { writable, get, derived } from 'svelte/store';
import { logOpTree, treeLog } from '../shared/treeLog.js';

/**
 * @typedef {{ id: string, varName: string, data: string, parentId: string|null, left: string|null, right: string|null, x: number, y: number }} TreeNode
 */

/** @type {import('svelte/store').Writable<TreeNode[]>} */
export const treeNodes = writable([]);

/** @type {import('svelte/store').Writable<string|null>} */
export const rootId = writable(null);

let nodeCounter = 0;

const NODE_W = 60;
const NODE_H = 60;
const LEVEL_H = 100;
const MIN_GAP = 20;

export const treeIsEmpty = derived(
    treeNodes,
    ($nodes) => $nodes.length === 0
);

/**
 * Calculate positions using Reingold-Tilford-like algorithm
 * @param {TreeNode[]} nodes
 * @param {string|null} rootId
 */
function layoutTree(nodes, rootId) {
    if (!rootId || nodes.length === 0) return nodes;

    // Build tree structure
    /** @type {Map<string, TreeNode>} */
    const nodeMap = new Map(nodes.map(n => [n.id, { ...n }]));

    // Assign x positions using post-order traversal
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

    // Assign y positions by depth
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

    // Convert to pixel positions
    return nodes.map(n => ({
        ...n,
        x: (xPos.get(n.id) ?? 0) * (NODE_W + MIN_GAP),
        y: (depth.get(n.id) ?? 0) * LEVEL_H,
    }));
}

export function initTree() {
    logOpTree(
        `class Node {\n    String data;\n    Node left;\n    Node right;\n}`,
        `class Node:\n    def __init__(self, data=None):\n        self.data = data\n        self.left = None\n        self.right = None`,
        `struct Node {\n    std::string data;\n    Node* left;\n    Node* right;\n    Node() : left(nullptr), right(nullptr) {}\n};`
    );
}

/**
 * @param {string|null} parentId
 * @param {'left'|'right'|null} position
 * @param {string} data
 */
export function addTreeNode(parentId, position, data = '') {
    const id = `tree_${++nodeCounter}`;
    const varName = `node${nodeCounter}`;

    /** @type {TreeNode} */
    const newNode = {
        id, varName, data,
        parentId,
        left: null, right: null,
        x: 0, y: 0,
    };

    treeNodes.update(ns => {
        let updated = [...ns, newNode];

        // Update parent
        if (parentId && position) {
            updated = updated.map(n =>
                n.id === parentId
                    ? { ...n, [position]: id }
                    : n
            );
        }

        // Set root if first node
        if (!parentId) rootId.set(id);

        // Re-layout
        const root = get(rootId);
        return layoutTree(updated, root);
    });

    // Log
    const javaOps = [`Node ${varName} = new Node();`];
    const pyOps = [`${varName} = Node()`];
    const cppOps = [`Node* ${varName} = new Node();`];

    if (parentId && position) {
        const parent = get(treeNodes).find(n => n.id === parentId);
        if (parent) {
            javaOps.push(`${parent.varName}.${position} = ${varName};`);
            pyOps.push(`${parent.varName}.${position} = ${varName}`);
            cppOps.push(`${parent.varName}->${position} = ${varName};`);
        }
    } else {
        javaOps.push(`Node root = ${varName};`);
        pyOps.push(`root = ${varName}`);
        cppOps.push(`Node* root = ${varName};`);
    }

    logOpTree(javaOps, pyOps, cppOps);
}

/**
 * @param {string} nodeId
 */
export function updateTreeNode(nodeId, patch, silent = false) {
    const ns = get(treeNodes);
    const old = ns.find(n => n.id === nodeId);
    treeNodes.update(ns => ns.map(n => n.id === nodeId ? { ...n, ...patch } : n));

    if (!silent && old && patch.data !== undefined && patch.data !== old.data) {
        const updated = get(treeNodes).find(n => n.id === nodeId);
        if (!updated) return;
        const val = patch.data ? `"${patch.data}"` : 'null';
        const pyVal = patch.data ? `"${patch.data}"` : 'None';
        const cppVal = patch.data ? `"${patch.data}"` : '""';
        logOpTree(
            `${updated.varName}.data = ${val};`,
            `${updated.varName}.data = ${pyVal}`,
            `${updated.varName}->data = ${cppVal};`
        );
    }
}

/**
 * Remove node and all descendants — they become unreachable
 * @param {string} nodeId
 */
export function removeTreeNode(nodeId) {
    const ns = get(treeNodes);
    const node = ns.find(n => n.id === nodeId);
    if (!node) return;

    const parent = ns.find(n => n.id === node.parentId);
    const javaOps = [];
    const pyOps = [];
    const cppOps = [];

    if (parent) {
        const side = parent.left === nodeId ? 'left' : 'right';
        javaOps.push(`${parent.varName}.${side} = null;`);
        pyOps.push(`${parent.varName}.${side} = None`);
        cppOps.push(`${parent.varName}->${side} = nullptr;`);

        treeNodes.update(ns => ns.map(n =>
            n.id === parent.id ? { ...n, [side]: null } : n
        ));
    } else {
        // Removing root
        javaOps.push(`root = null;`);
        pyOps.push(`root = None`);
        cppOps.push(`root = nullptr;`);
        rootId.set(null);
    }

    // Sever node from parent but keep in store (for GC)
    treeNodes.update(ns => ns.map(n =>
        n.id === nodeId ? { ...n, parentId: null } : n
    ));

    // Re-layout remaining connected tree
    const root = get(rootId);
    treeNodes.update(ns => layoutTree(ns.filter(n =>
        n.id === nodeId || !isDescendantOrSelf(n, nodeId, ns)
            ? n
            : n
    ), root));

    logOpTree(javaOps, pyOps, cppOps);
}

/**
 * @param {TreeNode} node
 * @param {string} ancestorId
 * @param {TreeNode[]} allNodes
 */
function isDescendantOrSelf(node, ancestorId, allNodes) {
    if (node.id === ancestorId) return true;
    if (!node.parentId) return false;
    const parent = allNodes.find(n => n.id === node.parentId);
    return parent ? isDescendantOrSelf(parent, ancestorId, allNodes) : false;
}

export function garbageCollectTree() {
    const ns = get(treeNodes);
    const root = get(rootId);

    // Find reachable nodes from root
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
        logOpTree(
            ['// GC: no unreachable nodes found'],
            ['# GC: no unreachable nodes found'],
            ['// GC: no unreachable nodes found']
        );
        return;
    }

    const javaOps = toRemove.map(n => `// GC: ${n.varName} collected`);
    const pyOps = toRemove.map(n => `# GC: ${n.varName} collected`);
    const cppOps = toRemove.map(n => `// GC: delete ${n.varName};`);
    logOpTree(javaOps, pyOps, cppOps);

    treeNodes.update(ns => ns.filter(n => reachable.has(n.id)));
}

export function clearTree() {
    treeNodes.set([]);
    rootId.set(null);
    nodeCounter = 0;
}

export function getSnapshotTree() {
    return {
        nodes: JSON.parse(JSON.stringify(get(treeNodes))),
        rootId: get(rootId),
        counter: nodeCounter,
        codeLog: JSON.parse(JSON.stringify(get(treeLog))),
        _type: 'tree',
    };
}

/**
 * @param {ReturnType<typeof getSnapshotTree>} snapshot
 */
export function applySnapshotTree(snapshot) {
    nodeCounter = snapshot.counter ?? 0;
    treeNodes.set(snapshot.nodes ?? []);
    rootId.set(snapshot.rootId ?? null);
    treeLog.set(snapshot.codeLog ?? []);
}

export function resetTree() {
    treeNodes.set([]);
    rootId.set(null);
    nodeCounter = 0;
}