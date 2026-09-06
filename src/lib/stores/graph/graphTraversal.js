import { writable, get } from 'svelte/store';
import { graphNodes, graphEdges } from './graphGraph.js';
import { logOpGraph } from '../shared/graphLog.js';
import { pushHistory } from '../shared/history.js';

/**
 * @typedef {'bfs'|'dfs'} TraversalType
 * @typedef {{ type: TraversalType, order: string[], frontiers: string[][], index: number, playing: boolean, speed: number, startNodeId: string|null }} TraversalState
 */

/**
 * `frontiers` is the companion illustration data for the BFS queue / DFS
 * stack overlay. It has `order.length + 1` entries: `frontiers[0]` is the
 * structure right after the start node is seeded, and `frontiers[k + 1]` is
 * its state right after `order[k]` has been removed and that node's unseen
 * neighbours added. So at playback position `index`, the structure to draw
 * is `frontiers[index + 1]`. Each entry lists node ids from the removal end
 * to the insertion end — for the queue that is front → back, for the stack
 * bottom → top.
 * @type {import('svelte/store').Writable<TraversalState>}
 */
export const traversalState = writable({
    type: 'bfs',
    order: [],
    frontiers: [],
    index: -1,
    playing: false,
    speed: 700,
    startNodeId: null,
});

/** @type {ReturnType<typeof setInterval>|null} */
let intervalId = null;

/** True between startTraversal() and the matching pushHistory() that closes the bracket. */
let sessionActive = false;

const METHODS = {
    bfs: {
        java: `void bfs(Node start) {\n    Queue<Node> queue = new LinkedList<>();\n    Set<Node> visited = new HashSet<>();\n    queue.add(start);\n    visited.add(start);\n    while (!queue.isEmpty()) {\n        Node node = queue.poll();\n        visit(node);\n        for (Node neighbor : node.neighbors) {\n            if (!visited.contains(neighbor)) {\n                visited.add(neighbor);\n                queue.add(neighbor);\n            }\n        }\n    }\n}`,
        python: `def bfs(start):\n    queue = deque([start])\n    visited = {start}\n    while queue:\n        node = queue.popleft()\n        visit(node)\n        for neighbor in node.neighbors:\n            if neighbor not in visited:\n                visited.add(neighbor)\n                queue.append(neighbor)`,
        cpp: `void bfs(Node* start) {\n    std::queue<Node*> q;\n    std::set<Node*> visited;\n    q.push(start);\n    visited.insert(start);\n    while (!q.empty()) {\n        Node* node = q.front(); q.pop();\n        visit(node);\n        for (Node* neighbor : node->neighbors) {\n            if (!visited.count(neighbor)) {\n                visited.insert(neighbor);\n                q.push(neighbor);\n            }\n        }\n    }\n}`,
    },
    dfs: {
        java: `void dfs(Node start) {\n    Deque<Node> stack = new ArrayDeque<>();\n    Set<Node> visited = new HashSet<>();\n    stack.push(start);\n    while (!stack.isEmpty()) {\n        Node node = stack.pop();\n        if (visited.contains(node)) continue;\n        visited.add(node);\n        visit(node);\n        // push in reverse so the first neighbor is visited first\n        for (int i = node.neighbors.size() - 1; i >= 0; i--) {\n            Node neighbor = node.neighbors.get(i);\n            if (!visited.contains(neighbor)) stack.push(neighbor);\n        }\n    }\n}`,
        python: `def dfs(start):\n    stack = [start]\n    visited = set()\n    while stack:\n        node = stack.pop()\n        if node in visited:\n            continue\n        visited.add(node)\n        visit(node)\n        # push in reverse so the first neighbor is visited first\n        for neighbor in reversed(node.neighbors):\n            if neighbor not in visited:\n                stack.append(neighbor)`,
        cpp: `void dfs(Node* start) {\n    std::stack<Node*> stack;\n    std::set<Node*> visited;\n    stack.push(start);\n    while (!stack.empty()) {\n        Node* node = stack.top(); stack.pop();\n        if (visited.count(node)) continue;\n        visited.insert(node);\n        visit(node);\n        // push in reverse so the first neighbor is visited first\n        for (auto it = node->neighbors.rbegin(); it != node->neighbors.rend(); ++it) {\n            if (!visited.count(*it)) stack.push(*it);\n        }\n    }\n}`,
    },
};

/**
 * @param {import('./graphGraph.js').GraphNode[]} nodes
 * @param {import('./graphGraph.js').GraphEdge[]} edges
 * @returns {Map<string, string[]>}
 */
function buildAdjacency(nodes, edges) {
    /** @type {Map<string, string[]>} */
    const adjacency = new Map(nodes.map(n => [n.id, []]));
    edges.forEach(e => {
        if (adjacency.has(e.from)) adjacency.get(e.from).push(e.to);
    });
    return adjacency;
}

/**
 * De-duplicate a stack snapshot keeping each id at its *topmost* (last)
 * position — the spot where it will actually be popped. The simple
 * iterative DFS can push a node from two parents before it is visited; the
 * lower copy is dead weight that only ever triggers the "skip if visited"
 * branch, so hiding it keeps the illustration's top cell honest as the next
 * node to visit.
 * @param {string[]} stack  bottom → top
 * @returns {string[]}
 */
function dedupeStackFromTop(stack) {
    const seen = new Set();
    const out = [];
    for (let i = stack.length - 1; i >= 0; i--) {
        if (seen.has(stack[i])) continue;
        seen.add(stack[i]);
        out.push(stack[i]);
    }
    return out.reverse();
}

/**
 * Run BFS or DFS and return both the visit `order` and the per-step
 * `frontiers` snapshots that drive the queue / stack overlay.
 * @param {TraversalType} type
 * @param {import('./graphGraph.js').GraphNode[]} nodes
 * @param {import('./graphGraph.js').GraphEdge[]} edges
 * @param {string|null} startId
 * @returns {{ order: string[], frontiers: string[][] }}
 */
export function computeTraversal(type, nodes, edges, startId) {
    if (!startId || !nodes.some(n => n.id === startId)) return { order: [], frontiers: [] };

    const adjacency = buildAdjacency(nodes, edges);
    /** @type {string[]} */
    const order = [];
    /** @type {string[][]} */
    const frontiers = [[startId]];

    if (type === 'bfs') {
        const visited = new Set([startId]);
        const queue = [startId];
        while (queue.length > 0) {
            const id = queue.shift();
            order.push(id);
            for (const neighborId of adjacency.get(id) ?? []) {
                if (!visited.has(neighborId)) {
                    visited.add(neighborId);
                    queue.push(neighborId);
                }
            }
            frontiers.push([...queue]);
        }
    } else {
        const visited = new Set();
        const stack = [startId];
        while (stack.length > 0) {
            const id = stack.pop();
            if (visited.has(id)) continue;
            visited.add(id);
            order.push(id);

            const neighbors = adjacency.get(id) ?? [];
            for (let i = neighbors.length - 1; i >= 0; i--) {
                if (!visited.has(neighbors[i])) stack.push(neighbors[i]);
            }
            frontiers.push(dedupeStackFromTop(stack));
        }
    }

    return { order, frontiers };
}

/**
 * @param {import('./graphGraph.js').GraphNode[]} nodes
 * @param {import('./graphGraph.js').GraphEdge[]} edges
 * @param {string|null} startId
 * @returns {string[]}
 */
export function computeBFSOrder(nodes, edges, startId) {
    return computeTraversal('bfs', nodes, edges, startId).order;
}

/**
 * @param {import('./graphGraph.js').GraphNode[]} nodes
 * @param {import('./graphGraph.js').GraphEdge[]} edges
 * @param {string|null} startId
 * @returns {string[]}
 */
export function computeDFSOrder(nodes, edges, startId) {
    return computeTraversal('dfs', nodes, edges, startId).order;
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
 * @param {string|null} nodeId
 */
export function setStartNode(nodeId) {
    traversalState.update(s => ({ ...s, startNodeId: nodeId }));
}

/**
 * @param {TraversalType} type
 */
export function startTraversal(type) {
    const startNodeId = get(traversalState).startNodeId;
    if (!startNodeId) return;

    stopInterval();

    if (!sessionActive) {
        pushHistory();
        sessionActive = true;
    }

    const nodes = get(graphNodes);
    const edges = get(graphEdges);
    const { order, frontiers } = computeTraversal(type, nodes, edges, startNodeId);
    const method = METHODS[type];

    logOpGraph(method.java, method.python, method.cpp);

    traversalState.set({
        type,
        order,
        frontiers,
        index: -1,
        playing: false,
        speed: get(traversalState).speed,
        startNodeId,
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
    const node = get(graphNodes).find(n => n.id === nodeId);
    const isLastStep = nextIndex >= state.order.length - 1;

    if (node) {
        const val = node.data || 'null';
        logOpGraph(
            `// visit: ${node.varName} (data=${val})`,
            `# visit: ${node.varName} (data=${val})`,
            `// visit: ${node.varName} (data=${val})`
        );
    }

    traversalState.update(s => ({ ...s, index: nextIndex }));

    if (isLastStep) {
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
    traversalState.update(s => ({ ...s, order: [], frontiers: [], index: -1, playing: false }));
}

/** Fully clears playback state, including the start node — use when the graph itself is replaced (New/Load). */
export function resetTraversal() {
    stopInterval();
    sessionActive = false;
    traversalState.update(s => ({ ...s, order: [], frontiers: [], index: -1, playing: false, startNodeId: null }));
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
