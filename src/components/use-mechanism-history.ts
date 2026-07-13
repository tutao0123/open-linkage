"use client";

import { useCallback, useRef, useState } from "react";

import { cloneProject, type FreeMechanismProject } from "@/lib/free-mechanism";

export function useMechanismHistory(initialProject: FreeMechanismProject) {
  const [project, setProjectState] = useState(() => cloneProject(initialProject));
  const projectRef = useRef(project);
  const undoRef = useRef<FreeMechanismProject[]>([]);
  const redoRef = useRef<FreeMechanismProject[]>([]);
  const [availability, setAvailability] = useState({ canUndo: false, canRedo: false });

  const refreshAvailability = useCallback(() => {
    setAvailability({ canUndo: undoRef.current.length > 0, canRedo: redoRef.current.length > 0 });
  }, []);

  const replace = useCallback((next: FreeMechanismProject) => {
    projectRef.current = next;
    setProjectState(next);
  }, []);

  const checkpoint = useCallback(() => {
    undoRef.current = [...undoRef.current.slice(-49), cloneProject(projectRef.current)];
    redoRef.current = [];
    refreshAvailability();
  }, [refreshAvailability]);

  const commit = useCallback((next: FreeMechanismProject) => {
    checkpoint();
    replace(next);
  }, [checkpoint, replace]);

  const undo = useCallback(() => {
    const previous = undoRef.current.at(-1);
    if (!previous) return null;
    undoRef.current = undoRef.current.slice(0, -1);
    redoRef.current = [...redoRef.current.slice(-49), cloneProject(projectRef.current)];
    const restored = cloneProject(previous);
    replace(restored);
    refreshAvailability();
    return restored;
  }, [refreshAvailability, replace]);

  const redo = useCallback(() => {
    const next = redoRef.current.at(-1);
    if (!next) return null;
    redoRef.current = redoRef.current.slice(0, -1);
    undoRef.current = [...undoRef.current.slice(-49), cloneProject(projectRef.current)];
    const restored = cloneProject(next);
    replace(restored);
    refreshAvailability();
    return restored;
  }, [refreshAvailability, replace]);

  return {
    project,
    projectRef,
    replace,
    checkpoint,
    commit,
    undo,
    redo,
    canUndo: availability.canUndo,
    canRedo: availability.canRedo,
  };
}
