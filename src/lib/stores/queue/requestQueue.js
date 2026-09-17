import { writable, get, derived } from 'svelte/store';
import { logOpRQ, requestQueueLog } from '../shared/requestQueueLog.js';
import { cloneStoreValue } from '../../utils/storeSnapshot.js';

/**
 * A teaching demo: a web server's incoming HTTP requests form a FIFO queue.
 * "Submit" enqueues a request at the rear; the server always handles the
 * request at the front (dequeue) — requests are served in exactly the order
 * they arrived, no matter how expensive a later one is. The learner drives
 * it through the server UI, never the queue directly.
 *
 * @typedef {{ id: string, method: string, path: string, ms: number }} Request
 */

/** @type {import('svelte/store').Writable<Request[]>} front = index 0, rear = last */
export const requests = writable([]);

/** @type {import('svelte/store').Writable<number>} */
export const handledCount = writable(0);

/** @type {import('svelte/store').Writable<Request|null>} */
export const lastHandled = writable(null);

let requestCounter = 0;

export const queueIsEmpty = derived(requests, ($r) => $r.length === 0);
export const frontRequest = derived(requests, ($r) => $r[0] ?? null);
export const rearRequest = derived(requests, ($r) => $r[$r.length - 1] ?? null);
export const waitingCount = derived(requests, ($r) => $r.length);
export const msPending = derived(requests, ($r) => $r.reduce((s, x) => s + x.ms, 0));

/**
 * @param {string} method
 * @param {string} path
 * @param {number} ms
 * @returns {Request}
 */
function makeRequest(method, path, ms) {
    const m = Math.max(20, Math.min(3000, Math.round(Number(ms) || 1)));
    return {
        id: `req_${++requestCounter}`,
        method: String(method ?? 'GET').toUpperCase(),
        path: String(path ?? '').trim() || '/',
        ms: m,
    };
}

export function initRequestQueue() {
    logOpRQ(
        [
            'class Request {',
            '    String method;',
            '    String path;',
            '    int ms;',
            '}',
            'Queue<Request> incoming = new LinkedList<>();',
        ],
        [
            'from collections import deque',
            '',
            'class Request:',
            '    def __init__(self, method, path, ms):',
            '        self.method, self.path, self.ms = method, path, ms',
            '',
            'incoming = deque()',
        ],
        [
            'struct Request {',
            '    std::string method;',
            '    std::string path;',
            '    int ms;',
            '};',
            'std::queue<Request> incoming;',
        ],
    );
}

/**
 * Enqueue an incoming request at the rear of the queue.
 * @param {string} method
 * @param {string} path
 * @param {number} ms
 * @returns {Request}
 */
export function submitRequest(method, path, ms) {
    const req = makeRequest(method, path, ms);
    requests.update((q) => [...q, req]);
    logOpRQ(
        `incoming.add(new Request("${req.method}", "${req.path}", ${req.ms}));  // enqueue at rear`,
        `incoming.append(Request("${req.method}", "${req.path}", ${req.ms}))  # enqueue at rear`,
        `incoming.push({"${req.method}", "${req.path}", ${req.ms}});  // enqueue at rear`,
    );
    return req;
}

/**
 * Dequeue the request at the front and "handle" it. Returns the request, or
 * null if the queue is empty.
 * @returns {Request|null}
 */
export function handleFront() {
    const q = get(requests);
    if (q.length === 0) return null;

    const [front, ...rest] = q;
    requests.set(rest);
    handledCount.update((n) => n + 1);
    lastHandled.set(front);

    logOpRQ(
        [
            'Request req = incoming.remove();  // dequeue the front — FIFO',
            `handle(req);                      // "${front.method} ${front.path}", ${front.ms}ms`,
        ],
        [
            'req = incoming.popleft()  # dequeue the front — FIFO',
            `handle(req)               # "${front.method} ${front.path}", ${front.ms}ms`,
        ],
        [
            'Request req = incoming.front(); incoming.pop();  // dequeue the front — FIFO',
            `handle(req);                                     // "${front.method} ${front.path}", ${front.ms}ms`,
        ],
    );
    return front;
}

export function clearRequestQueue() {
    requestCounter = 0;
    requests.set([]);
    handledCount.set(0);
    lastHandled.set(null);
}

export function getSnapshotRQ() {
    return {
        requests: cloneStoreValue(requests),
        handledCount: get(handledCount),
        lastHandled: get(lastHandled),
        counter: requestCounter,
        codeLog: cloneStoreValue(requestQueueLog),
        _type: 'request-queue',
    };
}

/**
 * @param {ReturnType<typeof getSnapshotRQ>} snapshot
 */
export function applySnapshotRQ(snapshot) {
    requestCounter = snapshot.counter ?? 0;
    requests.set(snapshot.requests ?? []);
    handledCount.set(snapshot.handledCount ?? 0);
    lastHandled.set(snapshot.lastHandled ?? null);
    if (snapshot.codeLog) requestQueueLog.set(snapshot.codeLog);
}
