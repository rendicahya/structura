<script>
    let {
        fromX = 0,
        fromY = 0,
        toX = 0,
        toY = 0,
        pending = false,
        type = "next",
        markerPrefix = "",
    } = $props();

    let cx = $derived((fromX + toX) / 2);
    let cy = $derived(Math.min(fromY, toY) - 40);
    let color = $derived(
        pending ? "#f0b429" : type === "prev" ? "#c792ea" : "#5b8fff",
    );
    let markerId = $derived(
        (pending
            ? "arrow-pending"
            : type === "prev"
              ? "arrow-prev"
              : "arrow-solid") + (markerPrefix ? `-${markerPrefix}` : ""),
    );
</script>

<g class="edge">
    <path
        d="M {fromX} {fromY} Q {cx} {cy} {toX} {toY}"
        fill="none"
        stroke={color}
        stroke-width="1.8"
        stroke-dasharray={pending ? "5 4" : "none"}
        marker-end="url(#{markerId})"
        opacity={pending ? 0.8 : 1}
    />
</g>

<style>
    .edge {
        pointer-events: none;
    }
</style>
