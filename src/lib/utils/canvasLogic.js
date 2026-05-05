/**
 * @param {{
 *   getZoom: () => number,
 *   setZoom: (z: number) => void,
 *   getNodes: () => any[],
 *   updateNodeFn: (id: string, data: any, push?: boolean) => void
 * }} params
 */
export function createCanvasLogic({ getZoom, setZoom, getNodes, updateNodeFn }) {
    const ZOOM_STEP = 0.1;
    const ZOOM_MIN = 0.3;
    const ZOOM_MAX = 2;

    /** @type {SVGSVGElement|null} */
    let svgEl = null;
    let panX = 0;
    let panY = 0;
    let panning = false;
    let panStartX = 0;
    let panStartY = 0;
    /** @type {{ nodeId: string, offsetX: number, offsetY: number }|null} */
    let dragging = null;
    /** @type {number|null} */
    let wheelFrame = null;

    /** @param {SVGSVGElement} el */
    function setSvgEl(el) { svgEl = el; }

    /**
     * @param {number} clientX
     * @param {number} clientY
     * @returns {{x: number, y: number}}
     */
    function getSVGPoint(clientX, clientY) {
        if (!svgEl) return { x: 0, y: 0 };
        const rect = svgEl.getBoundingClientRect();
        return {
            x: (clientX - rect.left - panX) / getZoom(),
            y: (clientY - rect.top - panY) / getZoom(),
        };
    }

    /** @param {WheelEvent} e */
    function onWheel(e) {
        if (!svgEl) return;
        e.preventDefault();
        if (wheelFrame) return;
        wheelFrame = requestAnimationFrame(() => {
            wheelFrame = null;
            if (!svgEl) return;
            const rect = svgEl.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
            const zoom = getZoom();
            const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, +(zoom + delta).toFixed(2)));
            panX = mouseX - (mouseX - panX) * (newZoom / zoom);
            panY = mouseY - (mouseY - panY) * (newZoom / zoom);
            setZoom(newZoom);
        });
    }

    /**
     * @param {number} clientX
     * @param {number} clientY
     */
    function startPan(clientX, clientY) {
        panning = true;
        panStartX = clientX - panX;
        panStartY = clientY - panY;
    }

    /**
     * @param {string} nodeId
     * @param {number} clientX
     * @param {number} clientY
     */
    function startDrag(nodeId, clientX, clientY) {
        const pt = getSVGPoint(clientX, clientY);
        const node = getNodes().find(n => n.id === nodeId);
        if (!node) return;
        dragging = { nodeId, offsetX: pt.x - node.x, offsetY: pt.y - node.y };
    }

    /**
     * @param {number} clientX
     * @param {number} clientY
     * @returns {{panning?: boolean, dragging?: boolean, panX?: number, panY?: number}}
     */
    function onMousemove(clientX, clientY) {
        if (panning) {
            panX = clientX - panStartX;
            panY = clientY - panStartY;
            return { panning: true, panX, panY };
        }
        if (dragging) {
            const pt = getSVGPoint(clientX, clientY);
            updateNodeFn(dragging.nodeId, {
                x: pt.x - dragging.offsetX,
                y: pt.y - dragging.offsetY,
            }, true);
            return { dragging: true };
        }
        return {};
    }

    /**
     * @param {Function} pushHistory
     * @returns {'panning'|'dragging'|null}
     */
    function onMouseup(pushHistory) {
        if (panning) { panning = false; return 'panning'; }
        if (dragging) { pushHistory(); dragging = null; return 'dragging'; }
        return null;
    }

    function stopPan() { panning = false; }
    function stopDrag() { dragging = null; }

    /**
     * @param {EventTarget|null} target
     * @returns {boolean}
     */
    function isBackground(target) {
        if (!svgEl || !(target instanceof Element)) return false;
        return target === svgEl
            || (target.tagName === 'rect' && (
                target.getAttribute('fill') === 'url(#grid)' ||
                target.getAttribute('fill') === 'url(#grid-dll)' ||
                target.getAttribute('fill') === 'url(#grid-stack)' ||
                target.getAttribute('fill') === 'url(#grid-ls)'
            ))
            || (target.tagName === 'circle' && !target.classList.contains('port'));
    }

    /**
     * @param {{x: number, y: number}} node
     * @returns {{x: number, y: number}}
     */
    function getInlineEditPos(node) {
        if (!svgEl) return { x: 0, y: 0 };
        const svgRect = svgEl.getBoundingClientRect();
        return {
            x: svgRect.left + node.x * getZoom() + panX,
            y: svgRect.top + node.y * getZoom() + panY + 32 * getZoom(),
        };
    }

    function setPan(x, y) {
        panX = x;
        panY = y;
    }

    return {
        setSvgEl,
        getSVGPoint,
        onWheel,
        startPan,
        startDrag,
        onMousemove,
        onMouseup,
        stopPan,
        stopDrag,
        isBackground,
        getInlineEditPos,
        getPanX: () => panX,
        getPanY: () => panY,
        isPanning: () => panning,
        isDragging: () => !!dragging,
        setPan,
    };
}