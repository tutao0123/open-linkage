"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
  type PointerEvent as ReactPointerEvent,
} from "react";

export type SvgViewRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ViewportState = {
  zoom: number;
  panX: number;
  panY: number;
};

type PanStart = {
  pointerId: number;
  clientX: number;
  clientY: number;
  panX: number;
  panY: number;
};

const MIN_ZOOM = 0.45;
const MAX_ZOOM = 5;

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function resolveView(base: SvgViewRect, state: ViewportState): SvgViewRect {
  const width = base.width / state.zoom;
  const height = base.height / state.zoom;
  return {
    x: base.x + (base.width - width) / 2 + state.panX,
    y: base.y + (base.height - height) / 2 + state.panY,
    width,
    height,
  };
}

export function useSvgViewport(base: SvgViewRect, targetRef?: RefObject<SVGSVGElement | null>) {
  const [state, setState] = useState<ViewportState>({ zoom: 1, panX: 0, panY: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<PanStart | null>(null);
  const internalSvgRef = useRef<SVGSVGElement>(null);
  const svgRef = targetRef ?? internalSvgRef;
  const view = useMemo(() => resolveView(base, state), [base, state]);

  const zoomBy = (factor: number) => {
    setState((current) => ({ ...current, zoom: clampZoom(current.zoom * factor) }));
  };

  const resetView = () => {
    setState({ zoom: 1, panX: 0, panY: 0 });
    setIsPanning(false);
    panStartRef.current = null;
  };

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const bounds = svg.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;

      const ratioX = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
      const ratioY = Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height));
      setState((current) => {
        const currentView = resolveView(base, current);
        const nextZoom = clampZoom(current.zoom * (event.deltaY < 0 ? 1.16 : 1 / 1.16));
        const nextWidth = base.width / nextZoom;
        const nextHeight = base.height / nextZoom;
        const focusX = currentView.x + ratioX * currentView.width;
        const focusY = currentView.y + ratioY * currentView.height;
        const nextX = focusX - ratioX * nextWidth;
        const nextY = focusY - ratioY * nextHeight;
        return {
          zoom: nextZoom,
          panX: nextX - base.x - (base.width - nextWidth) / 2,
          panY: nextY - base.y - (base.height - nextHeight) / 2,
        };
      });
    };

    svg.addEventListener("wheel", handleWheel, { passive: false });
    return () => svg.removeEventListener("wheel", handleWheel);
  }, [base, svgRef]);

  const startPan = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 1 && !event.altKey) return false;
    event.preventDefault();
    event.stopPropagation();
    panStartRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      panX: state.panX,
      panY: state.panY,
    };
    setIsPanning(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    return true;
  };

  const movePan = (event: ReactPointerEvent<SVGSVGElement>) => {
    const start = panStartRef.current;
    if (!start || start.pointerId !== event.pointerId) return false;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return true;
    const deltaX = (event.clientX - start.clientX) * view.width / bounds.width;
    const deltaY = (event.clientY - start.clientY) * view.height / bounds.height;
    setState((current) => ({
      ...current,
      panX: start.panX - deltaX,
      panY: start.panY - deltaY,
    }));
    return true;
  };

  const endPan = (event: ReactPointerEvent<SVGSVGElement>) => {
    const start = panStartRef.current;
    if (!start || start.pointerId !== event.pointerId) return false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    panStartRef.current = null;
    setIsPanning(false);
    return true;
  };

  return {
    view,
    viewBox: `${view.x} ${view.y} ${view.width} ${view.height}`,
    zoom: state.zoom,
    isPanning,
    zoomIn: () => zoomBy(1.25),
    zoomOut: () => zoomBy(1 / 1.25),
    resetView,
    startPan,
    movePan,
    endPan,
  };
}
