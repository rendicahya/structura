/**
 * Shared Save / Load plumbing for every Structura data structure.
 *
 * Exported files use the `.stc` extension and carry minified JSON with a
 * `_type` tag identifying the structure. On load, App.svelte reads that tag,
 * navigates to the matching page and hands the snapshot to that structure's
 * `applySnapshot` — so a `.stc` always reopens in the right editor regardless
 * of which page the user triggered Load from.
 */

/** Structure type tag → route hash. Keep in sync with App.svelte's pages. */
export const STRUCTURE_ROUTES = {
    sll: '#/linked-list-flow',
    dll: '#/doubly-linked-list-flow',
    'circular-list': '#/circular-linked-list',
    'doubly-circular-list': '#/doubly-circular-linked-list',
    'play-queue': '#/play-queue',
    stack: '#/stack-flow',
    'linked-stack': '#/linked-stack-flow',
    'browser-history': '#/browser-history',
    'print-spooler': '#/print-spooler',
    queue: '#/queue-flow',
    'linked-queue': '#/linked-queue-flow',
    tree: '#/tree-flow',
    bst: '#/bst-flow',
    avl: '#/avl-flow',
    heap: '#/heap-flow',
    hash: '#/hash-flow',
    graph: '#/graph-flow',
};

/**
 * Serialise a snapshot to a minified `.stc` download, tagged with its type.
 * @param {string} type   one of the keys of {@link STRUCTURE_ROUTES}
 * @param {object} snapshot
 */
export function downloadStructure(type, snapshot) {
    const payload = { ...snapshot, _type: type };
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `structura-${type}.stc`;
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * Open a file picker for `.stc` files, parse the selected one and hand the
 * snapshot object to `onParsed`. Calls `onParsed(null)` on a parse error.
 * @param {(snapshot: object|null) => void} onParsed
 */
export function pickStructureFile(onParsed) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.stc';
    input.onchange = (e) => {
        const target = /** @type {HTMLInputElement} */ (e.target);
        const file = target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                onParsed(JSON.parse(/** @type {string} */ (ev.target?.result)));
            } catch {
                onParsed(null);
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

/**
 * Fire the app-wide "load this snapshot" event. App.svelte routes to the
 * right page and applies it. Also used by the SLL⇄DLL converter.
 * @param {object} snapshot  must carry a `_type` field
 * @param {string} [message]  toast shown on success
 */
export function requestLoad(snapshot, message) {
    window.dispatchEvent(
        new CustomEvent('structura:load', { detail: { snapshot, message } }),
    );
}
