"use client";

import styles from "./svg-viewport-controls.module.css";

type SvgViewportControlsProps = {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
};

export function SvgViewportControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
}: SvgViewportControlsProps) {
  return (
    <div className={styles.controls} role="group" aria-label="画布视图控制">
      <button type="button" onClick={onZoomOut} aria-label="缩小画布" title="缩小">−</button>
      <button className={styles.zoomValue} type="button" onClick={onReset} aria-label="复位画布视图" title="复位视图">
        {Math.round(zoom * 100)}%
      </button>
      <button type="button" onClick={onZoomIn} aria-label="放大画布" title="放大">＋</button>
      <span title="鼠标滚轮缩放；Alt 或中键拖动平移">滚轮缩放</span>
    </div>
  );
}
