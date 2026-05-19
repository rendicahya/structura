import { writable, get, derived } from 'svelte/store';
import { logOpQueue, queueLog } from '../shared/queueLog.js';

/**
 * @typedef {{ id: string, value: string, index: number }} QueueItem
 */

/** @type {import('svelte/store').Writable<(QueueItem|null)[]>} */
export const queueSlots = writable([]);

/** @type {import('svelte/store').Writable<number>} */
export const queueCapacity = writable(0);

/** @type {import('svelte/store').Writable<number>} */
export const frontPtr = writable(0);

/** @type {import('svelte/store').Writable<number>} */
export const rearPtr = writable(0);

/** @type {import('svelte/store').Writable<number>} */
export const queueSize = writable(0);

/** @type {import('svelte/store').Writable<string>} */
export const queueVarName = writable('queue');

let itemCounter = 0;

export const queueIsFull = derived(
    [queueSize, queueCapacity],
    ([$size, $cap]) => $size >= $cap
);

export const queueIsEmpty = derived(
    queueSize,
    ($size) => $size === 0
);

/**
 * @param {number} capacity
 * @param {string} varName
 */
export function initQueue(capacity, varName) {
    queueCapacity.set(capacity);
    queueVarName.set(varName);
    queueSlots.set(Array(capacity).fill(null));
    frontPtr.set(0);
    rearPtr.set(-1);
    queueSize.set(0);
    itemCounter = 0;

    logOpQueue(
        `int length = ${capacity};\nString[] ${varName} = new String[length];\nint front = 0;\nint rear = -1;`,
        `length = ${capacity}\n${varName} = [None] * length\nfront = 0\nrear = -1`,
        `int length = ${capacity};\nstd::string ${varName}[length];\nint front = 0;\nint rear = -1;`
    );
}

/**
 * @param {string} value
 */
export function enqueue(value) {
    const capacity = get(queueCapacity);
    const size = get(queueSize);
    if (size >= capacity) return false;

    const oldRear = get(rearPtr);
    const rear = (oldRear + 1) % capacity;
    const varName = get(queueVarName);
    const id = `q_${++itemCounter}`;

    queueSlots.update(slots => {
        const updated = [...slots];
        updated[rear] = { id, value, index: rear };
        return updated;
    });

    rearPtr.set(rear);
    queueSize.update(s => s + 1);

    logOpQueue(
        `${varName}[++rear % length] = "${value}";`,
        `rear = (rear + 1) % length\n${varName}[rear] = "${value}"`,
        `${varName}[++rear % length] = "${value}";`
    );

    return true;
}

export function dequeue() {
    const size = get(queueSize);
    if (size === 0) return false;

    const front = get(frontPtr);
    const capacity = get(queueCapacity);
    const varName = get(queueVarName);
    const slot = get(queueSlots)[front];

    const newFront = (front + 1) % capacity;
    frontPtr.set(newFront);
    queueSize.update(s => s - 1);

    logOpQueue(
        `String dequeued = ${varName}[front++ % length]; // "${slot?.value}"`,
        `dequeued = ${varName}[front]  # "${slot?.value}"\nfront = (front + 1) % length`,
        `std::string dequeued = ${varName}[front++ % length]; // "${slot?.value}"`
    );

    return true;
}

export function peekQueue() {
    const size = get(queueSize);
    if (size === 0) return false;

    const front = get(frontPtr);
    const varName = get(queueVarName);
    const slot = get(queueSlots)[front];

    logOpQueue(
        `String peeked = ${varName}[front]; // peek → "${slot?.value}"`,
        `peeked = ${varName}[front]  # peek → "${slot?.value}"`,
        `std::string peeked = ${varName}[front]; // peek → "${slot?.value}"`
    );

    return true;
}

export function clearQueue() {
    queueSlots.set([]);
    queueCapacity.set(0);
    frontPtr.set(0);
    rearPtr.set(-1);
    queueSize.set(0);
    queueVarName.set('queue');
    itemCounter = 0;
}

export function getSnapshotQueue() {
    return {
        slots: JSON.parse(JSON.stringify(get(queueSlots))),
        capacity: get(queueCapacity),
        front: get(frontPtr),
        rear: get(rearPtr),
        size: get(queueSize),
        varName: get(queueVarName),
        counter: itemCounter,
        codeLog: JSON.parse(JSON.stringify(get(queueLog))),
        _type: 'queue',
    };
}

/**
 * @param {ReturnType<typeof getSnapshotQueue>} snapshot
 */
export function applySnapshotQueue(snapshot) {
    itemCounter = snapshot.counter ?? 0;
    queueSlots.set(snapshot.slots ?? []);
    queueCapacity.set(snapshot.capacity ?? 0);
    frontPtr.set(snapshot.front ?? 0);
    rearPtr.set(snapshot.rear ?? 0);
    queueSize.set(snapshot.size ?? 0);
    queueVarName.set(snapshot.varName ?? 'queue');
    queueLog.set(snapshot.codeLog ?? []);
}
