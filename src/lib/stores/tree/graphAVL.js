import { writable, get, derived } from 'svelte/store';
import { logOpAVL, avlLog } from '../shared/avlLog.js';
import { cloneStoreValue } from '../../utils/storeSnapshot.js';
import { compareValues } from './treeTraversal.js';

/**
 * @typedef {{ id: string, varName: string, data: string, parentId: string|null, left: string|null, right: string|null, x: number, y: number }} AVLNode
 */

/** @type {import('svelte/store').Writable<AVLNode[]>} */
export const avlNodes = writable([]);

/** @type {import('svelte/store').Writable<string|null>} */
export const avlRootId = writable(null);

let nodeCounter = 0;

const NODE_W = 70;
const NODE_H = 70;
const LEVEL_H = 110;
const MIN_GAP = 20;

export const avlIsEmpty = derived(avlNodes, ($nodes) => $nodes.length === 0);

/**
 * Reingold-Tilford-like layout — ordering-agnostic, lays out whatever
 * left/right pointers exist. Rotations need no special-case position
 * math: this is re-run after every mutation and picks up the new shape.
 * @param {AVLNode[]} nodes
 * @param {string|null} rootId
 */
function layoutAVL(nodes, rootId) {
    if (!rootId || nodes.length === 0) return nodes;

    const nodeMap = new Map(nodes.map((n) => [n.id, { ...n }]));
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

    return nodes.map((n) => {
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

export function initAVL() {
    logOpAVL(
        `class Node {\n    String data;\n    Node left;\n    Node right;\n}`,
        `class Node:\n    def __init__(self, data=None):\n        self.data = data\n        self.left = None\n        self.right = None`,
        `struct Node {\n    std::string data;\n    Node* left;\n    Node* right;\n    Node() : left(nullptr), right(nullptr) {}\n};`
    );
}

/**
 * Height of the subtree rooted at `nodeId`. Computed fresh every call
 * (no cached field on the node) — trees here are teaching-tool scale, so
 * this trades a little redundant computation for eliminating an entire
 * class of AVL bugs (a cached height going stale after a rotation).
 * @param {string|null} nodeId
 * @param {Map<string, AVLNode>} nodesById
 * @returns {number}
 */
export function getHeight(nodeId, nodesById) {
    if (!nodeId) return -1;
    const node = nodesById.get(nodeId);
    if (!node) return -1;
    return 1 + Math.max(getHeight(node.left, nodesById), getHeight(node.right, nodesById));
}

/**
 * @param {string} nodeId
 * @param {Map<string, AVLNode>} nodesById
 * @returns {number} positive = left-heavy, negative = right-heavy
 */
export function getBalance(nodeId, nodesById) {
    const node = nodesById.get(nodeId);
    if (!node) return 0;
    return getHeight(node.left, nodesById) - getHeight(node.right, nodesById);
}

function buildMap() {
    return new Map(get(avlNodes).map((n) => [n.id, n]));
}

/**
 * Node becomes the left child of its own right child (the "pivot").
 * Single atomic store update — collapsing every pointer change into one
 * `.update()` call so no reactive reader ever observes a momentarily
 * inconsistent tree between two separate updates.
 * @param {string} nodeId
 * @returns {string} id of the new subtree root (the pivot)
 */
function rotateLeft(nodeId) {
    const nodesById = buildMap();
    const node = nodesById.get(nodeId);
    const pivotId = node.right;
    const pivot = nodesById.get(pivotId);
    const parentId = node.parentId;
    const pivotLeftId = pivot.left;
    const parent = parentId ? nodesById.get(parentId) : null;
    const side = parent ? (parent.left === nodeId ? 'left' : 'right') : null;

    avlNodes.update((ns) =>
        ns.map((n) => {
            if (n.id === nodeId) return { ...n, right: pivotLeftId, parentId: pivotId };
            if (n.id === pivotId) return { ...n, left: nodeId, parentId };
            if (pivotLeftId && n.id === pivotLeftId) return { ...n, parentId: nodeId };
            if (parentId && n.id === parentId) return { ...n, [side]: pivotId };
            return n;
        })
    );

    if (!parentId) avlRootId.set(pivotId);

    logOpAVL(
        [
            `Node pivot = ${node.varName}.right; // ${pivot.varName}`,
            `${node.varName}.right = pivot.left;`,
            `pivot.left = ${node.varName};`,
            parent ? `${parent.varName}.${side} = pivot;` : `root = pivot;`,
        ],
        [
            `pivot = ${node.varName}.right  # ${pivot.varName}`,
            `${node.varName}.right = pivot.left`,
            `pivot.left = ${node.varName}`,
            parent ? `${parent.varName}.${side} = pivot` : `root = pivot`,
        ],
        [
            `Node* pivot = ${node.varName}->right; // ${pivot.varName}`,
            `${node.varName}->right = pivot->left;`,
            `pivot->left = ${node.varName};`,
            parent ? `${parent.varName}->${side} = pivot;` : `root = pivot;`,
        ]
    );

    return pivotId;
}

/**
 * Mirror image of rotateLeft.
 * @param {string} nodeId
 * @returns {string} id of the new subtree root (the pivot)
 */
function rotateRight(nodeId) {
    const nodesById = buildMap();
    const node = nodesById.get(nodeId);
    const pivotId = node.left;
    const pivot = nodesById.get(pivotId);
    const parentId = node.parentId;
    const pivotRightId = pivot.right;
    const parent = parentId ? nodesById.get(parentId) : null;
    const side = parent ? (parent.left === nodeId ? 'left' : 'right') : null;

    avlNodes.update((ns) =>
        ns.map((n) => {
            if (n.id === nodeId) return { ...n, left: pivotRightId, parentId: pivotId };
            if (n.id === pivotId) return { ...n, right: nodeId, parentId };
            if (pivotRightId && n.id === pivotRightId) return { ...n, parentId: nodeId };
            if (parentId && n.id === parentId) return { ...n, [side]: pivotId };
            return n;
        })
    );

    if (!parentId) avlRootId.set(pivotId);

    logOpAVL(
        [
            `Node pivot = ${node.varName}.left; // ${pivot.varName}`,
            `${node.varName}.left = pivot.right;`,
            `pivot.right = ${node.varName};`,
            parent ? `${parent.varName}.${side} = pivot;` : `root = pivot;`,
        ],
        [
            `pivot = ${node.varName}.left  # ${pivot.varName}`,
            `${node.varName}.left = pivot.right`,
            `pivot.right = ${node.varName}`,
            parent ? `${parent.varName}.${side} = pivot` : `root = pivot`,
        ],
        [
            `Node* pivot = ${node.varName}->left; // ${pivot.varName}`,
            `${node.varName}->left = pivot->right;`,
            `pivot->right = ${node.varName};`,
            parent ? `${parent.varName}->${side} = pivot;` : `root = pivot;`,
        ]
    );

    return pivotId;
}

/**
 * At most one rotation can ever fire per insert (standard AVL theorem),
 * so this walk breaks immediately once it does.
 * @param {string|null} startId parent of the newly inserted node
 */
function rebalanceAfterInsert(startId) {
    let walk = startId;
    while (walk) {
        const nodesById = buildMap();
        const walkNode = nodesById.get(walk);
        if (!walkNode) return;
        const balance = getBalance(walk, nodesById);

        if (balance > 1) {
            const leftChildId = walkNode.left;
            const doubleRotation = getBalance(leftChildId, nodesById) < 0;
            logOpAVL(
                `// ${walkNode.varName} unbalanced (balance=${balance}) -> ${doubleRotation ? 'LR' : 'LL'} case`,
                `# ${walkNode.varName} unbalanced (balance=${balance}) -> ${doubleRotation ? 'LR' : 'LL'} case`,
                `// ${walkNode.varName} unbalanced (balance=${balance}) -> ${doubleRotation ? 'LR' : 'LL'} case`
            );
            if (doubleRotation) rotateLeft(leftChildId);
            rotateRight(walk);
            return;
        }
        if (balance < -1) {
            const rightChildId = walkNode.right;
            const doubleRotation = getBalance(rightChildId, nodesById) > 0;
            logOpAVL(
                `// ${walkNode.varName} unbalanced (balance=${balance}) -> ${doubleRotation ? 'RL' : 'RR'} case`,
                `# ${walkNode.varName} unbalanced (balance=${balance}) -> ${doubleRotation ? 'RL' : 'RR'} case`,
                `// ${walkNode.varName} unbalanced (balance=${balance}) -> ${doubleRotation ? 'RL' : 'RR'} case`
            );
            if (doubleRotation) rotateRight(rightChildId);
            rotateLeft(walk);
            return;
        }

        walk = walkNode.parentId;
    }
}

/**
 * Unlike insert, a delete-triggered rotation can reduce the rotated
 * subtree's height, propagating imbalance further up — this walk must
 * check every remaining ancestor up to the root, never break early.
 * @param {string|null} startId parent of the removed node (or of the shrunk subtree)
 */
function rebalanceAfterDelete(startId) {
    let walk = startId;
    while (walk) {
        const nodesById = buildMap();
        const walkNode = nodesById.get(walk);
        if (!walkNode) return;
        const balance = getBalance(walk, nodesById);
        let subtreeRoot = walk;

        if (balance > 1) {
            const leftChildId = walkNode.left;
            const doubleRotation = getBalance(leftChildId, nodesById) < 0;
            logOpAVL(
                `// ${walkNode.varName} unbalanced (balance=${balance}) -> ${doubleRotation ? 'LR' : 'LL'} case`,
                `# ${walkNode.varName} unbalanced (balance=${balance}) -> ${doubleRotation ? 'LR' : 'LL'} case`,
                `// ${walkNode.varName} unbalanced (balance=${balance}) -> ${doubleRotation ? 'LR' : 'LL'} case`
            );
            if (doubleRotation) rotateLeft(leftChildId);
            subtreeRoot = rotateRight(walk);
        } else if (balance < -1) {
            const rightChildId = walkNode.right;
            const doubleRotation = getBalance(rightChildId, nodesById) > 0;
            logOpAVL(
                `// ${walkNode.varName} unbalanced (balance=${balance}) -> ${doubleRotation ? 'RL' : 'RR'} case`,
                `# ${walkNode.varName} unbalanced (balance=${balance}) -> ${doubleRotation ? 'RL' : 'RR'} case`,
                `// ${walkNode.varName} unbalanced (balance=${balance}) -> ${doubleRotation ? 'RL' : 'RR'} case`
            );
            if (doubleRotation) rotateRight(rightChildId);
            subtreeRoot = rotateLeft(walk);
        }

        const current = get(avlNodes).find((n) => n.id === subtreeRoot);
        walk = current ? current.parentId : null;
    }
}

/**
 * Value-driven insert: same comparison walk as the BST page's
 * insertBST (reject duplicates), followed by a rebalance walk back up
 * to the root.
 * @param {string} value
 * @returns {boolean} true if inserted, false if empty/duplicate
 */
export function insertAVL(value) {
    const trimmed = (value ?? '').trim();
    if (trimmed === '') return false;

    const nodes = get(avlNodes);
    const root = get(avlRootId);

    if (!root) {
        const id = `avl_${++nodeCounter}`;
        const varName = `node${nodeCounter}`;
        /** @type {AVLNode} */
        const newNode = { id, varName, data: trimmed, parentId: null, left: null, right: null, x: 0, y: 0 };
        avlNodes.update((ns) => layoutAVL([...ns, newNode], id));
        avlRootId.set(id);
        logOpAVL(
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
        const node = nodes.find((n) => n.id === currentId);
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

    const id = `avl_${++nodeCounter}`;
    const varName = `node${nodeCounter}`;
    const parent = nodes.find((n) => n.id === parentId);
    /** @type {AVLNode} */
    const newNode = { id, varName, data: trimmed, parentId, left: null, right: null, x: 0, y: 0 };

    avlNodes.update((ns) => {
        let updated = [...ns, newNode];
        updated = updated.map((n) => (n.id === parentId ? { ...n, [side]: id } : n));
        return layoutAVL(updated, get(avlRootId));
    });

    javaOps.push(`Node ${varName} = new Node();`);
    pyOps.push(`${varName} = Node()`);
    cppOps.push(`Node* ${varName} = new Node();`);
    if (parent) {
        javaOps.push(`${parent.varName}.${side} = ${varName};`);
        pyOps.push(`${parent.varName}.${side} = ${varName}`);
        cppOps.push(`${parent.varName}->${side} = ${varName};`);
    }
    logOpAVL(javaOps, pyOps, cppOps);

    rebalanceAfterInsert(parentId);
    return true;
}

/**
 * Standard 3-case BST delete (same as the BST page's deleteBSTNode),
 * with a rebalance walk appended after the leaf/one-child cases. The
 * two-child case's recursive call re-enters this function and performs
 * its own rebalance walk, so no extra call is needed at that level.
 * @param {string} nodeId
 */
export function deleteAVLNode(nodeId) {
    const nodes = get(avlNodes);
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    if (node.left && node.right) {
        let succId = node.right;
        let succNode = nodes.find((n) => n.id === succId);
        while (succNode && succNode.left) {
            succId = succNode.left;
            succNode = nodes.find((n) => n.id === succId);
        }
        if (!succNode) return;

        logOpAVL(
            `${node.varName}.data = ${succNode.varName}.data;`,
            `${node.varName}.data = ${succNode.varName}.data`,
            `${node.varName}->data = ${succNode.varName}->data;`
        );

        avlNodes.update((ns) => ns.map((n) => (n.id === node.id ? { ...n, data: succNode.data } : n)));

        deleteAVLNode(succId);
        return;
    }

    const parent = nodes.find((n) => n.id === node.parentId);
    const javaOps = [];
    const pyOps = [];
    const cppOps = [];

    if (node.left || node.right) {
        const childId = node.left ?? node.right;
        const childNode = nodes.find((n) => n.id === childId);

        if (parent) {
            const side = parent.left === node.id ? 'left' : 'right';
            javaOps.push(`${parent.varName}.${side} = ${childNode.varName};`);
            pyOps.push(`${parent.varName}.${side} = ${childNode.varName}`);
            cppOps.push(`${parent.varName}->${side} = ${childNode.varName};`);
        } else {
            javaOps.push(`root = ${childNode.varName};`);
            pyOps.push(`root = ${childNode.varName}`);
            cppOps.push(`root = ${childNode.varName};`);
            avlRootId.set(childId);
        }

        avlNodes.update((ns) => {
            const updated = ns
                .filter((n) => n.id !== node.id)
                .map((n) => {
                    if (parent && n.id === parent.id) {
                        const side = parent.left === node.id ? 'left' : 'right';
                        return { ...n, [side]: childId };
                    }
                    if (n.id === childId) return { ...n, parentId: parent ? parent.id : null };
                    return n;
                });
            return layoutAVL(updated, get(avlRootId));
        });

        logOpAVL(javaOps, pyOps, cppOps);
        rebalanceAfterDelete(parent ? parent.id : null);
        return;
    }

    if (parent) {
        const side = parent.left === node.id ? 'left' : 'right';
        javaOps.push(`${parent.varName}.${side} = null;`);
        pyOps.push(`${parent.varName}.${side} = None`);
        cppOps.push(`${parent.varName}->${side} = nullptr;`);
    } else {
        javaOps.push(`root = null;`);
        pyOps.push(`root = None`);
        cppOps.push(`root = nullptr;`);
        avlRootId.set(null);
    }

    avlNodes.update((ns) => {
        const updated = ns
            .filter((n) => n.id !== node.id)
            .map((n) => {
                if (parent && n.id === parent.id) {
                    const side = parent.left === node.id ? 'left' : 'right';
                    return { ...n, [side]: null };
                }
                return n;
            });
        return layoutAVL(updated, get(avlRootId));
    });

    logOpAVL(javaOps, pyOps, cppOps);
    rebalanceAfterDelete(parent ? parent.id : null);
}

/**
 * Defensive safety net — normal insert/delete never leaves unreachable
 * nodes (same as the BST page), kept for parity and to recover from bugs.
 */
export function garbageCollectAVL() {
    const ns = get(avlNodes);
    const root = get(avlRootId);

    const reachable = new Set();
    function traverse(nodeId) {
        if (!nodeId) return;
        reachable.add(nodeId);
        const node = ns.find((n) => n.id === nodeId);
        if (!node) return;
        traverse(node.left);
        traverse(node.right);
    }
    traverse(root);

    const toRemove = ns.filter((n) => !reachable.has(n.id));
    if (toRemove.length === 0) {
        logOpAVL(
            ['// GC: no unreachable nodes found'],
            ['# GC: no unreachable nodes found'],
            ['// GC: no unreachable nodes found']
        );
        return;
    }

    const javaOps = toRemove.map((n) => `// GC: ${n.varName} collected`);
    const pyOps = toRemove.map((n) => `# GC: ${n.varName} collected`);
    const cppOps = toRemove.map((n) => `// GC: delete ${n.varName};`);
    logOpAVL(javaOps, pyOps, cppOps);

    avlNodes.update((ns) => ns.filter((n) => reachable.has(n.id)));
}

export function clearAVL() {
    avlNodes.set([]);
    avlRootId.set(null);
    nodeCounter = 0;
}

export function resetAVL() {
    avlNodes.set([]);
    avlRootId.set(null);
    nodeCounter = 0;
}

export function getSnapshotAVL() {
    return {
        nodes: cloneStoreValue(avlNodes),
        rootId: get(avlRootId),
        counter: nodeCounter,
        codeLog: cloneStoreValue(avlLog),
        _type: 'avl',
    };
}

/**
 * @param {ReturnType<typeof getSnapshotAVL>} snapshot
 */
export function applySnapshotAVL(snapshot) {
    nodeCounter = snapshot.counter ?? 0;
    avlNodes.set(snapshot.nodes ?? []);
    avlRootId.set(snapshot.rootId ?? null);
    avlLog.set(snapshot.codeLog ?? []);
}
