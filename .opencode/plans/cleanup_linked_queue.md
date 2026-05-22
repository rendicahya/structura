# Plan: Cleanup Linked List Queue Visuals

## Objective
Remove the "unreachable" text labels and hide arrows from dequeued nodes in the Linked List Queue visualization to provide a cleaner UI.

## Steps
1. **Modify `src/lib/components/canvas/CanvasLinkedQueue.svelte`**:
    - Locate the arrow rendering logic (`{#if node.nextId}`).
    - Update the condition to `{#if node.nextId && !isUnreachable}` to hide arrows from dequeued nodes.
    - Locate and remove the SVG `<text>` block that renders the "unreachable" label below the nodes.
    - Locate and remove the `ctx-label` containing "Unreachable — waiting for GC" from the context menu logic.

## Verification
- Run the application.
- Enqueue several items.
- Dequeue one item.
- Verify that the dequeued node moves to the left, its arrow disappears, and the "unreachable" text is gone.
- Right-click the dequeued node and verify the "Unreachable" label is missing from the menu.
