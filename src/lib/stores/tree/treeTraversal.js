import { writable, get } from 'svelte/store';
import { treeNodes, rootId } from './graphTree.js';
import { logOpTree } from '../shared/treeLog.js';
import { pushHistory } from '../shared/history.js';

/**
 * @typedef {'inorder'|'preorder'|'postorder'} TraversalType
 * @typedef {{ type: TraversalType, order: string[], index: number, playing: boolean, speed: number }} TraversalState
 */

/** @type {import('svelte/store').Writable<TraversalState>} */
export const traversalState = writable({
    type: 'inorder',
    order: [],
    index: -1,
    playing: false,
    speed: 700,
});

/** @type {ReturnType<typeof setInterval>|null} */
let intervalId = null;

/** True between startTraversal() and the matching pushHistory() that closes the bracket. */
let sessionActive = false;

const METHODS = {
    inorder: {
        java: `void inorder(Node node) {\n    if (node == null) return;\n    inorder(node.left);\n    visit(node);\n    inorder(node.right);\n}`,
        python: `def inorder(node):\n    if node is None:\n        return\n    inorder(node.left)\n    visit(node)\n    inorder(node.right)`,
        cpp: `void inorder(Node* node) {\n    if (node == nullptr) return;\n    inorder(node->left);\n    visit(node);\n    inorder(node->right);\n}`,
    },
    preorder: {
        java: `void preorder(Node node) {\n    if (node == null) return;\n    visit(node);\n    preorder(node.left);\n    preorder(node.right);\n}`,
        python: `def preorder(node):\n    if node is None:\n        return\n    visit(node)\n    preorder(node.left)\n    preorder(node.right)`,
        cpp: `void preorder(Node* node) {\n    if (node == nullptr) return;\n    visit(node);\n    preorder(node->left);\n    preorder(node->right);\n}`,
    },
    postorder: {
        java: `void postorder(Node node) {\n    if (node == null) return;\n    postorder(node.left);\n    postorder(node.right);\n    visit(node);\n}`,
        python: `def postorder(node):\n    if node is None:\n        return\n    postorder(node.left)\n    postorder(node.right)\n    visit(node)`,
        cpp: `void postorder(Node* node) {\n    if (node == nullptr) return;\n    postorder(node->left);\n    postorder(node->right);\n    visit(node);\n}`,
    },
};

/**
 * @param {import('./graphTree.js').TreeNode[]} nodes
 * @param {string|null} root
 * @param {TraversalType} type
 * @returns {string[]}
 */
export function computeOrder(nodes, root, type) {
    /** @type {Map<string, import('./graphTree.js').TreeNode>} */
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const order = [];

    function visit(id) {
        if (!id) return;
        const node = nodeMap.get(id);
        if (!node) return;

        if (type === 'preorder') order.push(id);
        visit(node.left);
        if (type === 'inorder') order.push(id);
        visit(node.right);
        if (type === 'postorder') order.push(id);
    }

    visit(root);
    return order;
}

function stopInterval() {
    if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
    }
}

/** Closes the current playback session's undo bracket, if one is open. */
function closeSession() {
    stopInterval();
    if (sessionActive) {
        pushHistory();
        sessionActive = false;
    }
}

/**
 * @param {TraversalType} type
 */
export function startTraversal(type) {
    closeSession();

    pushHistory();
    sessionActive = true;

    const order = computeOrder(get(treeNodes), get(rootId), type);
    const method = METHODS[type];

    logOpTree(method.java, method.python, method.cpp);

    traversalState.set({ type, order, index: -1, playing: false, speed: get(traversalState).speed });
}

export function stepForward() {
    const state = get(traversalState);
    if (state.index >= state.order.length - 1) {
        closeSession();
        traversalState.update(s => ({ ...s, playing: false }));
        return;
    }

    const nextIndex = state.index + 1;
    const nodeId = state.order[nextIndex];
    const node = get(treeNodes).find(n => n.id === nodeId);

    if (node) {
        const val = node.data || 'null';
        logOpTree(
            `// visit: ${node.varName} (data=${val})`,
            `# visit: ${node.varName} (data=${val})`,
            `// visit: ${node.varName} (data=${val})`
        );
    }

    traversalState.update(s => ({ ...s, index: nextIndex }));

    if (nextIndex >= state.order.length - 1) {
        traversalState.update(s => ({ ...s, playing: false }));
        closeSession();
    }
}

export function stepBack() {
    traversalState.update(s => ({ ...s, index: Math.max(-1, s.index - 1) }));
}

export function playPause() {
    const state = get(traversalState);

    if (state.playing) {
        stopInterval();
        traversalState.update(s => ({ ...s, playing: false }));
        return;
    }

    if (state.index >= state.order.length - 1) return;

    traversalState.update(s => ({ ...s, playing: true }));
    intervalId = setInterval(stepForward, state.speed);
}

export function stopTraversal() {
    closeSession();
    traversalState.update(s => ({ ...s, index: -1, playing: false }));
}

/** Fully clears playback state, including the computed order — use when the tree itself is replaced (New/Load). */
export function resetTraversal() {
    stopInterval();
    sessionActive = false;
    traversalState.update(s => ({ ...s, order: [], index: -1, playing: false }));
}

/**
 * @param {number} speed
 */
export function setTraversalSpeed(speed) {
    traversalState.update(s => ({ ...s, speed }));

    if (get(traversalState).playing) {
        stopInterval();
        intervalId = setInterval(stepForward, speed);
    }
}
