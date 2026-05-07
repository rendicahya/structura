<svg
    class="empty-illustration"
    viewBox="0 0 240 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
>
    <!-- Left Ground (Prev of Node 1) -->
    <line x1="10" y1="50" x2="30" y2="50" stroke="var(--text-muted)" stroke-width="1.5" />
    <line x1="10" y1="50" x2="10" y2="64" stroke="var(--text-muted)" stroke-width="1.5" />
    <line x1="3" y1="64" x2="17" y2="64" stroke="var(--text-muted)" stroke-width="1.5" />
    <line x1="6" y1="69" x2="14" y2="69" stroke="var(--text-muted)" stroke-width="1.5" />
    <line x1="9" y1="74" x2="11" y2="74" stroke="var(--text-muted)" stroke-width="1.5" />

    <!-- Node 1 -->
    <rect
        x="40"
        y="30"
        width="60"
        height="40"
        rx="8"
        fill="var(--node-bg)"
        stroke="var(--border-bright)"
        stroke-width="1.5"
    />
    <text
        x="70"
        y="46"
        text-anchor="middle"
        font-family="monospace"
        font-size="7"
        fill="var(--accent)">node1</text
    >
    <line
        x1="48"
        y1="50"
        x2="92"
        y2="50"
        stroke="var(--border)"
        stroke-width="1"
    />
    <text
        x="70"
        y="62"
        text-anchor="middle"
        font-family="monospace"
        font-size="9"
        fill="var(--text-muted)">null</text
    >
    <circle
        cx="95"
        cy="44"
        r="3.5"
        fill="var(--accent)"
        class="port-dot next"
    />
    <circle
        cx="45"
        cy="56"
        r="3.5"
        fill="#c792ea"
        class="port-dot prev"
    />

    <!-- Arrow next (atas) -->
    <path
        d="M100 44 H132"
        stroke="var(--accent)"
        stroke-width="1.5"
        stroke-linecap="round"
        class="arrow-line next"
    />
    <polygon
        points="129,40 137,44 129,48"
        fill="var(--accent)"
        class="arrow-head next"
    />

    <!-- Arrow prev (bawah) -->
    <path
        d="M140 56 H108"
        stroke="#c792ea"
        stroke-width="1.5"
        stroke-linecap="round"
        class="arrow-line prev"
    />
    <polygon
        points="111,52 103,56 111,60"
        fill="#c792ea"
        class="arrow-head prev"
    />

    <!-- Node 2 -->
    <rect
        x="140"
        y="30"
        width="60"
        height="40"
        rx="8"
        fill="var(--node-bg)"
        stroke="var(--border-bright)"
        stroke-width="1.5"
    />
    <text
        x="170"
        y="46"
        text-anchor="middle"
        font-family="monospace"
        font-size="7"
        fill="var(--accent)">node2</text
    >
    <line
        x1="148"
        y1="50"
        x2="192"
        y2="50"
        stroke="var(--border)"
        stroke-width="1"
    />
    <text
        x="170"
        y="62"
        text-anchor="middle"
        font-family="monospace"
        font-size="9"
        fill="var(--text-muted)">null</text
    >
    <circle
        cx="195"
        cy="44"
        r="3.5"
        fill="var(--accent)"
        class="port-dot next"
    />
    <circle
        cx="145"
        cy="56"
        r="3.5"
        fill="#c792ea"
        class="port-dot prev"
    />

    <!-- Right Ground (Next of Node 2) -->
    <line x1="210" y1="50" x2="230" y2="50" stroke="var(--text-muted)" stroke-width="1.5" />
    <line x1="230" y1="50" x2="230" y2="64" stroke="var(--text-muted)" stroke-width="1.5" />
    <line x1="223" y1="64" x2="237" y2="64" stroke="var(--text-muted)" stroke-width="1.5" />
    <line x1="226" y1="69" x2="234" y2="69" stroke="var(--text-muted)" stroke-width="1.5" />
    <line x1="229" y1="74" x2="231" y2="74" stroke="var(--text-muted)" stroke-width="1.5" />
</svg>

<style>
    .empty-illustration {
        width: 240px;
        height: 100px;
        opacity: 0.5;
    }

    .port-dot.next {
        animation: pulse 2s ease-in-out infinite;
    }
    .port-dot.prev {
        animation: pulse 2s ease-in-out infinite 1s;
    }

    .arrow-line.next,
    .arrow-head.next {
        animation: fadeFlow 2s ease-in-out infinite;
    }
    .arrow-line.prev,
    .arrow-head.prev {
        animation: fadeFlow 2s ease-in-out infinite 1s;
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
