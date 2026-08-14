import { writable, get, derived } from 'svelte/store';
import { logOpHeap, heapLog } from '../shared/heapLog.js';
import { cloneStoreValue } from '../../utils/storeSnapshot.js';

/**
 * @typedef {{ id: string, value: number }} HeapItem
 */

/** @type {import('svelte/store').Writable<HeapItem[]>} */
export const heapItems = writable([]);

/** @type {import('svelte/store').Writable<number>} */
export const heapCapacity = writable(0);

/** @type {import('svelte/store').Writable<'min'|'max'>} */
export const heapMode = writable('min');

/** @type {import('svelte/store').Writable<string>} */
export const heapVarName = writable('heap');

let itemCounter = 0;

const NODE_W = 68;
const MIN_GAP = 24;
const LEVEL_H = 100;

export const heapIsEmpty = derived(heapItems, ($items) => $items.length === 0);
export const heapIsFull = derived(
    [heapItems, heapCapacity],
    ([$items, $cap]) => $cap > 0 && $items.length >= $cap
);

/**
 * @param {number} childVal
 * @param {number} parentVal
 * @param {'min'|'max'} mode
 */
function shouldSwap(childVal, parentVal, mode) {
    return mode === 'min' ? childVal < parentVal : childVal > parentVal;
}

/**
 * Closed-form position of array index `index` within a complete binary
 * tree of `total` nodes. A heap's shape is always fully complete, so
 * position never needs a recursive pointer-walk the way graphTree.js's
 * layoutTree does — it's a pure function of index and total count,
 * recomputed fresh by the canvas on every render rather than stored.
 *
 * Every parent's x is exactly the average of its two children's x. While
 * a level is only partially filled, a lone child sits offset toward its
 * eventual grid slot rather than centered under its parent — expected,
 * and resolves once its sibling is inserted.
 * @param {number} index
 * @param {number} total
 */
export function heapNodePosition(index, total) {
    const maxDepth = 31 - Math.clz32(total);
    const depth = 31 - Math.clz32(index + 1);
    const levelStart = (1 << depth) - 1;
    const posInLevel = index - levelStart;
    const slotsInLevel = 1 << depth;
    const slotsAtMaxDepth = 1 << maxDepth;
    const unit = slotsAtMaxDepth / slotsInLevel;

    return {
        x: (posInLevel * unit + unit / 2) * (NODE_W + MIN_GAP),
        y: depth * LEVEL_H,
    };
}

/**
 * @param {number} capacity
 * @param {string} varName
 * @param {'min'|'max'} mode
 */
export function initHeap(capacity, varName, mode) {
    heapCapacity.set(capacity);
    heapVarName.set(varName);
    heapMode.set(mode);
    heapItems.set([]);
    itemCounter = 0;

    logOpHeap(
        `int[] ${varName} = new int[${capacity}];\nint size = 0;`,
        `${varName} = [None] * ${capacity}\nsize = 0`,
        `int ${varName}[${capacity}];\nint size = 0;`
    );
}

/**
 * Value-driven insert: appends to the next free array slot, then sifts
 * up while the heap property (min or max, per `heapMode`) is violated.
 * @param {string} rawValue
 * @returns {'ok'|'empty'|'invalid'|'full'}
 */
export function insertHeap(rawValue) {
    const trimmed = (rawValue ?? '').trim();
    if (trimmed === '') return 'empty';

    const value = Number(trimmed);
    if (Number.isNaN(value)) return 'invalid';

    const items = get(heapItems);
    const capacity = get(heapCapacity);
    if (items.length >= capacity) return 'full';

    const mode = get(heapMode);
    const varName = get(heapVarName);
    const index = items.length;
    const id = `heap_${++itemCounter}`;

    heapItems.update((arr) => [...arr, { id, value }]);

    const javaOps = [`${varName}[${index}] = ${value};`, `size++;`];
    const pyOps = [`${varName}[${index}] = ${value}`, `size += 1`];
    const cppOps = [`${varName}[${index}] = ${value};`, `size++;`];

    let i = index;
    while (i > 0) {
        const p = Math.floor((i - 1) / 2);
        const arr = get(heapItems);
        const swap = shouldSwap(arr[i].value, arr[p].value, mode);
        const op = mode === 'min' ? '<' : '>';
        const outcome = swap ? 'swap' : 'stop';

        javaOps.push(`// compare ${varName}[${i}] (${arr[i].value}) ${op} ${varName}[${p}] (${arr[p].value}) -> ${outcome}`);
        pyOps.push(`# compare ${varName}[${i}] (${arr[i].value}) ${op} ${varName}[${p}] (${arr[p].value}) -> ${outcome}`);
        cppOps.push(`// compare ${varName}[${i}] (${arr[i].value}) ${op} ${varName}[${p}] (${arr[p].value}) -> ${outcome}`);

        if (!swap) break;

        heapItems.update((arr2) => {
            const updated = [...arr2];
            [updated[i], updated[p]] = [updated[p], updated[i]];
            return updated;
        });

        javaOps.push(`swap(${varName}, ${i}, ${p});`);
        pyOps.push(`${varName}[${i}], ${varName}[${p}] = ${varName}[${p}], ${varName}[${i}]`);
        cppOps.push(`swap(${varName}[${i}], ${varName}[${p}]);`);

        i = p;
    }

    logOpHeap(javaOps, pyOps, cppOps);
    return 'ok';
}

/**
 * Standard extract-root: moves the last element to the root, shrinks the
 * array, then sifts down from the root while the heap property is
 * violated.
 * @returns {number|null} the extracted root value, or null if empty
 */
export function extractRoot() {
    const items = get(heapItems);
    if (items.length === 0) return null;

    const mode = get(heapMode);
    const varName = get(heapVarName);
    const rootValue = items[0].value;

    const javaOps = [`int root = ${varName}[0]; // ${rootValue}`];
    const pyOps = [`root = ${varName}[0]  # ${rootValue}`];
    const cppOps = [`int root = ${varName}[0]; // ${rootValue}`];

    if (items.length === 1) {
        heapItems.set([]);
        javaOps.push(`size = 0;`);
        pyOps.push(`size = 0`);
        cppOps.push(`size = 0;`);
        logOpHeap(javaOps, pyOps, cppOps);
        return rootValue;
    }

    const last = items[items.length - 1];
    heapItems.update((arr) => {
        const updated = arr.slice(0, -1);
        updated[0] = last;
        return updated;
    });

    javaOps.push(`${varName}[0] = ${varName}[size - 1]; size--;`);
    pyOps.push(`${varName}[0] = ${varName}[size - 1]\nsize -= 1`);
    cppOps.push(`${varName}[0] = ${varName}[size - 1]; size--;`);

    let i = 0;
    while (true) {
        const arr = get(heapItems);
        const n = arr.length;
        const l = 2 * i + 1;
        const r = 2 * i + 2;
        let best = i;

        if (l < n && shouldSwap(arr[l].value, arr[best].value, mode)) best = l;
        if (r < n && shouldSwap(arr[r].value, arr[best].value, mode)) best = r;

        if (best === i) {
            javaOps.push(`// compare children of ${varName}[${i}] -> no swap needed`);
            pyOps.push(`# compare children of ${varName}[${i}] -> no swap needed`);
            cppOps.push(`// compare children of ${varName}[${i}] -> no swap needed`);
            break;
        }

        javaOps.push(`// compare children of ${varName}[${i}] -> swap with ${varName}[${best}]`);
        pyOps.push(`# compare children of ${varName}[${i}] -> swap with ${varName}[${best}]`);
        cppOps.push(`// compare children of ${varName}[${i}] -> swap with ${varName}[${best}]`);

        heapItems.update((arr2) => {
            const updated = [...arr2];
            [updated[i], updated[best]] = [updated[best], updated[i]];
            return updated;
        });

        javaOps.push(`swap(${varName}, ${i}, ${best});`);
        pyOps.push(`${varName}[${i}], ${varName}[${best}] = ${varName}[${best}], ${varName}[${i}]`);
        cppOps.push(`swap(${varName}[${i}], ${varName}[${best}]);`);

        i = best;
    }

    logOpHeap(javaOps, pyOps, cppOps);
    return rootValue;
}

export function clearHeap() {
    heapItems.set([]);
    heapCapacity.set(0);
    heapVarName.set('heap');
    heapMode.set('min');
    itemCounter = 0;
}

export function resetHeap() {
    heapItems.set([]);
    heapCapacity.set(0);
    heapVarName.set('heap');
    heapMode.set('min');
    itemCounter = 0;
}

export function getSnapshotHeap() {
    return {
        items: cloneStoreValue(heapItems),
        capacity: get(heapCapacity),
        mode: get(heapMode),
        varName: get(heapVarName),
        counter: itemCounter,
        codeLog: cloneStoreValue(heapLog),
        _type: 'heap',
    };
}

/**
 * @param {ReturnType<typeof getSnapshotHeap>} snapshot
 */
export function applySnapshotHeap(snapshot) {
    itemCounter = snapshot.counter ?? 0;
    heapItems.set(snapshot.items ?? []);
    heapCapacity.set(snapshot.capacity ?? 0);
    heapMode.set(snapshot.mode ?? 'min');
    heapVarName.set(snapshot.varName ?? 'heap');
    heapLog.set(snapshot.codeLog ?? []);
}
