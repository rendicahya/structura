<svg
    class="empty-illustration"
    viewBox="0 0 200 80"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
>
    <!-- Node 1 -->
    <rect
        x="10"
        y="20"
        width="60"
        height="40"
        rx="8"
        fill="var(--node-bg)"
        stroke="var(--border-bright)"
        stroke-width="1.5"
    />
    <text
        x="40"
        y="36"
        text-anchor="middle"
        font-family="monospace"
        font-size="7"
        fill="var(--accent)">node1</text
    >
    <line
        x1="18"
        y1="40"
        x2="52"
        y2="40"
        stroke="var(--border)"
        stroke-width="1"
    />
    <text
        x="40"
        y="52"
        text-anchor="middle"
        font-family="monospace"
        font-size="9"
        fill="var(--text-muted)">null</text
    >
    <circle cx="65" cy="40" r="4" fill="var(--accent)" class="port-dot" />

    <!-- Arrow -->
    <path
        d="M69 40 H105"
        stroke="var(--accent)"
        stroke-width="1.5"
        stroke-linecap="round"
        class="arrow-line"
    />
    <polygon
        points="102,36 110,40 102,44"
        fill="var(--accent)"
        class="arrow-head"
    />

    <!-- Node 2 -->
    <rect
        x="110"
        y="20"
        width="60"
        height="40"
        rx="8"
        fill="var(--node-bg)"
        stroke="var(--border-bright)"
        stroke-width="1.5"
    />
    <text
        x="140"
        y="36"
        text-anchor="middle"
        font-family="monospace"
        font-size="7"
        fill="var(--accent)">node2</text
    >
    <line
        x1="118"
        y1="40"
        x2="152"
        y2="40"
        stroke="var(--border)"
        stroke-width="1"
    />
    <text
        x="140"
        y="52"
        text-anchor="middle"
        font-family="monospace"
        font-size="9"
        fill="var(--text-muted)">null</text
    >

    <!-- Ground symbol -->
    <line
        x1="165"
        y1="40"
        x2="182"
        y2="40"
        stroke="var(--text-muted)"
        stroke-width="1.5"
    />
    <line
        x1="182"
        y1="40"
        x2="182"
        y2="54"
        stroke="var(--text-muted)"
        stroke-width="1.5"
    />
    <line
        x1="175"
        y1="54"
        x2="189"
        y2="54"
        stroke="var(--text-muted)"
        stroke-width="1.5"
    />
    <line
        x1="177"
        y1="59"
        x2="187"
        y2="59"
        stroke="var(--text-muted)"
        stroke-width="1.5"
    />
    <line
        x1="179"
        y1="64"
        x2="185"
        y2="64"
        stroke="var(--text-muted)"
        stroke-width="1.5"
    />
</svg>

<style>
    .empty-illustration {
        width: 200px;
        height: 80px;
        opacity: 0.5;
    }
    .port-dot {
        animation: pulse 2s ease-in-out infinite;
    }
    .arrow-line,
    .arrow-head {
        animation: fadeFlow 2s ease-in-out infinite;
    }
    @keyframes pulse {
        0%,
        100% {
            opacity: 0.4;
        }
        50% {
            opacity: 1;
        }
    }
    @keyframes fadeFlow {
        0%,
        100% {
            opacity: 0.3;
        }
        50% {
            opacity: 1;
        }
    }
</style>
