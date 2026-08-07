import { writable, get } from 'svelte/store';
import { treeNodes, rootId } from './graphTree.js';
import { logOpTree } from '../shared/treeLog.js';
import { pushHistory } from '../shared/history.js';
import { toast } from '../shared/toast.js';

/**
 * @typedef {'inorder'|'preorder'|'postorder'|'search'} TraversalType
 * @typedef {{ type: TraversalType, order: string[], index: number, playing: boolean, speed: number, searchTarget: string|null, searchFound: boolean|null }} TraversalState
 */

/** @type {import('svelte/store').Writable<TraversalState>} */
export const traversalState = writable({
    type: 'inorder',
    order: [],
    index: -1,
    playing: false,
    speed: 700,
    searchTarget: null,
    searchFound: null,
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

const SEARCH_METHOD = {
    java: `Node search(Node node, String target) {\n    if (node == null) return null;\n    int cmp = target.compareTo(node.data);\n    if (cmp == 0) return node;\n    return cmp < 0 ? search(node.left, target) : search(node.right, target);\n}`,
    python: `def search(node, target):\n    if node is None:\n        return None\n    if target == node.data:\n        return node\n    if target < node.data:\n        return search(node.left, target)\n    return search(node.right, target)`,
    cpp: `Node* search(Node* node, std::string target) {\n    if (node == nullptr) return nullptr;\n    if (target == node->data) return node;\n    return target < node->data ? search(node->left, target) : search(node->right, target);\n}`,
};

/**
 * Lexicographic (string) comparison — matches Node.data's type in the
 * generated code exactly, so the visualized path always agrees with what
 * the shown Java/Python/C++ would actually do if run.
 * @param {string} a
 * @param {string} b
 * @returns {-1|0|1}
 */
export function compareValues(a, b) {
    if (a === b) return 0;
    return a < b ? -1 : 1;
}

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

/**
 * @param {import('./graphTree.js').TreeNode[]} nodes
 * @param {string|null} root
 * @param {string} target
 * @returns {{ path: string[], foundId: string|null }}
 */
export function computeSearchPath(nodes, root, target) {
    /** @type {Map<string, import('./graphTree.js').TreeNode>} */
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const path = [];
    let currentId = root;
    let foundId = null;

    while (currentId) {
        const node = nodeMap.get(currentId);
        if (!node) break;

        path.push(currentId);
        const cmp = compareValues(target, node.data);
        if (cmp === 0) {
            foundId = currentId;
            break;
        }
        currentId = cmp < 0 ? node.left : node.right;
    }

    return { path, foundId };
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
    stopInterval();

    if (!sessionActive) {
        pushHistory();
        sessionActive = true;
    }

    const order = computeOrder(get(treeNodes), get(rootId), type);
    const method = METHODS[type];

    logOpTree(method.java, method.python, method.cpp);

    traversalState.set({
        type,
        order,
        index: -1,
        playing: false,
        speed: get(traversalState).speed,
        searchTarget: null,
        searchFound: null,
    });
}

/**
 * @param {string} target
 */
export function startSearch(target) {
    stopInterval();

    if (!sessionActive) {
        pushHistory();
        sessionActive = true;
    }

    const { path, foundId } = computeSearchPath(get(treeNodes), get(rootId), target);

    logOpTree(SEARCH_METHOD.java, SEARCH_METHOD.python, SEARCH_METHOD.cpp);

    traversalState.set({
        type: 'search',
        order: path,
        index: -1,
        playing: false,
        speed: get(traversalState).speed,
        searchTarget: target,
        searchFound: foundId !== null,
    });
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
    const isLastStep = nextIndex >= state.order.length - 1;

    if (node) {
        const val = node.data || 'null';

        if (state.type === 'search') {
            const target = state.searchTarget ?? '';
            const cmp = compareValues(target, node.data);
            const outcome = cmp === 0 ? 'FOUND' : cmp < 0 ? 'go left' : 'go right';
            const op = cmp === 0 ? '==' : cmp < 0 ? '<' : '>';
            logOpTree(
                `// compare ${node.varName} (data=${val}): "${target}" ${op} "${val}" -> ${outcome}`,
                `# compare ${node.varName} (data=${val}): "${target}" ${op} "${val}" -> ${outcome}`,
                `// compare ${node.varName} (data=${val}): "${target}" ${op} "${val}" -> ${outcome}`
            );
        } else {
            logOpTree(
                `// visit: ${node.varName} (data=${val})`,
                `# visit: ${node.varName} (data=${val})`,
                `// visit: ${node.varName} (data=${val})`
            );
        }
    }

    traversalState.update(s => ({ ...s, index: nextIndex }));

    if (isLastStep) {
        if (state.type === 'search') {
            if (state.searchFound) {
                logOpTree('// FOUND', '# FOUND', '// FOUND');
                toast.success(`Found "${state.searchTarget}"`);
            } else {
                logOpTree('// NOT FOUND', '# NOT FOUND', '// NOT FOUND');
                toast.error(`"${state.searchTarget}" not found`);
            }
        }
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
    traversalState.update(s => ({
        ...s,
        order: [],
        index: -1,
        playing: false,
        searchTarget: null,
        searchFound: null,
    }));
}

/** Fully clears playback state, including the computed order — use when the tree itself is replaced (New/Load). */
export function resetTraversal() {
    stopInterval();
    sessionActive = false;
    traversalState.update(s => ({
        ...s,
        order: [],
        index: -1,
        playing: false,
        searchTarget: null,
        searchFound: null,
    }));
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
