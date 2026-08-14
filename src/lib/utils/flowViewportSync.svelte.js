import { untrack } from "svelte";

// Shared viewport-sync/remount logic for every *Flow.svelte canvas. Keep the
// returned object as-is and access .viewport/.flowGen through it — do NOT
// destructure the return value, since that captures the getter's current
// value once instead of the live accessor and silently breaks reactivity.
export function createFlowViewportSync({ getZoom, setZoom }) {
    let viewport = $state({ x: 0, y: 0, zoom: 1 });
    let flowGen = $state(0);
    let userInteracted = false;

    $effect(() => {
        const z = getZoom();
        untrack(() => {
            if (z === viewport.zoom) return;
            viewport = { ...viewport, zoom: z };
            if (!userInteracted) flowGen++;
        });
    });

    function onMoveEnd(event, vp) {
        userInteracted = true;
        setZoom(vp.zoom);
    }

    // Per-structure recentering code (centerStack, centerTree, ...) writes a
    // new x/y into `viewport` directly, then calls this to force Svelte
    // Flow to reseed its internal transform from that new position — same
    // remount mechanism as the zoom-sync $effect above, just triggered from
    // outside instead of from a `zoom` prop change.
    function remount() {
        flowGen++;
    }

    return {
        get viewport() {
            return viewport;
        },
        set viewport(v) {
            viewport = v;
        },
        get flowGen() {
            return flowGen;
        },
        onMoveEnd,
        remount,
    };
}
