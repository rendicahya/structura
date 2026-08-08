<script>
    const { data } = $props();
</script>

<div
    class="queue-slot-node"
    class:is-empty={data.isEmpty}
    class:is-dequeued={data.isDequeued}
    class:is-front={data.isFront}
    class:is-rear={data.isRear}
    class:is-peeking={data.isPeeking}
>
    <span class="value" class:muted={data.isEmpty || data.isDequeued || data.isAnimIn}>
        {data.isEmpty || data.isAnimIn ? "null" : data.value}
    </span>
    <span class="index-label">{data.index}</span>
</div>

<style>
    .queue-slot-node {
        position: relative;
        width: 80px;
        height: 70px;
        box-sizing: border-box;
        border-radius: 6px;
        background: var(--node-bg);
        border: 1px solid var(--node-border);
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: var(--font-mono);
    }
    .queue-slot-node.is-empty,
    .queue-slot-node.is-dequeued {
        background: var(--surface);
        border-style: dashed;
        border-color: var(--border);
    }
    .queue-slot-node.is-front {
        border-color: var(--success);
        border-width: 1.8px;
        border-style: solid;
    }
    .queue-slot-node.is-rear {
        border-color: #c084fc;
        border-width: 1.8px;
        border-style: solid;
    }
    .queue-slot-node.is-peeking {
        border-color: var(--warning);
        border-width: 1.8px;
        border-style: solid;
    }
    .value {
        font-size: 14px;
        font-weight: 500;
        color: var(--text);
    }
    .value.muted {
        color: var(--text-muted);
        font-weight: 400;
    }
    .index-label {
        position: absolute;
        top: 100%;
        margin-top: 6px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 10px;
        color: var(--text-muted);
        white-space: nowrap;
    }
</style>
