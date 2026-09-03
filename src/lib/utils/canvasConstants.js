// Shared zoom bounds/step used by every canvas (stack, queue, tree, SLL, DLL, ...).
// Node dimensions are intentionally *not* here — they differ per structure
// and are a legitimate per-component concern, not duplication.
export const ZOOM_STEP = 0.1;
export const ZOOM_MIN = 0.3;
export const ZOOM_MAX = 2;

// Uniform edge styling for every linked-list canvas (SLL, DLL, circular,
// doubly circular). All four render Svelte Flow bezier edges with a closed
// arrowhead — only the colour distinguishes a `next` link from a `prev`
// link. Ring-closing edges reuse the same colours.
export const LIST_EDGE = {
    NEXT_COLOR: '#5b8fff',
    PREV_COLOR: '#c792ea',
};
