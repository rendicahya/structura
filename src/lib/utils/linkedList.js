/**
 * Walks a singly-linked chain of `{ id, nextId }`-shaped nodes starting from
 * `startId`, following `nextId` until it hits a dead end. Used by the
 * linked stack/queue stores both to render the reachable chain and to find
 * unreachable (garbage) nodes.
 * @template {{ id: string, nextId: string|null }} Node
 * @param {Node[]} nodes
 * @param {string|null} startId
 * @returns {Node[]}
 */
export function walkChain(nodes, startId) {
    if (!startId) return [];
    const result = [];
    let current = nodes.find(n => n.id === startId);
    while (current) {
        result.push(current);
        const nextId = current.nextId;
        current = nextId ? nodes.find(n => n.id === nextId) : undefined;
    }
    return result;
}

/**
 * Same traversal as {@link walkChain}, but returns just the reachable ids
 * as a Set — handy for partitioning nodes into reachable/unreachable.
 * @template {{ id: string, nextId: string|null }} Node
 * @param {Node[]} nodes
 * @param {string|null} startId
 * @returns {Set<string>}
 */
export function reachableIds(nodes, startId) {
    return new Set(walkChain(nodes, startId).map(n => n.id));
}

/**
 * Walks a circular singly-linked ring of `{ id, nextId }`-shaped nodes
 * starting from `startId`, following `nextId` until it loops back to
 * `startId`. Unlike {@link walkChain}, a ring never dead-ends on `null` by
 * design — the `seen` guard instead protects against a malformed ring
 * (e.g. mid-edit while a save file is being applied) looping forever.
 * @template {{ id: string, nextId: string|null }} Node
 * @param {Node[]} nodes
 * @param {string|null} startId
 * @returns {Node[]}
 */
export function walkRing(nodes, startId) {
    if (!startId) return [];
    const result = [];
    const seen = new Set();
    let current = nodes.find(n => n.id === startId);
    while (current && !seen.has(current.id)) {
        result.push(current);
        seen.add(current.id);
        if (current.nextId === startId) break;
        current = current.nextId ? nodes.find(n => n.id === current.nextId) : undefined;
    }
    return result;
}

/**
 * Same traversal as {@link walkRing}, but returns just the reachable ids
 * as a Set — handy for partitioning nodes into ring/unreachable.
 * @template {{ id: string, nextId: string|null }} Node
 * @param {Node[]} nodes
 * @param {string|null} startId
 * @returns {Set<string>}
 */
export function reachableRingIds(nodes, startId) {
    return new Set(walkRing(nodes, startId).map(n => n.id));
}

/**
 * Mirror of {@link walkRing} that follows `prevId` instead of `nextId`,
 * used by the doubly circular list to animate a backwards ring traversal
 * from the tail. Same `seen` guard against a malformed ring.
 * @template {{ id: string, prevId: string|null }} Node
 * @param {Node[]} nodes
 * @param {string|null} startId
 * @returns {Node[]}
 */
export function walkRingReverse(nodes, startId) {
    if (!startId) return [];
    const result = [];
    const seen = new Set();
    let current = nodes.find(n => n.id === startId);
    while (current && !seen.has(current.id)) {
        result.push(current);
        seen.add(current.id);
        if (current.prevId === startId) break;
        current = current.prevId ? nodes.find(n => n.id === current.prevId) : undefined;
    }
    return result;
}
