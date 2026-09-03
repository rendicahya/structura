import { writable, get, derived } from 'svelte/store';
import { logOpPQ, playQueueLog } from '../shared/playQueueLog.js';
import { cloneStoreValue } from '../../utils/storeSnapshot.js';

/**
 * A teaching demo: a music player's "Up Next" queue modelled as a doubly
 * linked list of tracks. A `current` pointer marks the now-playing track;
 * ⏭ / ⏮ just walk it along `next` / `prev`. "Add to queue" links a node at
 * the tail; "Play next" splices a node in right after `current` — relinking
 * only its two neighbours, no shifting. The learner drives it through the
 * player UI, never the list directly.
 *
 * The visual order is kept in a plain array; the doubly-linked structure is
 * what the generated Java/Python/C++ shows.
 *
 * @typedef {{ id: string, title: string, artist: string }} Track
 */

/** @type {import('svelte/store').Writable<Track[]>} head → tail order */
export const tracks = writable([]);

/** @type {import('svelte/store').Writable<string|null>} */
export const currentId = writable(null);

let trackCounter = 0;

export const pqIsEmpty = derived(tracks, ($t) => $t.length === 0);
export const currentIndex = derived(
    [tracks, currentId],
    ([$t, $c]) => $t.findIndex((x) => x.id === $c),
);
export const currentTrack = derived(
    [tracks, currentId],
    ([$t, $c]) => $t.find((x) => x.id === $c) ?? null,
);
export const canNext = derived(
    [tracks, currentIndex],
    ([$t, $i]) => $i >= 0 && $i < $t.length - 1,
);
export const canPrev = derived(currentIndex, ($i) => $i > 0);

/**
 * @param {string} title
 * @param {string} artist
 * @returns {Track}
 */
function makeTrack(title, artist) {
    return {
        id: `track_${++trackCounter}`,
        title: String(title ?? '').trim() || 'Untitled',
        artist: String(artist ?? '').trim() || 'Unknown Artist',
    };
}

/** @param {Track} t */
const j = (t) => `new Track("${t.title}", "${t.artist}")`;

export function initPlayQueue() {
    logOpPQ(
        [
            'class Track {',
            '    String title, artist;',
            '    Track prev, next;',
            '}',
            'Track head, tail, current;',
        ],
        [
            'class Track:',
            '    def __init__(self, title, artist):',
            '        self.title, self.artist = title, artist',
            '        self.prev = self.next = None',
            '',
            'head = tail = current = None',
        ],
        [
            'struct Track {',
            '    std::string title, artist;',
            '    Track *prev = nullptr, *next = nullptr;',
            '};',
            'Track *head = nullptr, *tail = nullptr, *current = nullptr;',
        ],
    );
}

/**
 * Link a new track at the tail of the queue.
 * @param {string} title
 * @param {string} artist
 * @returns {Track}
 */
export function addToQueue(title, artist) {
    const t = makeTrack(title, artist);
    const list = get(tracks);
    tracks.set([...list, t]);
    const first = list.length === 0;
    if (first) currentId.set(t.id);

    logOpPQ(
        first
            ? [`Track t = ${j(t)};`, 'head = tail = current = t;']
            : [`Track t = ${j(t)};`, 't.prev = tail;', 'tail.next = t;', 'tail = t;'],
        first
            ? [`t = Track("${t.title}", "${t.artist}")`, 'head = tail = current = t']
            : [`t = Track("${t.title}", "${t.artist}")`, 't.prev = tail', 'tail.next = t', 'tail = t'],
        first
            ? [`Track* t = ${j(t)};`, 'head = tail = current = t;']
            : [`Track* t = ${j(t)};`, 't->prev = tail;', 'tail->next = t;', 'tail = t;'],
    );
    return t;
}

/**
 * Splice a new track in immediately after `current` — an O(1) relink of two
 * neighbours, the move an array can't match.
 * @param {string} title
 * @param {string} artist
 * @returns {Track}
 */
export function playNext(title, artist) {
    const list = get(tracks);
    const idx = list.findIndex((x) => x.id === get(currentId));
    if (idx < 0) return addToQueue(title, artist);

    const t = makeTrack(title, artist);
    tracks.set([...list.slice(0, idx + 1), t, ...list.slice(idx + 1)]);
    const atTail = idx === list.length - 1;

    logOpPQ(
        [
            `Track t = ${j(t)};`,
            't.prev = current;',
            't.next = current.next;',
            atTail ? 'tail = t;' : 'current.next.prev = t;',
            'current.next = t;',
            '// only current and its old next are touched — O(1)',
        ],
        [
            `t = Track("${t.title}", "${t.artist}")`,
            't.prev = current',
            't.next = current.next',
            atTail ? 'tail = t' : 'current.next.prev = t',
            'current.next = t',
            '# only current and its old next are touched — O(1)',
        ],
        [
            `Track* t = ${j(t)};`,
            't->prev = current;',
            't->next = current->next;',
            atTail ? 'tail = t;' : 'current->next->prev = t;',
            'current->next = t;',
            '// only current and its old next are touched — O(1)',
        ],
    );
    return t;
}

/** ⏭ — walk `current` one step along `next`. */
export function nextTrack() {
    const list = get(tracks);
    const idx = list.findIndex((x) => x.id === get(currentId));
    if (idx < 0 || idx >= list.length - 1) return false;
    currentId.set(list[idx + 1].id);
    logOpPQ('current = current.next;', 'current = current.next', 'current = current->next;');
    return true;
}

/** ⏮ — walk `current` one step along `prev`. */
export function prevTrack() {
    const idx = get(currentIndex);
    if (idx <= 0) return false;
    currentId.set(get(tracks)[idx - 1].id);
    logOpPQ('current = current.prev;', 'current = current.prev', 'current = current->prev;');
    return true;
}

/**
 * Tap a track in the queue: the player walks the links from `current` until
 * it lands on the tapped node.
 * @param {string} id
 */
export function jumpTo(id) {
    const list = get(tracks);
    const from = get(currentIndex);
    const to = list.findIndex((x) => x.id === id);
    if (to < 0 || to === from) return false;
    currentId.set(id);

    const dir = to > from ? 'next' : 'prev';
    logOpPQ(
        [`while (current != target) current = current.${dir};`],
        [`while current is not target:\n    current = current.${dir}`],
        [`while (current != target) current = current->${dir};`],
    );
    return true;
}

/**
 * Unlink a track and stitch its neighbours together.
 * @param {string} id
 */
export function removeTrack(id) {
    const list = get(tracks);
    const idx = list.findIndex((x) => x.id === id);
    if (idx < 0) return false;

    const removed = list[idx];
    const wasCurrent = get(currentId) === id;
    const next = list.filter((x) => x.id !== id);
    tracks.set(next);

    if (next.length === 0) currentId.set(null);
    else if (wasCurrent) currentId.set((list[idx + 1] ?? list[idx - 1]).id);

    logOpPQ(
        [
            `// remove "${removed.title}"`,
            'if (node.prev != null) node.prev.next = node.next; else head = node.next;',
            'if (node.next != null) node.next.prev = node.prev; else tail = node.prev;',
            wasCurrent ? 'current = node.next != null ? node.next : node.prev;' : '// current unchanged',
        ],
        [
            `# remove "${removed.title}"`,
            'if node.prev: node.prev.next = node.next',
            'else: head = node.next',
            'if node.next: node.next.prev = node.prev',
            'else: tail = node.prev',
            wasCurrent ? 'current = node.next or node.prev' : '# current unchanged',
        ],
        [
            `// remove "${removed.title}"`,
            'if (node->prev) node->prev->next = node->next; else head = node->next;',
            'if (node->next) node->next->prev = node->prev; else tail = node->prev;',
            wasCurrent ? 'current = node->next ? node->next : node->prev;' : '// current unchanged',
        ],
    );
    return true;
}

export function clearPlayQueue() {
    trackCounter = 0;
    tracks.set([]);
    currentId.set(null);
}

export function getSnapshotPQ() {
    return {
        tracks: cloneStoreValue(tracks),
        currentId: get(currentId),
        counter: trackCounter,
        codeLog: cloneStoreValue(playQueueLog),
        _type: 'play-queue',
    };
}

/**
 * @param {ReturnType<typeof getSnapshotPQ>} snapshot
 */
export function applySnapshotPQ(snapshot) {
    trackCounter = snapshot.counter ?? 0;
    tracks.set(snapshot.tracks ?? []);
    currentId.set(snapshot.currentId ?? null);
    if (snapshot.codeLog) playQueueLog.set(snapshot.codeLog);
}
