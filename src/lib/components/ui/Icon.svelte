<script>
    const { name, size = 14, ...rest } = $props();

    const icons = {
        plus: `
            <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.5" />
            <path d="M7 4v6M4 7h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        `,
        arrange: `
            <rect x="1" y="5" width="3" height="4" rx="1" stroke="currentColor" stroke-width="1.3" />
            <rect x="5.5" y="5" width="3" height="4" rx="1" stroke="currentColor" stroke-width="1.3" />
            <rect x="10" y="5" width="3" height="4" rx="1" stroke="currentColor" stroke-width="1.3" />
            <line x1="4" y1="7" x2="5.5" y2="7" stroke="currentColor" stroke-width="1.3" />
            <line x1="8.5" y1="7" x2="10" y2="7" stroke="currentColor" stroke-width="1.3" />
        `,
        gc: `
            <path d="M7 2C4.2 2 2 4.2 2 7s2.2 5 5 5 5-2.2 5-5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
            <path d="M9 2h3v3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M9 5l3-3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
            <path d="M5 7l1.5 1.5L9 5.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
        `,
        zoomOut: `
            <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.4" />
            <path d="M4.5 6.5h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
            <path d="M10.5 10.5L13 13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
        `,
        zoomIn: `
            <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.4" />
            <path d="M4.5 6.5h4M6.5 4.5v4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
            <path d="M10.5 10.5L13 13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
        `,
        undo: `
            <path d="M3 6H10C12.2 6 14 7.8 14 10C14 12.2 12.2 14 10 14H5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            <path d="M5.5 3.5L3 6L5.5 8.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        `,
        redo: `
            <path d="M13 6H6C3.8 6 2 7.8 2 10C2 12.2 3.8 14 6 14H11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            <path d="M10.5 3.5L13 6L10.5 8.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        `,
        save: `
            <path d="M2 10V12H12V10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            <path d="M7 2V9M4.5 6.5L7 9L9.5 6.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        `,
        load: `
            <path d="M2 10V12H12V10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            <path d="M7 9V2M4.5 4.5L7 2L9.5 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        `,
        new: `
            <rect x="2" y="2" width="10" height="10" rx="2" stroke="currentColor" stroke-width="1.4" />
            <path d="M5 7h4M7 5v4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
        `,
        code: `
            <rect x="1" y="2" width="13" height="11" rx="2" stroke="currentColor" stroke-width="1.4" />
            <line x1="9" y1="2" x2="9" y2="13" stroke="currentColor" stroke-width="1.4" />
            <path d="M11 6l2 1.5-2 1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
        `,
        shortcuts: `
            <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" stroke-width="1.4" />
            <path d="M5.5 6C5.5 4.9 6.3 4 7.5 4S9.5 4.9 9.5 6C9.5 7 8.5 7.5 7.5 8v1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
            <circle cx="7.5" cy="10.5" r="0.6" fill="currentColor" />
        `,
        close: `
            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        `,
        push: `
            <path d="M7 4v6M4 7l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        `,
        pop: `
            <path d="M7 4v6M4 7l3-3 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        `,
        enqueue: `
            <path d="M9 6.5H4M6.5 4l2.5 2.5-2.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
        `,
        dequeue: `
            <path d="M4 6.5h5M6.5 4l-2.5 2.5 2.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
        `,
        peek: `
            <circle cx="6.5" cy="6.5" r="4" stroke="currentColor" stroke-width="1.3" />
            <circle cx="6.5" cy="6.5" r="1.5" fill="currentColor" />
        `,
        rename: `
            <path d="M2 11h10M4 9l1.5 1.5M4 9V3h4l2 2v4H4z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
        `,
        edit: `
            <path d="M2 11.5l1.5-1.5 7-7 1.5 1.5-7 7L2 11.5z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
        `,
        head: `
            <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" stroke-width="1.3" />
            <path d="M4.5 6.5h4M6.5 4.5l2 2-2 2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
        `,
        tail: `
            <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" stroke-width="1.3" />
            <path d="M8.5 6.5h-4M6.5 4.5l-2 2 2 2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
        `,
        walk: `
            <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" stroke-width="1.3" />
            <circle cx="6.5" cy="6.5" r="1.5" fill="currentColor" />
            <path d="M6.5 2V1M6.5 12v-1M2 6.5H1M12 6.5h-1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
        `,
        disconnect: `
            <path d="M4 4L9 9M9 4L4 9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
        `,
        unlink: `
            <path d="M2 6.5h2.5M8.5 6.5H11M4.5 6.5C4.5 5.1 5.6 4 7 4s2.5 1.1 2.5 2.5S8.4 9 7 9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
        `
    };

    let viewBox = $derived(name.startsWith('zoom') ? '0 0 15 15' : name.startsWith('undo') || name.startsWith('redo') ? '0 0 16 16' : '0 0 14 14');
</script>

<svg
    width={size}
    height={size}
    viewBox={viewBox}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...rest}
>
    {@html icons[name] || ''}
</svg>
