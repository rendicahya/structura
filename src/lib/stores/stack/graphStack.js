import { writable, get, derived } from 'svelte/store';
import { logOpStack, stackLog } from '../shared/stackLog.js';

/**
 * @typedef {{ id: string, value: string, index: number }} StackItem
 */

/** @type {import('svelte/store').Writable<StackItem[]>} */
export const stackItems = writable([]);

/** @type {import('svelte/store').Writable<number>} */
export const stackCapacity = writable(0);

/** @type {import('svelte/store').Writable<string>} */
export const stackVarName = writable('stack');

/** @type {import('svelte/store').Writable<string>} */
export const stackType = writable('int');

let itemCounter = 0;

/** @type {import('svelte/store').Readable<boolean>} */
export const isFull = derived(
  [stackItems, stackCapacity],
  ([$stackItems, $stackCapacity]) => $stackItems.length >= $stackCapacity
);

/** @type {import('svelte/store').Readable<boolean>} */
export const stackIsEmpty = derived(
  stackItems,
  ($stackItems) => $stackItems.length === 0
);

/**
 * @param {string} value
 */
export function pushStack(value) {
  const items = get(stackItems);
  const capacity = get(stackCapacity);
  const varName = get(stackVarName);
  const type = get(stackType);

  if (items.length >= capacity) return false; // overflow handled by caller

  const id = `stack_${++itemCounter}`;
  const newItem = { id, value, index: items.length };

  stackItems.update(s => [...s, newItem]);

  const formattedVal = formatStackValue(value, type);
  logOpStack(
    `${varName}[${newItem.index}] = ${formattedVal}; // push`,
    `${varName}[${newItem.index}] = ${formattedVal}  # push`
  );

  return true;
}

export function popStack() {
  const items = get(stackItems);
  if (items.length === 0) return false; // underflow handled by caller

  const top = items[items.length - 1];
  const varName = get(stackVarName);
  const type = get(stackType);

  logOpStack(
    `${type} popped = ${varName}[${top.index}]; // pop\n${varName}[${top.index}] = 0;`,
    `popped = ${varName}[${top.index}]  # pop\n${varName}[${top.index}] = None`
  );

  stackItems.update(s => s.slice(0, -1));
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
  stackItems.set([]);
  itemCounter = 0;

  logOpStack(
    `${type}[] ${varName} = new ${type}[${capacity}];`,
    `${varName} = [None] * ${capacity}`
  );
}

export function getSnapshotStack() {
  return {
    items: JSON.parse(JSON.stringify(get(stackItems))),
    capacity: get(stackCapacity),
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
  stackVarName.set(snapshot.varName ?? 'stack');
  stackType.set(snapshot.type ?? 'int');
  stackLog.set(snapshot.codeLog ?? []);
}

export function clearStack() {
  stackItems.set([]);
  stackCapacity.set(0);
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