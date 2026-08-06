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
