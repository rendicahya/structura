import { writable, get, derived } from 'svelte/store';
import { logOpTR, turnRotationLog } from '../shared/turnRotationLog.js';
import { cloneStoreValue } from '../../utils/storeSnapshot.js';

/**
 * A teaching demo: a game's turn order modelled as a *singly circular* linked
 * list of players. Every player node points to `next`; the last player's
 * `next` loops back to `head`, so "after the last player it's player 1's
 * turn again" costs nothing — no index, no bounds check, just
 * `current = current.next`. A `current` pointer marks whose turn it is.
 *
 * A player joining is linked at the tail and the ring is re-closed
 * (`tail.next = head`). A player leaving is unlinked and their predecessor's
 * `next` is stitched to their successor; if the leaver was `current`, the
 * turn passes to `current.next`.
 *
 * The visual order lives in a plain array; the circular structure is what
 * the generated Java/Python/C++ shows.
 *
 * @typedef {{ id: string, name: string }} Player
 */

/** @type {import('svelte/store').Writable<Player[]>} head → tail order */
export const players = writable([]);

/** @type {import('svelte/store').Writable<string|null>} whose turn it is */
export const currentTurnId = writable(null);

/** Total turns advanced — used to show which lap around the ring we're on. */
export const turnsTaken = writable(0);

let playerCounter = 0;

export const trIsEmpty = derived(players, ($p) => $p.length === 0);
export const trCount = derived(players, ($p) => $p.length);
export const currentTurnIndex = derived(
    [players, currentTurnId],
    ([$p, $c]) => $p.findIndex((x) => x.id === $c),
);
export const currentPlayer = derived(
    [players, currentTurnId],
    ([$p, $c]) => $p.find((x) => x.id === $c) ?? null,
);
/** 1-based lap counter: how many full times the ring has been circled. */
export const roundNumber = derived(
    [players, turnsTaken],
    ([$p, $t]) => ($p.length === 0 ? 0 : Math.floor($t / $p.length) + 1),
);

/**
 * @param {string} name
 * @returns {Player}
 */
function makePlayer(name) {
    return {
        id: `player_${++playerCounter}`,
        name: String(name ?? '').trim() || `Player ${playerCounter}`,
    };
}

export function initTurnRotation() {
    logOpTR(
        [
            'class Player {',
            '    String name;',
            '    Player next;   // last player points back to head',
            '}',
            'Player head, current;',
        ],
        [
            'class Player:',
            '    def __init__(self, name):',
            '        self.name = name',
            '        self.next = None   # last player points back to head',
            '',
            'head = current = None',
        ],
        [
            'struct Player {',
            '    std::string name;',
            '    Player* next = nullptr;   // last player points back to head',
            '};',
            'Player *head = nullptr, *current = nullptr;',
        ],
    );
}

/**
 * Seat a new player at the tail and re-close the ring.
 * @param {string} name
 * @returns {Player}
 */
export function addPlayer(name) {
    const p = makePlayer(name);
    const list = get(players);
    players.set([...list, p]);
    const first = list.length === 0;
    if (first) {
        currentTurnId.set(p.id);
        turnsTaken.set(0);
    }

    logOpTR(
        first
            ? [`Player p = new Player("${p.name}");`, 'head = current = p;', 'p.next = p;   // 1-node ring']
            : [
                  `Player p = new Player("${p.name}");`,
                  'Player t = head;',
                  'while (t.next != head) t = t.next;   // walk to tail',
                  't.next = p;',
                  'p.next = head;   // re-close the ring',
              ],
        first
            ? [`p = Player("${p.name}")`, 'head = current = p', 'p.next = p   # 1-node ring']
            : [
                  `p = Player("${p.name}")`,
                  't = head',
                  'while t.next is not head: t = t.next   # walk to tail',
                  't.next = p',
                  'p.next = head   # re-close the ring',
              ],
        first
            ? [`Player* p = new Player{"${p.name}"};`, 'head = current = p;', 'p->next = p;   // 1-node ring']
            : [
                  `Player* p = new Player{"${p.name}"};`,
                  'Player* t = head;',
                  'while (t->next != head) t = t->next;   // walk to tail',
                  't->next = p;',
                  'p->next = head;   // re-close the ring',
              ],
    );
    return p;
}

/**
 * Advance the turn: one hop along `next`. At the tail this lands back on
 * `head` for free — that is the whole point of the ring.
 */
export function nextTurn() {
    const list = get(players);
    const idx = list.findIndex((x) => x.id === get(currentTurnId));
    if (idx < 0 || list.length === 0) return false;
    const wrapped = idx === list.length - 1;
    currentTurnId.set(list[(idx + 1) % list.length].id);
    turnsTaken.update((n) => n + 1);

    logOpTR(
        wrapped
            ? ['current = current.next;   // tail.next == head → back to player 1']
            : ['current = current.next;'],
        wrapped
            ? ['current = current.next   # tail.next is head → back to player 1']
            : ['current = current.next'],
        wrapped
            ? ['current = current->next;   // tail->next == head → back to player 1']
            : ['current = current->next;'],
    );
    return true;
}

/**
 * A player leaves the game: unlink their node and stitch the predecessor's
 * `next` to the successor. Moves `head`/`current` if they pointed at the
 * leaver.
 * @param {string} id
 */
export function removePlayer(id) {
    const list = get(players);
    const idx = list.findIndex((x) => x.id === id);
    if (idx < 0) return false;

    const leaver = list[idx];
    const wasCurrent = get(currentTurnId) === id;
    const wasHead = idx === 0;
    const next = list.filter((x) => x.id !== id);
    players.set(next);

    if (next.length === 0) {
        currentTurnId.set(null);
        turnsTaken.set(0);
    } else if (wasCurrent) {
        currentTurnId.set((list[idx + 1] ?? list[0]).id);
    }

    logOpTR(
        [
            `// "${leaver.name}" leaves`,
            'Player prev = head;',
            'while (prev.next != node) prev = prev.next;',
            'prev.next = node.next;   // unlink',
            wasHead ? 'head = node.next;' : '// head unchanged',
            wasCurrent ? 'current = node.next;   // turn passes on' : '// current unchanged',
        ],
        [
            `# "${leaver.name}" leaves`,
            'prev = head',
            'while prev.next is not node: prev = prev.next',
            'prev.next = node.next   # unlink',
            wasHead ? 'head = node.next' : '# head unchanged',
            wasCurrent ? 'current = node.next   # turn passes on' : '# current unchanged',
        ],
        [
            `// "${leaver.name}" leaves`,
            'Player* prev = head;',
            'while (prev->next != node) prev = prev->next;',
            'prev->next = node->next;   // unlink',
            wasHead ? 'head = node->next;' : '// head unchanged',
            wasCurrent ? 'current = node->next;   // turn passes on' : '// current unchanged',
        ],
    );
    return true;
}

export function clearTurnRotation() {
    playerCounter = 0;
    players.set([]);
    currentTurnId.set(null);
    turnsTaken.set(0);
}

export function getSnapshotTR() {
    return {
        players: cloneStoreValue(players),
        currentTurnId: get(currentTurnId),
        turnsTaken: get(turnsTaken),
        counter: playerCounter,
        codeLog: cloneStoreValue(turnRotationLog),
        _type: 'turn-rotation',
    };
}

/**
 * @param {ReturnType<typeof getSnapshotTR>} snapshot
 */
export function applySnapshotTR(snapshot) {
    playerCounter = snapshot.counter ?? 0;
    players.set(snapshot.players ?? []);
    currentTurnId.set(snapshot.currentTurnId ?? null);
    turnsTaken.set(snapshot.turnsTaken ?? 0);
    if (snapshot.codeLog) turnRotationLog.set(snapshot.codeLog);
}
