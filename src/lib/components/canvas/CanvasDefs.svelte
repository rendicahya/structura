<script>
    const { panX = 0, panY = 0, zoom = 1, markerPrefix = '' } = $props();
</script>

<defs>
    <pattern
        id="grid"
        width={28}
        height={28}
        patternUnits="userSpaceOnUse"
        patternTransform="translate({panX}, {panY}) scale({zoom})"
    >
        <circle cx="14" cy="14" r="0.8" fill="var(--border)" />
    </pattern>

    <marker
        id="arrow-solid{markerPrefix ? '-' + markerPrefix : ''}"
        viewBox="0 0 10 10"
        refX="8"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto-start-reverse"
    >
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#5b8fff" />
    </marker>

    <marker
        id="arrow-pending{markerPrefix ? '-' + markerPrefix : ''}"
        viewBox="0 0 10 10"
        refX="8"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto-start-reverse"
    >
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#f0b429" />
    </marker>

    {#if markerPrefix === 'dll'}
        <marker
            id="arrow-prev-dll"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
        >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#c792ea" />
        </marker>
    {/if}
</defs>
