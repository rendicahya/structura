<svg
    class="empty-illustration"
    viewBox="0 0 240 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
>
    <!-- Left Ground (Prev of Node 1) -->
    <!-- From Port Prev (45, 56) to Left -->
    <line x1="45" y1="56" x2="25" y2="56" stroke="var(--text-muted)" stroke-width="1.5" />
    <line x1="25" y1="56" x2="25" y2="70" stroke="var(--text-muted)" stroke-width="1.5" />
    <line x1="18" y1="70" x2="32" y2="70" stroke="var(--text-muted)" stroke-width="1.5" />
    <line x1="21" y1="75" x2="29" y2="75" stroke="var(--text-muted)" stroke-width="1.5" />
    <line x1="24" y1="80" x2="26" y2="80" stroke="var(--text-muted)" stroke-width="1.5" />

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
    <!-- From Port Next (195, 44) to Right -->
    <line x1="195" y1="44" x2="215" y2="44" stroke="var(--text-muted)" stroke-width="1.5" />
    <line x1="215" y1="44" x2="215" y2="58" stroke="var(--text-muted)" stroke-width="1.5" />
    <line x1="208" y1="58" x2="222" y2="58" stroke="var(--text-muted)" stroke-width="1.5" />
    <line x1="211" y1="63" x2="219" y2="63" stroke="var(--text-muted)" stroke-width="1.5" />
    <line x1="214" y1="68" x2="216" y2="68" stroke="var(--text-muted)" stroke-width="1.5" />
</svg>

<style>
    .empty-illustration {
        width: 300px;
        height: 125px;
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
