import { writable, get, derived } from 'svelte/store';
import { logOpER, erTriageLog } from '../shared/erTriageLog.js';
import { cloneStoreValue } from '../../utils/storeSnapshot.js';

/**
 * A teaching demo: a hospital emergency department's waiting list is a
 * priority queue backed by a binary min-heap. Every patient is triaged to an
 * acuity level 1–5 (1 = resuscitation, most critical; 5 = non-urgent). The
 * department always sees the patient with the lowest level next — ties are
 * broken by arrival order (FIFO within a level) — no matter who walked in
 * first. Admitting sifts a node up the heap; "See next" extracts the root
 * and sifts the replacement down. The learner drives it through the triage
 * board, never the heap array directly.
 *
 * @typedef {{ id: string, name: string, level: number, complaint: string, seq: number }} Patient
 */

/** @type {import('svelte/store').Writable<Patient[]>} binary min-heap, index 0 = root = next seen */
export const erHeap = writable([]);

/** @type {import('svelte/store').Writable<number>} */
export const erSeenCount = writable(0);

/** @type {import('svelte/store').Writable<Patient|null>} */
export const erLastSeen = writable(null);

let patientCounter = 0;
let arrivalCounter = 0;

export const erIsEmpty = derived(erHeap, ($h) => $h.length === 0);
export const erNext = derived(erHeap, ($h) => $h[0] ?? null);
export const erWaiting = derived(erHeap, ($h) => $h.length);

export const ACUITY = {
    1: { label: 'Resuscitation', color: '#e5484d' },
    2: { label: 'Emergent', color: '#e5773e' },
    3: { label: 'Urgent', color: '#e0a13a' },
    4: { label: 'Less urgent', color: '#4ecca3' },
    5: { label: 'Non-urgent', color: '#5b8fff' },
};

/** Heap order: lower level first, then earlier arrival. */
function before(a, b) {
    return a.level - b.level || a.seq - b.seq;
}

/**
 * @param {string} name
 * @param {number} level
 * @param {string} complaint
 * @returns {Patient}
 */
function makePatient(name, level, complaint) {
    const lvl = Math.max(1, Math.min(5, Math.round(Number(level) || 3)));
    return {
        id: `pt_${++patientCounter}`,
        name: String(name ?? '').trim() || 'Unknown patient',
        level: lvl,
        complaint: String(complaint ?? '').trim() || 'Unspecified',
        seq: ++arrivalCounter,
    };
}

export function initErTriage() {
    logOpER(
        [
            'class Patient {',
            '    String name; int level;   // 1 = most critical',
            '}',
            '// min-heap: lowest level first, ties broken by arrival order',
            'PriorityQueue<Patient> er = new PriorityQueue<>(',
            '    Comparator.comparingInt((Patient p) -> p.level)',
            '              .thenComparingLong(p -> p.arrivalSeq));',
        ],
        [
            'import heapq',
            '',
            'class Patient:',
            '    def __init__(self, name, level, seq):',
            '        self.name, self.level, self.seq = name, level, seq',
            '',
            'er = []   # heap of (level, seq, patient) tuples',
        ],
        [
            'struct Patient { std::string name; int level; long seq; };',
            'struct ByAcuity {',
            '    bool operator()(const Patient& a, const Patient& b) const {',
            '        return a.level != b.level ? a.level > b.level : a.seq > b.seq;',
            '    }',
            '};',
            'std::priority_queue<Patient, std::vector<Patient>, ByAcuity> er;',
        ],
    );
}

/**
 * Admit a patient — push onto the heap and sift it up toward the root.
 * @param {string} name
 * @param {number} level
 * @param {string} complaint
 * @returns {Patient}
 */
export function admitPatient(name, level, complaint) {
    const p = makePatient(name, level, complaint);
    const h = [...get(erHeap), p];

    const trail = [];
    let i = h.length - 1;
    while (i > 0) {
        const parent = (i - 1) >> 1;
        if (before(h[i], h[parent])) {
            trail.push(
                `  level ${h[i].level} beats level ${h[parent].level} at index ${parent} → swap up`,
            );
            [h[i], h[parent]] = [h[parent], h[i]];
            i = parent;
        } else {
            trail.push(`  level ${h[i].level} stays under index ${parent} → stop`);
            break;
        }
    }
    if (i === 0 && h.length > 1 && trail.length && trail[trail.length - 1].includes('swap up')) {
        trail.push('  reached the root — highest acuity waiting');
    }
    erHeap.set(h);

    logOpER(
        [
            `er.add(new Patient("${p.name}", ${p.level}));   // sift up — O(log n)`,
            ...trail,
        ],
        [
            `heapq.heappush(er, (${p.level}, ${p.seq}, "${p.name}"))   # sift up — O(log n)`,
            ...trail.map((t) => t.replace('→', '->')),
        ],
        [
            `er.push(Patient{"${p.name}", ${p.level}, ${p.seq}});   // sift up — O(log n)`,
            ...trail.map((t) => t.replace('→', '->')),
        ],
    );
    return p;
}

/**
 * See the next patient — remove the heap root, move the last node into its
 * place and sift it down. Returns the patient seen, or null if empty.
 * @returns {Patient|null}
 */
export function seeNext() {
    const h = [...get(erHeap)];
    if (h.length === 0) return null;

    const seen = h[0];
    const last = h.pop();
    const trail = [];

    if (h.length > 0) {
        h[0] = /** @type {Patient} */ (last);
        let i = 0;
        while (true) {
            const l = 2 * i + 1;
            const r = 2 * i + 2;
            let best = i;
            if (l < h.length && before(h[l], h[best])) best = l;
            if (r < h.length && before(h[r], h[best])) best = r;
            if (best === i) {
                trail.push(`  index ${i} (level ${h[i].level}) settles — heap restored`);
                break;
            }
            trail.push(
                `  level ${h[best].level} at index ${best} beats level ${h[i].level} at ${i} → swap down`,
            );
            [h[i], h[best]] = [h[best], h[i]];
            i = best;
        }
    }
    erHeap.set(h);
    erSeenCount.update((n) => n + 1);
    erLastSeen.set(seen);

    logOpER(
        [
            `Patient p = er.poll();   // "${seen.name}", level ${seen.level} — most critical first`,
            ...(trail.length ? ['// sift down — O(log n)', ...trail] : ['// heap now empty']),
        ],
        [
            `_, _, name = heapq.heappop(er)   # "${seen.name}", level ${seen.level}`,
            ...(trail.length
                ? ['# sift down — O(log n)', ...trail.map((t) => t.replace('→', '->'))]
                : ['# heap now empty']),
        ],
        [
            `Patient p = er.top(); er.pop();   // "${seen.name}", level ${seen.level}`,
            ...(trail.length
                ? ['// sift down — O(log n)', ...trail.map((t) => t.replace('→', '->'))]
                : ['// heap now empty']),
        ],
    );
    return seen;
}

export function clearErTriage() {
    patientCounter = 0;
    arrivalCounter = 0;
    erHeap.set([]);
    erSeenCount.set(0);
    erLastSeen.set(null);
}

export function getSnapshotER() {
    return {
        heap: cloneStoreValue(erHeap),
        seenCount: get(erSeenCount),
        lastSeen: get(erLastSeen),
        patientCounter,
        arrivalCounter,
        codeLog: cloneStoreValue(erTriageLog),
        _type: 'er-triage',
    };
}

/**
 * @param {ReturnType<typeof getSnapshotER>} snapshot
 */
export function applySnapshotER(snapshot) {
    patientCounter = snapshot.patientCounter ?? 0;
    arrivalCounter = snapshot.arrivalCounter ?? 0;
    erHeap.set(snapshot.heap ?? []);
    erSeenCount.set(snapshot.seenCount ?? 0);
    erLastSeen.set(snapshot.lastSeen ?? null);
    if (snapshot.codeLog) erTriageLog.set(snapshot.codeLog);
}
