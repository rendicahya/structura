import { writable, get, derived } from 'svelte/store';
import { logOpStack, stackLog } from '../shared/stackLog.js';

/**
 * @typedef {{ id: string, value: string, index: number }} StackItem
 */

/** @type {import('svelte/store').Writable<(StackItem|null)[]>} */
export const stackItems = writable([]);

/** @type {import('svelte/store').Writable<number>} */
export const stackCapacity = writable(0);

/** @type {import('svelte/store').Writable<number>} */
export const topPtr = writable(-1);

/** @type {import('svelte/store').Writable<string>} */
export const stackVarName = writable('stack');

/** @type {import('svelte/store').Writable<string>} */
export const stackType = writable('int');

let itemCounter = 0;

/** @type {import('svelte/store').Readable<boolean>} */
export const stackIsFull = derived(
    [topPtr, stackCapacity],
    ([$top, $cap]) => $cap > 0 && $top >= $cap - 1
);

/** @type {import('svelte/store').Readable<boolean>} */
export const stackIsEmpty = derived(
    topPtr,
    ($top) => $top === -1
);

/**
 * @param {string} value
 */
export function pushStack(value) {
    const top = get(topPtr);
    const capacity = get(stackCapacity);
    const varName = get(stackVarName);
    const type = get(stackType);

    if (top >= capacity - 1) return false;

    const nextTop = top + 1;
    const id = `stack_${++itemCounter}`;
    const newItem = { id, value, index: nextTop };
    
    stackItems.update(s => {
        const updated = [...s];
        updated[nextTop] = newItem;
        return updated;
    });
    topPtr.set(nextTop);

    const formattedVal = formatStackValue(value, type);

    logOpStack(
        `${varName}[++top] = ${formattedVal};`,
        `top += 1\n${varName}[top] = ${formattedVal}`,
        `${varName}[++top] = ${formattedVal};`
    );
    return true;
}

export function popStack() {
    const top = get(topPtr);
    if (top === -1) return false;

    const varName = get(stackVarName);
    const type = get(stackType);
    const cppType = type === 'String' ? 'std::string' : type;

    topPtr.set(top - 1);

    logOpStack(
        `${type} popped = ${varName}[top--];`,
        `popped = ${varName}[top]\ntop -= 1`,
        `${cppType} popped = ${varName}[top--];`
    );
    return true;
}

/**
 * @param {number} capacity
 * @param {string} varName
 * @param {string} type
 */
export function initStack(capacity, varName, type) {
    stackCapacity.set(capacity);
    stackVarName.set(varName);
    stackType.set(type);
    stackItems.set(Array(capacity).fill(null));
    topPtr.set(-1);
    itemCounter = 0;
    const cppType = type === 'String' ? 'std::string' : type;

    logOpStack(
        `${type}[] ${varName} = new ${type}[${capacity}];\nint top = -1;`,
        `${varName} = [None] * ${capacity}\ntop = -1`,
        `${cppType} ${varName}[${capacity}];\nint top = -1;`
    );
}

export function getSnapshotStack() {
    return {
        items: JSON.parse(JSON.stringify(get(stackItems))),
        capacity: get(stackCapacity),
        top: get(topPtr),
        varName: get(stackVarName),
        type: get(stackType),
        counter: itemCounter,
        codeLog: JSON.parse(JSON.stringify(get(stackLog))),
        _type: 'stack',
    };
}

/**
 * @param {ReturnType<typeof getSnapshotStack>} snapshot
 */
export function applySnapshotStack(snapshot) {
    itemCounter = snapshot.counter ?? 0;
    stackItems.set(snapshot.items ?? []);
    stackCapacity.set(snapshot.capacity ?? 0);
    topPtr.set(snapshot.top ?? -1);
    stackVarName.set(snapshot.varName ?? 'stack');
    stackType.set(snapshot.type ?? 'int');
    stackLog.set(snapshot.codeLog ?? []);
}

export function clearStack() {
    stackItems.set([]);
    stackCapacity.set(0);
    topPtr.set(-1);
    stackVarName.set('stack');
    stackType.set('int');
    itemCounter = 0;
}

/**
 * @param {string} val
 * @param {string} type
 * @returns {string}
 */
function formatStackValue(val, type) {
    if (type === 'String') return `"${val}"`;
    return val || '0';
}