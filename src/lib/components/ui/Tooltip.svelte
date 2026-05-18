<script>
    export let text = "";
    export let shortcut = "";

    let visible = false;

    function show() {
        visible = true;
    }

    function hide() {
        visible = false;
    }
</script>

<div
    class="tooltip-wrapper"
    role="group"
    onmouseenter={show}
    onmouseleave={hide}
    onfocusin={show}
    onfocusout={hide}
>
    <slot />
    {#if visible && text}
        <div class="tooltip">
            <span class="tooltip-text">{text}</span>
            {#if shortcut}
                <span class="tooltip-shortcut">{shortcut}</span>
            {/if}
        </div>
    {/if}
</div>

<style>
    .tooltip-wrapper {
        display: inline-flex;
        position: relative;
    }

    .tooltip {
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        margin-top: 8px;
        z-index: 10000;
        background: var(--surface2);
        border: 1px solid var(--border-bright);
        border-radius: 6px;
        padding: 5px 9px;
        display: flex;
        align-items: center;
        gap: 7px;
        white-space: nowrap;
        pointer-events: none;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        animation: tipIn 0.1s ease;
    }

    @keyframes tipIn {
        from {
            opacity: 0;
            transform: translateX(-50%) translateY(-3px);
        }
        to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
    }

    .tooltip-text {
        font-family: var(--font-ui);
        font-size: 12px;
        font-weight: 500;
        color: var(--text);
    }

    .tooltip-shortcut {
        font-family: var(--font-mono);
        font-size: 10px;
        color: var(--text-muted);
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 4px;
        padding: 1px 5px;
    }
</style>
