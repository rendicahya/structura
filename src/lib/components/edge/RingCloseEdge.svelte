<script>
    import { BaseEdge } from "@xyflow/svelte";

    // The default bezier edge picks its control-point offset from the
    // vertical distance between source and target. Ring closers connect
    // two handles pinned to the same side (both Bottom, or both Top) of
    // nodes sitting on the same row, so that distance is 0 and the "curve"
    // collapses into a straight line. This edge instead draws an explicit
    // quadratic arc that bows away from the row, with the bow direction
    // taken from which side the handles sit on (Bottom -> dip down,
    // Top -> dip up) so it keeps clear of the nodes in between.
    let { id, sourceX, sourceY, targetX, targetY, sourcePosition, markerEnd, style } = $props();

    const sign = $derived(sourcePosition === "top" ? -1 : 1);
    const dip = $derived(Math.min(160, Math.max(55, Math.abs(targetX - sourceX) * 0.22 + 30)));
    const midX = $derived((sourceX + targetX) / 2);
    const baseY = $derived(sign === 1 ? Math.max(sourceY, targetY) : Math.min(sourceY, targetY));
    const midY = $derived(baseY + sign * dip);
    const path = $derived(
        `M ${sourceX},${sourceY} Q ${midX},${midY} ${targetX},${targetY}`,
    );
</script>

<BaseEdge {id} {path} {markerEnd} {style} />
