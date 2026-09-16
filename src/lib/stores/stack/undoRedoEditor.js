import { writable, get, derived } from 'svelte/store';
import { logOpUR, undoRedoLog } from '../shared/undoRedoLog.js';
import { cloneStoreValue } from '../../utils/storeSnapshot.js';

/**
 * A teaching demo: a text editor's Undo/Redo modelled with two stacks.
 * `undoStack` holds the document's text before each edit (top = what Undo
 * would restore); `redoStack` holds the text an Undo just stepped away from
 * (top = what Redo would restore). The learner never touches the stacks
 * directly — only Type / Undo / Redo.
 */

/** @type {import('svelte/store').Writable<string>} */
export const documentText = writable('');

/** @typedef {{ id: string, text: string }} Snapshot */

/** Stack 1 — text snapshots taken right before each edit. */
/** @type {import('svelte/store').Writable<Snapshot[]>} */
export const undoStack = writable([]);

/** Stack 2 — text snapshots stepped away from by Undo. */
/** @type {import('svelte/store').Writable<Snapshot[]>} */
export const redoStack = writable([]);

export const canUndoEdit = derived(undoStack, ($u) => $u.length > 0);
export const canRedoEdit = derived(redoStack, ($r) => $r.length > 0);

let snapCounter = 0;

/** @param {string} text */
function makeSnapshot(text) {
    return { id: `snap_${++snapCounter}`, text };
}

export function initUndoRedo() {
    logOpUR(
        [
            'Deque<String> undo = new ArrayDeque<>(); // stack 1: text before each edit',
            'Deque<String> redo = new ArrayDeque<>(); // stack 2: text undone away',
            'String document = "";',
        ],
        [
            'undo = []       # stack 1: text before each edit',
            'redo = []       # stack 2: text undone away',
            'document = ""',
        ],
        [
            'std::stack<std::string> undo; // stack 1: text before each edit',
            'std::stack<std::string> redo; // stack 2: text undone away',
            'std::string document;',
        ],
    );
}

/**
 * Type text and commit it (press Enter). The document's current text is
 * pushed onto the undo stack, and — because this is a brand-new edit — the
 * redo stack is thrown away.
 * @param {string} raw
 * @returns {boolean}
 */
export function typeText(raw) {
    if (!raw) return false;

    const cur = get(documentText);
    undoStack.update((s) => [...s, makeSnapshot(cur)]);
    documentText.set(cur + raw);
    redoStack.set([]);

    logOpUR(
        [
            `// type("${raw}")`,
            'undo.push(document);   // remember the text before this edit',
            `document += "${raw}";`,
            'redo.clear();          // a new edit kills the redo history',
        ],
        [
            `# type("${raw}")`,
            'undo.append(document)  # remember the text before this edit',
            `document += "${raw}"`,
            'redo.clear()           # a new edit kills the redo history',
        ],
        [
            `// type("${raw}")`,
            'undo.push(document);',
            `document += "${raw}";`,
            'while (!redo.empty()) redo.pop();',
        ],
    );
    return true;
}

/**
 * Undo: the current text is pushed onto the redo stack, and the top of the
 * undo stack becomes the current text.
 * @returns {boolean}
 */
export function undoEdit() {
    const stack = get(undoStack);
    if (stack.length === 0) return false;

    const cur = get(documentText);
    redoStack.update((s) => [...s, makeSnapshot(cur)]);
    const prev = stack[stack.length - 1];
    undoStack.set(stack.slice(0, -1));
    documentText.set(prev.text);

    logOpUR(
        [
            '// undo',
            'redo.push(document);    // current text goes onto stack 2',
            'document = undo.pop();  // previous text comes off stack 1',
        ],
        [
            '# undo',
            'redo.append(document)   # current text goes onto stack 2',
            'document = undo.pop()   # previous text comes off stack 1',
        ],
        [
            '// undo',
            'redo.push(document);',
            'document = undo.top(); undo.pop();',
        ],
    );
    return true;
}

/**
 * Redo: the mirror image of Undo — the current text goes back onto the undo
 * stack, and the top of the redo stack becomes the current text.
 * @returns {boolean}
 */
export function redoEdit() {
    const stack = get(redoStack);
    if (stack.length === 0) return false;

    const cur = get(documentText);
    undoStack.update((s) => [...s, makeSnapshot(cur)]);
    const next = stack[stack.length - 1];
    redoStack.set(stack.slice(0, -1));
    documentText.set(next.text);

    logOpUR(
        [
            '// redo',
            'undo.push(document);    // current text goes back onto stack 1',
            'document = redo.pop();  // next text comes off stack 2',
        ],
        [
            '# redo',
            'undo.append(document)   # current text goes back onto stack 1',
            'document = redo.pop()   # next text comes off stack 2',
        ],
        [
            '// redo',
            'undo.push(document);',
            'document = redo.top(); redo.pop();',
        ],
    );
    return true;
}

export function resetUndoRedo() {
    snapCounter = 0;
    documentText.set('');
    undoStack.set([]);
    redoStack.set([]);
}

export function getSnapshotUR() {
    return {
        documentText: get(documentText),
        undoStack: cloneStoreValue(undoStack),
        redoStack: cloneStoreValue(redoStack),
        counter: snapCounter,
        codeLog: cloneStoreValue(undoRedoLog),
        _type: 'undo-redo',
    };
}

/**
 * @param {ReturnType<typeof getSnapshotUR>} snapshot
 */
export function applySnapshotUR(snapshot) {
    snapCounter = snapshot.counter ?? 0;
    documentText.set(snapshot.documentText ?? '');
    undoStack.set(snapshot.undoStack ?? []);
    redoStack.set(snapshot.redoStack ?? []);
    if (snapshot.codeLog) undoRedoLog.set(snapshot.codeLog);
}
