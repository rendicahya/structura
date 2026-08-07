import { writable, get, derived } from 'svelte/store';
import { logOpGraph, graphLog } from '../shared/graphLog.js';
import { formatValue, formatPythonValue, formatCppValue } from '../../utils/formatters.js';
import { cloneStoreValue } from '../../utils/storeSnapshot.js';
import { toast } from '../shared/toast.js';

/**
 * @typedef {{ id: string, varName: string, data: string, x: number, y: number }} GraphNode
 * @typedef {{ from: string, to: string }} GraphEdge
 */

/** @type {import('svelte/store').Writable<GraphNode[]>} */
export const graphNodes = writable([]);

/** @type {import('svelte/store').Writable<GraphEdge[]>} */
export const graphEdges = writable([]);

let nodeCounter = 0;

export const graphIsEmpty = derived(
    graphNodes,
    ($nodes) => $nodes.length === 0
);

export function initGraph() {
    logOpGraph(
        `class Node {\n    String data;\n    List<Node> neighbors = new ArrayList<>();\n}`,
        `class Node:\n    def __init__(self, data=None):\n        self.data = data\n        self.neighbors = []`,
        `struct Node {\n    std::string data;\n    std::vector<Node*> neighbors;\n};`
    );
}

/**
 * @param {{x: number, y: number}} position
 * @param {string} [data]
 * @returns {string} the new node's id
 */
export function addGraphNode(position, data = '') {
    const id = `graph_${++nodeCounter}`;
    const varName = `node${nodeCounter}`;

    /** @type {GraphNode} */
    const newNode = { id, varName, data, x: position.x, y: position.y };

    graphNodes.update(ns => [...ns, newNode]);

    logOpGraph(
        `Node ${varName} = new Node();`,
        `${varName} = Node()`,
        `Node* ${varName} = new Node();`
    );

    return id;
}

/**
 * @param {string} nodeId
 * @param {Partial<GraphNode>} patch
 * @param {boolean} [silent]
 */
export function updateGraphNode(nodeId, patch, silent = false) {
    const ns = get(graphNodes);
    const old = ns.find(n => n.id === nodeId);
    graphNodes.update(ns => ns.map(n => n.id === nodeId ? { ...n, ...patch } : n));

    if (!silent && old && patch.data !== undefined && patch.data !== old.data) {
        const updated = get(graphNodes).find(n => n.id === nodeId);
        if (!updated) return;
        const val = formatValue(patch.data);
        const pyVal = formatPythonValue(patch.data);
        const cppVal = formatCppValue(patch.data);
        logOpGraph(
            `${updated.varName}.data = ${val};`,
            `${updated.varName}.data = ${pyVal}`,
            `${updated.varName}->data = ${cppVal};`
        );
    }
}

/**
 * @param {string} fromId
 * @param {string} toId
 */
export function addEdge(fromId, toId) {
    if (fromId === toId) {
        toast.info("A node can't connect to itself");
        return;
    }

    const alreadyExists = get(graphEdges).some(e => e.from === fromId && e.to === toId);
    if (alreadyExists) {
        toast.info('Edge already exists');
        return;
    }

    const ns = get(graphNodes);
    const from = ns.find(n => n.id === fromId);
    const to = ns.find(n => n.id === toId);
    if (!from || !to) return;

    graphEdges.update(es => [...es, { from: fromId, to: toId }]);

    logOpGraph(
        `${from.varName}.neighbors.add(${to.varName});`,
        `${from.varName}.neighbors.append(${to.varName})`,
        `${from.varName}->neighbors.push_back(${to.varName});`
    );
}

/**
 * @param {string} fromId
 * @param {string} toId
 */
export function removeEdge(fromId, toId) {
    const ns = get(graphNodes);
    const from = ns.find(n => n.id === fromId);
    const to = ns.find(n => n.id === toId);

    graphEdges.update(es => es.filter(e => !(e.from === fromId && e.to === toId)));

    if (from && to) {
        logOpGraph(
            `// remove edge: ${from.varName} -> ${to.varName}`,
            `# remove edge: ${from.varName} -> ${to.varName}`,
            `// remove edge: ${from.varName} -> ${to.varName}`
        );
    }
}

/**
 * Removes a node and every edge touching it (both directions).
 * @param {string} nodeId
 */
export function removeGraphNode(nodeId) {
    const ns = get(graphNodes);
    const node = ns.find(n => n.id === nodeId);
    if (!node) return;

    const touching = get(graphEdges).filter(e => e.from === nodeId || e.to === nodeId);
    const javaOps = [];
    const pyOps = [];
    const cppOps = [];

    touching.forEach(e => {
        const from = ns.find(n => n.id === e.from);
        const to = ns.find(n => n.id === e.to);
        if (from && to) {
            javaOps.push(`// remove edge: ${from.varName} -> ${to.varName}`);
            pyOps.push(`# remove edge: ${from.varName} -> ${to.varName}`);
            cppOps.push(`// remove edge: ${from.varName} -> ${to.varName}`);
        }
    });

    javaOps.push(`// delete ${node.varName}`);
    pyOps.push(`# delete ${node.varName}`);
    cppOps.push(`// delete ${node.varName};`);

    graphEdges.update(es => es.filter(e => e.from !== nodeId && e.to !== nodeId));
    graphNodes.update(ns => ns.filter(n => n.id !== nodeId));

    logOpGraph(javaOps, pyOps, cppOps);
}

export function getSnapshotGraph() {
    return {
        nodes: cloneStoreValue(graphNodes),
        edges: cloneStoreValue(graphEdges),
        counter: nodeCounter,
        codeLog: cloneStoreValue(graphLog),
        _type: 'graph',
    };
}

/**
 * @param {ReturnType<typeof getSnapshotGraph>} snapshot
 */
export function applySnapshotGraph(snapshot) {
    nodeCounter = snapshot.counter ?? 0;
    graphNodes.set(snapshot.nodes ?? []);
    graphEdges.set(snapshot.edges ?? []);
    graphLog.set(snapshot.codeLog ?? []);
}

export function resetGraph() {
    graphNodes.set([]);
    graphEdges.set([]);
    nodeCounter = 0;
}
