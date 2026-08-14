import { writable, get, derived } from 'svelte/store';
import { logOpHash, hashLog } from '../shared/hashLog.js';
import { cloneStoreValue } from '../../utils/storeSnapshot.js';

/**
 * @typedef {{ id: string, varName: string, value: string, bucketIndex: number, nextId: string|null }} HashEntry
 */

/** @type {import('svelte/store').Writable<number>} */
export const hashCapacity = writable(0);

/** @type {import('svelte/store').Writable<HashEntry[]>} */
export const hashEntries = writable([]);

/** @type {import('svelte/store').Writable<string>} */
export const hashVarName = writable('table');

let entryCounter = 0;

export const hashIsEmpty = derived(hashEntries, ($e) => $e.length === 0);

/**
 * Shared with the canvas so a toolbar-triggered search can drive the
 * canvas's highlight rendering (mirrors how the Tree family's
 * traversalState is shared between toolbar and canvas), rather than
 * living purely as local canvas state the way Stack's read-only Peek
 * does — Peek is only ever triggered from the canvas itself, but Search
 * here is triggered from the toolbar, so the highlight has to live
 * somewhere both components can see.
 * @type {import('svelte/store').Writable<{ bucketIndex: number, foundId: string|null }|null>}
 */
export const hashSearchState = writable(null);

/** @type {ReturnType<typeof setTimeout>|null} */
let searchClearTimeout = null;

/**
 * Simple sum-of-char-codes hash — easy to log, easy to verify by hand.
 * @param {string} value
 * @param {number} capacity
 * @returns {number}
 */
export function hashOf(value, capacity) {
    let sum = 0;
    for (let i = 0; i < value.length; i++) sum += value.charCodeAt(i);
    return sum % capacity;
}

/**
 * @param {number} capacity
 * @param {string} varName
 */
export function initHash(capacity, varName) {
    hashCapacity.set(capacity);
    hashVarName.set(varName);
    hashEntries.set([]);
    entryCounter = 0;

    logOpHash(
        `Node[] ${varName} = new Node[${capacity}];`,
        `${varName} = [None] * ${capacity}`,
        `Node* ${varName}[${capacity}] = {};`
    );
}

/**
 * Hash-SET semantics: value-driven insert that appends to the tail of
 * its bucket's chain, rejecting exact duplicates anywhere in the table
 * (same policy as the BST/Heap/AVL pages).
 * @param {string} value
 * @returns {boolean} true if inserted, false if empty/duplicate
 */
export function insertHash(value) {
    const trimmed = (value ?? '').trim();
    if (trimmed === '') return false;

    const entries = get(hashEntries);
    if (entries.some((e) => e.value === trimmed)) return false;

    const capacity = get(hashCapacity);
    const varName = get(hashVarName);
    const bucketIndex = hashOf(trimmed, capacity);

    let sum = 0;
    for (let i = 0; i < trimmed.length; i++) sum += trimmed.charCodeAt(i);

    const javaOps = [
        `// hash("${trimmed}") = (sum of char codes) % ${capacity} = ${sum} % ${capacity} = ${bucketIndex}`,
    ];
    const pyOps = [
        `# hash("${trimmed}") = (sum of char codes) % ${capacity} = ${sum} % ${capacity} = ${bucketIndex}`,
    ];
    const cppOps = [
        `// hash("${trimmed}") = (sum of char codes) % ${capacity} = ${sum} % ${capacity} = ${bucketIndex}`,
    ];

    const tail = entries.find((e) => e.bucketIndex === bucketIndex && e.nextId === null);
    const id = `hash_${++entryCounter}`;
    const varNameNode = `node${entryCounter}`;

    /** @type {HashEntry} */
    const newEntry = { id, varName: varNameNode, value: trimmed, bucketIndex, nextId: null };

    javaOps.push(`Node ${varNameNode} = new Node();`);
    pyOps.push(`${varNameNode} = Node()`);
    cppOps.push(`Node* ${varNameNode} = new Node();`);

    if (tail) {
        javaOps.push(`${tail.varName}.next = ${varNameNode};`);
        pyOps.push(`${tail.varName}.next = ${varNameNode}`);
        cppOps.push(`${tail.varName}->next = ${varNameNode};`);
    } else {
        javaOps.push(`${varName}[${bucketIndex}] = ${varNameNode};`);
        pyOps.push(`${varName}[${bucketIndex}] = ${varNameNode}`);
        cppOps.push(`${varName}[${bucketIndex}] = ${varNameNode};`);
    }

    hashEntries.update((es) => {
        const updated = tail ? es.map((e) => (e.id === tail.id ? { ...e, nextId: id } : e)) : es;
        return [...updated, newEntry];
    });

    logOpHash(javaOps, pyOps, cppOps);
    return true;
}

/**
 * @param {string} entryId
 */
export function deleteHashEntry(entryId) {
    const entries = get(hashEntries);
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;

    const varName = get(hashVarName);
    const predecessor = entries.find((e) => e.nextId === entryId);

    const javaOps = [];
    const pyOps = [];
    const cppOps = [];

    if (predecessor) {
        javaOps.push(`${predecessor.varName}.next = ${entry.varName}.next;`);
        pyOps.push(`${predecessor.varName}.next = ${entry.varName}.next`);
        cppOps.push(`${predecessor.varName}->next = ${entry.varName}->next;`);
    } else {
        const nextVarName = entry.nextId ? entries.find((e) => e.id === entry.nextId)?.varName : null;
        javaOps.push(`${varName}[${entry.bucketIndex}] = ${nextVarName ?? 'null'};`);
        pyOps.push(`${varName}[${entry.bucketIndex}] = ${nextVarName ?? 'None'}`);
        cppOps.push(`${varName}[${entry.bucketIndex}] = ${nextVarName ?? 'nullptr'};`);
    }

    hashEntries.update((es) => {
        const updated = predecessor
            ? es.map((e) => (e.id === predecessor.id ? { ...e, nextId: entry.nextId } : e))
            : es;
        return updated.filter((e) => e.id !== entryId);
    });

    logOpHash(javaOps, pyOps, cppOps);
}

/**
 * Read-only: computes the target bucket, walks its chain logging one
 * comparison per entry, and sets a temporary highlight cleared after
 * 1.5s. No pushHistory() — same non-mutating convention as Stack's Peek.
 * @param {string} value
 */
export function searchHash(value) {
    const trimmed = (value ?? '').trim();
    if (trimmed === '') return;

    const capacity = get(hashCapacity);
    if (capacity === 0) return;

    const varName = get(hashVarName);
    const bucketIndex = hashOf(trimmed, capacity);
    const chain = get(hashEntries).filter((e) => e.bucketIndex === bucketIndex);

    const javaOps = [`// hash("${trimmed}") -> bucket ${bucketIndex}`];
    const pyOps = [`# hash("${trimmed}") -> bucket ${bucketIndex}`];
    const cppOps = [`// hash("${trimmed}") -> bucket ${bucketIndex}`];

    let foundId = null;
    let cursor = `${varName}[${bucketIndex}]`;
    for (const entry of chain) {
        const match = entry.value === trimmed;
        javaOps.push(`// compare ${cursor} (${entry.value}) == "${trimmed}" -> ${match ? 'FOUND' : 'next'}`);
        pyOps.push(`# compare ${cursor} (${entry.value}) == "${trimmed}" -> ${match ? 'FOUND' : 'next'}`);
        cppOps.push(`// compare ${cursor} (${entry.value}) == "${trimmed}" -> ${match ? 'FOUND' : 'next'}`);
        if (match) {
            foundId = entry.id;
            break;
        }
        cursor = `${entry.varName}.next`;
    }

    if (!foundId) {
        javaOps.push('// NOT FOUND');
        pyOps.push('# NOT FOUND');
        cppOps.push('// NOT FOUND');
    }

    logOpHash(javaOps, pyOps, cppOps);

    if (searchClearTimeout) clearTimeout(searchClearTimeout);
    hashSearchState.set({ bucketIndex, foundId });
    searchClearTimeout = setTimeout(() => {
        hashSearchState.set(null);
        searchClearTimeout = null;
    }, 1500);
}

export function clearHash() {
    hashEntries.set([]);
    hashCapacity.set(0);
    hashVarName.set('table');
    entryCounter = 0;
}

export function resetHash() {
    hashEntries.set([]);
    hashCapacity.set(0);
    hashVarName.set('table');
    entryCounter = 0;
    if (searchClearTimeout) {
        clearTimeout(searchClearTimeout);
        searchClearTimeout = null;
    }
    hashSearchState.set(null);
}

export function getSnapshotHash() {
    return {
        entries: cloneStoreValue(hashEntries),
        capacity: get(hashCapacity),
        varName: get(hashVarName),
        counter: entryCounter,
        codeLog: cloneStoreValue(hashLog),
        _type: 'hash',
    };
}

/**
 * @param {ReturnType<typeof getSnapshotHash>} snapshot
 */
export function applySnapshotHash(snapshot) {
    entryCounter = snapshot.counter ?? 0;
    hashEntries.set(snapshot.entries ?? []);
    hashCapacity.set(snapshot.capacity ?? 0);
    hashVarName.set(snapshot.varName ?? 'table');
    hashLog.set(snapshot.codeLog ?? []);
}
