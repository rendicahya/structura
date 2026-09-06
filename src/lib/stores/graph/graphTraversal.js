import { writable, get } from 'svelte/store';
import { graphNodes, graphEdges } from './graphGraph.js';
import { logOpGraph } from '../shared/graphLog.js';
import { pushHistory } from '../shared/history.js';

/**
 * @typedef {'bfs'|'dfs'} TraversalType
 * @typedef {'seed'|'take'|'visit'|'add'|'skip'|'done'} StepPhase
 * @typedef {{ phase: StepPhase, caption: string, frontier: string[], currentId: string|null, visitedIds: string[] }} MicroStep
 * @typedef {{ type: TraversalType, order: string[], steps: MicroStep[], index: number, playing: boolean, speed: number, startNodeId: string|null }} TraversalState
 */

/**
 * A traversal is precomputed into `steps`: one entry per *granular* action —
 * seeding the start node, dequeuing/popping a node, visiting it, and each
 * individual enqueue/push (or skip) of its neighbours. `index` points at the
 * step currently on screen; stepping forward/back is just moving `index`
 * because every step carries the full state needed to draw the frame:
 *
 *  - `frontier`   — the queue / stack contents after this step, listed from
 *                   the removal end to the insertion end (queue front → back,
 *                   stack bottom → top).
 *  - `currentId`  — the node "in hand" (just removed, being processed), or null.
 *  - `visitedIds` — nodes whose visit is fully finished *before* this step, so
 *                   `currentId` and `visitedIds` never overlap.
 *  - `caption`    — the human description shown above the queue / stack.
 *
 * @type {import('svelte/store').Writable<TraversalState>}
 */
export const traversalState = writable({
    type: 'bfs',
    order: [],
    steps: [],
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
 * Run BFS or DFS and return both the visit `order` and the granular
 * `steps` timeline that drives playback and the queue / stack overlay.
 * @param {TraversalType} type
 * @param {import('./graphGraph.js').GraphNode[]} nodes
 * @param {import('./graphGraph.js').GraphEdge[]} edges
 * @param {string|null} startId
 * @returns {{ order: string[], steps: MicroStep[] }}
 */
export function computeTraversal(type, nodes, edges, startId) {
    if (!startId || !nodes.some(n => n.id === startId)) return { order: [], steps: [] };

    const adjacency = buildAdjacency(nodes, edges);
    const nameOf = new Map(nodes.map(n => [n.id, n.data || n.varName || n.id]));
    const label = (id) => nameOf.get(id) ?? id;

    /** @type {string[]} */
    const order = [];
    /** @type {MicroStep[]} */
    const steps = [];
    /** node ids whose visit (incl. neighbour scan) is fully finished */
    const processed = [];

    const isQueue = type === 'bfs';
    const verbTake = isQueue ? 'Dequeue' : 'Pop';
    const verbAdd = isQueue ? 'Enqueue' : 'Push';
    const structName = isQueue ? 'queue' : 'stack';

    /** @param {StepPhase} phase @param {string} caption @param {string[]} frontier @param {string|null} currentId */
    const emit = (phase, caption, frontier, currentId) => {
        steps.push({ phase, caption, frontier, currentId: currentId ?? null, visitedIds: [...processed] });
    };

    if (isQueue) {
        const discovered = new Set([startId]);
        const queue = [startId];
        emit('seed', `${verbAdd} ${label(startId)} — start node`, [...queue], null);

        while (queue.length > 0) {
            const id = queue.shift();
            order.push(id);
            emit('take', `${verbTake} ${label(id)} from the front`, [...queue], id);
            emit('visit', `Visit ${label(id)}`, [...queue], id);

            for (const nb of adjacency.get(id) ?? []) {
                if (discovered.has(nb)) {
                    emit('skip', `Skip ${label(nb)} — already in ${structName} or visited`, [...queue], id);
                } else {
                    discovered.add(nb);
                    queue.push(nb);
                    emit('add', `${verbAdd} ${label(nb)} — unseen neighbour of ${label(id)}`, [...queue], id);
                }
            }
            processed.push(id);
        }
        emit('done', 'Queue is empty — traversal complete', [], null);
    } else {
        const visited = new Set();
        const stack = [startId];
        emit('seed', `${verbAdd} ${label(startId)} — start node`, dedupeStackFromTop([...stack]), null);

        while (stack.length > 0) {
            const id = stack.pop();
            if (visited.has(id)) {
                emit('skip', `Pop ${label(id)} — already visited, discard it`, dedupeStackFromTop([...stack]), null);
                continue;
            }
            visited.add(id);
            order.push(id);
            emit('take', `${verbTake} ${label(id)} from the top`, dedupeStackFromTop([...stack]), id);
            emit('visit', `Visit ${label(id)}`, dedupeStackFromTop([...stack]), id);

            const neighbors = adjacency.get(id) ?? [];
            // Push in reverse so the first neighbour ends up on top / visited first.
            for (let i = neighbors.length - 1; i >= 0; i--) {
                const nb = neighbors[i];
                if (visited.has(nb)) {
                    emit('skip', `Skip ${label(nb)} — already visited`, dedupeStackFromTop([...stack]), id);
                } else {
                    stack.push(nb);
                    emit('add', `${verbAdd} ${label(nb)} — unseen neighbour of ${label(id)}`, dedupeStackFromTop([...stack]), id);
                }
            }
            processed.push(id);
        }
        emit('done', 'Stack is empty — traversal complete', [], null);
    }

    return { order, steps };
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
    const { order, steps } = computeTraversal(type, nodes, edges, startNodeId);
    const method = METHODS[type];

    logOpGraph(method.java, method.python, method.cpp);

    traversalState.set({
        type,
        order,
        steps,
        index: -1,
        playing: false,
        speed: get(traversalState).speed,
        startNodeId,
    });
}

export function stepForward() {
    const state = get(traversalState);
    if (state.index >= state.steps.length - 1) {
        closeSession();
        traversalState.update(s => ({ ...s, playing: false }));
        return;
    }

    const nextIndex = state.index + 1;
    const step = state.steps[nextIndex];
    const isLastStep = nextIndex >= state.steps.length - 1;

    if (step) {
        logOpGraph(`// ${step.caption}`, `# ${step.caption}`, `// ${step.caption}`);
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

    if (state.index >= state.steps.length - 1) return;

    traversalState.update(s => ({ ...s, playing: true }));
    intervalId = setInterval(stepForward, state.speed);
}

export function stopTraversal() {
    closeSession();
    traversalState.update(s => ({ ...s, order: [], steps: [], index: -1, playing: false }));
}

/** Fully clears playback state, including the start node — use when the graph itself is replaced (New/Load). */
export function resetTraversal() {
    stopInterval();
    sessionActive = false;
    traversalState.update(s => ({ ...s, order: [], steps: [], index: -1, playing: false, startNodeId: null }));
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
