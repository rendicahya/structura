import { writable, get, derived } from 'svelte/store';
import { logOpPS, printSpoolerLog } from '../shared/printSpoolerLog.js';
import { cloneStoreValue } from '../../utils/storeSnapshot.js';

/**
 * A teaching demo: a printer's spooler is a FIFO queue of print jobs.
 * "Submit" enqueues a job at the rear; the printer always takes the job at
 * the front (dequeue) — jobs print in exactly the order they were sent, no
 * matter their size. The learner drives it through the printer UI, never
 * the queue directly.
 *
 * @typedef {{ id: string, name: string, pages: number }} Job
 */

/** @type {import('svelte/store').Writable<Job[]>} front = index 0, rear = last */
export const jobs = writable([]);

/** @type {import('svelte/store').Writable<number>} */
export const printedCount = writable(0);

/** @type {import('svelte/store').Writable<Job|null>} */
export const lastPrinted = writable(null);

let jobCounter = 0;

export const spoolerIsEmpty = derived(jobs, ($j) => $j.length === 0);
export const frontJob = derived(jobs, ($j) => $j[0] ?? null);
export const rearJob = derived(jobs, ($j) => $j[$j.length - 1] ?? null);
export const waitingCount = derived(jobs, ($j) => $j.length);
export const pagesPending = derived(jobs, ($j) => $j.reduce((s, x) => s + x.pages, 0));

/**
 * @param {string} name
 * @param {number} pages
 * @returns {Job}
 */
function makeJob(name, pages) {
    const p = Math.max(1, Math.min(500, Math.round(Number(pages) || 1)));
    return {
        id: `job_${++jobCounter}`,
        name: String(name ?? '').trim() || 'Untitled.pdf',
        pages: p,
    };
}

export function initPrintSpooler() {
    logOpPS(
        [
            'class Job {',
            '    String name;',
            '    int pages;',
            '}',
            'Queue<Job> spooler = new LinkedList<>();',
        ],
        [
            'from collections import deque',
            '',
            'class Job:',
            '    def __init__(self, name, pages):',
            '        self.name, self.pages = name, pages',
            '',
            'spooler = deque()',
        ],
        [
            'struct Job {',
            '    std::string name;',
            '    int pages;',
            '};',
            'std::queue<Job> spooler;',
        ],
    );
}

/**
 * Enqueue a print job at the rear of the spooler.
 * @param {string} name
 * @param {number} pages
 * @returns {Job}
 */
export function submitJob(name, pages) {
    const job = makeJob(name, pages);
    jobs.update((q) => [...q, job]);
    logOpPS(
        `spooler.add(new Job("${job.name}", ${job.pages}));  // enqueue at rear`,
        `spooler.append(Job("${job.name}", ${job.pages}))  # enqueue at rear`,
        `spooler.push({"${job.name}", ${job.pages}});  // enqueue at rear`,
    );
    return job;
}

/**
 * Dequeue the job at the front and "send it to the printer". Returns the
 * job, or null if the spooler is empty.
 * @returns {Job|null}
 */
export function printFront() {
    const q = get(jobs);
    if (q.length === 0) return null;

    const [front, ...rest] = q;
    jobs.set(rest);
    printedCount.update((n) => n + 1);
    lastPrinted.set(front);

    logOpPS(
        [
            'Job job = spooler.remove();  // dequeue the front — FIFO',
            `print(job);                  // "${front.name}", ${front.pages}p`,
        ],
        [
            'job = spooler.popleft()  # dequeue the front — FIFO',
            `print_job(job)           # "${front.name}", ${front.pages}p`,
        ],
        [
            'Job job = spooler.front(); spooler.pop();  // dequeue the front — FIFO',
            `printJob(job);                             // "${front.name}", ${front.pages}p`,
        ],
    );
    return front;
}

export function clearPrintSpooler() {
    jobCounter = 0;
    jobs.set([]);
    printedCount.set(0);
    lastPrinted.set(null);
}

export function getSnapshotPS() {
    return {
        jobs: cloneStoreValue(jobs),
        printedCount: get(printedCount),
        lastPrinted: get(lastPrinted),
        counter: jobCounter,
        codeLog: cloneStoreValue(printSpoolerLog),
        _type: 'print-spooler',
    };
}

/**
 * @param {ReturnType<typeof getSnapshotPS>} snapshot
 */
export function applySnapshotPS(snapshot) {
    jobCounter = snapshot.counter ?? 0;
    jobs.set(snapshot.jobs ?? []);
    printedCount.set(snapshot.printedCount ?? 0);
    lastPrinted.set(snapshot.lastPrinted ?? null);
    if (snapshot.codeLog) printSpoolerLog.set(snapshot.codeLog);
}
