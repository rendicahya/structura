/**
 * Linear ⇄ circular linked-list conversions.
 *
 * Each function takes a source snapshot (as produced by that structure's
 * `getSnapshot*`) and returns a snapshot tagged with the destination `_type`,
 * ready to hand to {@link requestLoad}. The load pipeline in App.svelte then
 * navigates to the matching page and applies it, so these only need to
 * reshape the plain data.
 *
 *   SLL  ⇄  circular-list          (single `next` ring)
 *   DLL  ⇄  doubly-circular-list   (`next` + `prev` ring)
 *
 * Ring closing: the tail's `next` is pointed back at the head (and, for the
 * doubly case, the head's `prev` at the tail). Ring breaking: those two
 * links are cut back to `null`. Nodes outside the reachable chain/ring are
 * carried over untouched — the garbage collector on the destination page
 * can clear them.
 */

import { walkChain, walkRing } from './linkedList.js';

const ROW_Y = 240;
const ROW_X0 = 120;
const ROW_STEP = 190; // NODE_W (130) + gap (60), matches arrangeNodes()

/** Head = the node no live `next` points at; falls back to the first node. */
function inferHeadId(nodes, headId) {
    if (headId) return headId;
    if (nodes.length === 0) return null;
    const targeted = new Set(nodes.map((n) => n.nextId).filter(Boolean));
    return (nodes.find((n) => !targeted.has(n.id)) ?? nodes[0]).id;
}

/**
 * SLL → singly circular list. Closes the `next` ring and drops canvas
 * coordinates (the circular canvas lays nodes out on a ring by index).
 */
export function sllToCircular(snap) {
    const headId = inferHeadId(snap.nodes, snap.headId);
    const chain = walkChain(snap.nodes, headId);
    const tailId = snap.tailId ?? chain[chain.length - 1]?.id ?? null;

    const nodes = snap.nodes.map(({ x, y, ...n }) => ({
        ...n,
        nextId: n.id === tailId ? headId : n.nextId,
    }));

    return {
        nodes,
        headId,
        tailId,
        counter: snap.counter ?? 0,
        codeLog: snap.codeLog ?? [],
        _type: 'circular-list',
    };
}

/**
 * Singly circular list → SLL. Breaks the ring at the tail and assigns a
 * left-to-right row layout so the chain is readable before the user hits
 * Arrange.
 */
export function circularToSll(snap) {
    const headId = inferHeadId(snap.nodes, snap.headId);
    const ring = walkRing(snap.nodes, headId);
    const ringIds = new Set(ring.map((n) => n.id));
    const tailId = snap.tailId ?? ring[ring.length - 1]?.id ?? null;
    const orderIndex = new Map(ring.map((n, i) => [n.id, i]));

    let extra = ring.length;
    const nodes = snap.nodes.map((n) => {
        const idx = orderIndex.has(n.id) ? orderIndex.get(n.id) : extra++;
        return {
            ...n,
            nextId: n.id === tailId ? null : n.nextId,
            x: ROW_X0 + idx * ROW_STEP,
            y: ROW_Y,
        };
    });

    const edges = ring
        .filter((n) => n.id !== tailId)
        .map((n) => ({ from: n.id, to: n.nextId }))
        .filter((e) => e.to && ringIds.has(e.to));

    return {
        nodes,
        edges,
        headId,
        tailId,
        walkId: null,
        inputId: null,
        counter: snap.counter ?? 0,
        codeLog: snap.codeLog ?? [],
        _type: 'sll',
    };
}

/**
 * DLL → doubly circular list. Closes both the `next` and `prev` rings and
 * drops canvas coordinates.
 */
export function dllToCircular(snap) {
    const headId = inferHeadId(snap.nodes, snap.headId);
    const chain = walkChain(snap.nodes, headId);
    const tailId = snap.tailId ?? chain[chain.length - 1]?.id ?? null;

    const nodes = snap.nodes.map(({ x, y, ...n }) => ({
        ...n,
        nextId: n.id === tailId ? headId : n.nextId,
        prevId: n.id === headId ? tailId : n.prevId,
    }));

    return {
        nodes,
        headId,
        tailId,
        counter: snap.counter ?? 0,
        codeLog: snap.codeLog ?? [],
        _type: 'doubly-circular-list',
    };
}

/**
 * Doubly circular list → DLL. Breaks both rings (tail.next / head.prev) and
 * assigns a left-to-right row layout.
 */
export function circularToDll(snap) {
    const headId = inferHeadId(snap.nodes, snap.headId);
    const ring = walkRing(snap.nodes, headId);
    const ringIds = new Set(ring.map((n) => n.id));
    const tailId = snap.tailId ?? ring[ring.length - 1]?.id ?? null;
    const orderIndex = new Map(ring.map((n, i) => [n.id, i]));

    let extra = ring.length;
    const nodes = snap.nodes.map((n) => {
        const idx = orderIndex.has(n.id) ? orderIndex.get(n.id) : extra++;
        return {
            ...n,
            nextId: n.id === tailId ? null : n.nextId,
            prevId: n.id === headId ? null : n.prevId,
            x: ROW_X0 + idx * ROW_STEP,
            y: ROW_Y,
        };
    });

    const edges = [];
    for (const n of ring) {
        if (n.id !== tailId && n.nextId && ringIds.has(n.nextId)) {
            edges.push({ from: n.id, to: n.nextId, type: 'next' });
        }
        if (n.id !== headId && n.prevId && ringIds.has(n.prevId)) {
            edges.push({ from: n.id, to: n.prevId, type: 'prev' });
        }
    }

    return {
        nodes,
        edges,
        headId,
        tailId,
        walkId: null,
        inputId: null,
        counter: snap.counter ?? 0,
        codeLog: snap.codeLog ?? [],
        _type: 'dll',
    };
}
