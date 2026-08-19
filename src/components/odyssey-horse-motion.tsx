"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";

import { analyzeVariableLegProject, sampleVariableLeg } from "@/lib/variable-leg";
import { changeVariableLegCount } from "@/lib/variable-leg-gait";
import { createVariableLegReferenceProject } from "@/lib/variable-leg-reference-library";

import { VariableLegDeploymentView } from "./variable-leg-deployment-view";
import styles from "./odyssey-variable-leg-experience.module.css";

const FULL_TURN = Math.PI * 2;
const subscribeToHydration = () => () => undefined;

export function OdysseyHorseMotion() {
  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const project = useMemo(() => {
    const reference = createVariableLegReferenceProject("smooth");
    return { ...reference, deployment: changeVariableLegCount(reference.deployment, 4) };
  }, []);
  const mode = (project.modes.find((item) => item.id === project.activeModeId) ?? project.modes[0])!;
  const samples = useMemo(
    () => sampleVariableLeg(project.baseProject, project.adjustment, mode.adjustmentValue, 72, 90),
    [mode.adjustmentValue, project.adjustment, project.baseProject],
  );
  const analysis = useMemo(() => analyzeVariableLegProject(project, 36, 60), [project]);
  const metrics = analysis.metrics.find((item) => item.modeId === mode.id) ?? analysis.metrics[0];
  const [phase, setPhase] = useState(0);
  const [playing, setPlaying] = useState(true);
  const previousFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) {
      previousFrameRef.current = null;
      return;
    }
    let frameId = 0;
    const advance = (timestamp: number) => {
      const previous = previousFrameRef.current ?? timestamp;
      const elapsedSeconds = Math.min(0.05, (timestamp - previous) / 1000);
      previousFrameRef.current = timestamp;
      setPhase((current) => (current + elapsedSeconds * FULL_TURN * 0.16) % FULL_TURN);
      frameId = window.requestAnimationFrame(advance);
    };
    frameId = window.requestAnimationFrame(advance);
    return () => window.cancelAnimationFrame(frameId);
  }, [playing]);

  if (!hydrated || !metrics) return null;

  const renderMechanismLayer = (legSide: "left" | "right" | "none", showFrame: boolean) => (
    <VariableLegDeploymentView
      samples={samples}
      deployment={project.deployment}
      mode={mode}
      metrics={metrics}
      phase={phase}
      bodyWorldX={0}
      footprints={[]}
      selectedBarId={null}
      onSelectBar={() => undefined}
      view={{ x: -410, y: -293, width: 820, height: 550 }}
      showHorse={false}
      showFrame={showFrame}
      showScene={false}
      interactive={false}
      tone="odyssey"
      legSide={legSide}
    />
  );

  return <>
    <svg className={`${styles.mechanismOverlay} ${styles.rearMechanismLayer}`} viewBox="-410 -293 820 550" aria-hidden="true">
      <g transform="translate(0 -20) translate(0 -80) scale(1 1.15) translate(0 80)">
        {renderMechanismLayer("right", false)}
      </g>
    </svg>
    <Image
      className={styles.horseBodyOcclusion}
      src="/863689e7-d348-4759-a1ca-0cbdbfeb54fa.png"
      alt=""
      fill
      sizes="(max-width: 860px) 100vw, 48vw"
      aria-hidden="true"
    />
    <svg className={`${styles.mechanismOverlay} ${styles.frontMechanismLayer}`} viewBox="-410 -293 820 550" role="img" aria-label="OpenLinkage Jansen linkage legs walking from inside the Trojan horse shell">
      <g transform="translate(0 -20) translate(0 -80) scale(1 1.15) translate(0 80)">
        {renderMechanismLayer("left", false)}
      </g>
    </svg>
    <button className={styles.motionControl} type="button" onClick={() => setPlaying((current) => !current)} aria-pressed={playing}>
      <span>{playing ? "Pause motion" : "Play motion"}</span>
      <b>{playing ? "LIVE" : "HOLD"}</b>
    </button>
  </>;
}
