import { updateNode } from '../stores/sll/graph.js';

export function createCanvasLogic({ getZoom, setZoom, getNodes, updateNodeFn }) {
  const ZOOM_STEP = 0.1;
  const ZOOM_MIN = 0.3;
  const ZOOM_MAX = 2;

  let svgEl = null;
  let panX = 0;
  let panY = 0;
  let panning = false;
  let panStartX = 0;
  let panStartY = 0;
  let dragging = null;
  let wheelFrame = null;

  function setSvgEl(el) { svgEl = el; }

  function getSVGPoint(clientX, clientY) {
    const rect = svgEl.getBoundingClientRect();
    return {
      x: (clientX - rect.left - panX) / getZoom(),
      y: (clientY - rect.top - panY) / getZoom(),
    };
  }

  function onWheel(e) {
    e.preventDefault();
    if (wheelFrame) return;
    wheelFrame = requestAnimationFrame(() => {
      wheelFrame = null;
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

  function startPan(clientX, clientY) {
    panning = true;
    panStartX = clientX - panX;
    panStartY = clientY - panY;
  }

  function startDrag(nodeId, clientX, clientY) {
    const pt = getSVGPoint(clientX, clientY);
    const node = getNodes().find(n => n.id === nodeId);
    if (!node) return;
    dragging = { nodeId, offsetX: pt.x - node.x, offsetY: pt.y - node.y };
  }

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

  function onMouseup(pushHistory) {
    if (panning) { panning = false; return 'panning'; }
    if (dragging) { pushHistory(); dragging = null; return 'dragging'; }
    return null;
  }

  function stopPan() { panning = false; }
  function stopDrag() { dragging = null; }

  function isBackground(target) {
    return target === svgEl
      || (target.tagName === 'rect' && (
        target.getAttribute('fill') === 'url(#grid)' ||
        target.getAttribute('fill') === 'url(#grid-dll)'
      ))
      || (target.tagName === 'circle' && !target.classList.contains('port'));
  }

  function getInlineEditPos(node) {
    const svgRect = svgEl.getBoundingClientRect();
    return {
      x: svgRect.left + node.x * getZoom() + panX,
      y: svgRect.top + node.y * getZoom() + panY + 32 * getZoom(),
    };
  }

  function getPendingSVGPoint(clientX, clientY) {
    return getSVGPoint(clientX, clientY);
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
    getPendingSVGPoint,
    getPanX: () => panX,
    getPanY: () => panY,
    isPanning: () => panning,
    isDragging: () => !!dragging,
  };
}