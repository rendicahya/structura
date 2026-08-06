// Shared zoom bounds/step used by every canvas (stack, queue, tree, SLL, DLL, ...).
// Node dimensions are intentionally *not* here — they differ per structure
// and are a legitimate per-component concern, not duplication.
export const ZOOM_STEP = 0.1;
export const ZOOM_MIN = 0.3;
export const ZOOM_MAX = 2;
