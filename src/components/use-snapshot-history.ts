"use client";

import { useCallback, useRef, useState } from "react";

export function useSnapshotHistory<T>(initialValue: T, clone: (value: T) => T) {
  const [value, setValueState] = useState(() => clone(initialValue));
  const valueRef = useRef(value);
  const undoRef = useRef<T[]>([]);
  const redoRef = useRef<T[]>([]);
  const transactionRef = useRef<T | null>(null);
  const [availability, setAvailability] = useState({ canUndo: false, canRedo: false });

  const refresh = useCallback(() => {
    setAvailability({ canUndo: undoRef.current.length > 0, canRedo: redoRef.current.length > 0 });
  }, []);

  const replace = useCallback((next: T) => {
    valueRef.current = next;
    setValueState(next);
  }, []);

  const commit = useCallback((next: T) => {
    undoRef.current = [...undoRef.current.slice(-49), clone(valueRef.current)];
    redoRef.current = [];
    transactionRef.current = null;
    replace(next);
    refresh();
  }, [clone, refresh, replace]);

  const beginTransaction = useCallback(() => {
    if (transactionRef.current === null) transactionRef.current = clone(valueRef.current);
  }, [clone]);

  const commitTransaction = useCallback((next: T) => {
    const before = transactionRef.current;
    transactionRef.current = null;
    if (before === null) {
      commit(next);
      return;
    }
    undoRef.current = [...undoRef.current.slice(-49), before];
    redoRef.current = [];
    replace(next);
    refresh();
  }, [commit, refresh, replace]);

  const cancelTransaction = useCallback(() => {
    transactionRef.current = null;
  }, []);

  const reset = useCallback((next: T) => {
    undoRef.current = [];
    redoRef.current = [];
    transactionRef.current = null;
    replace(clone(next));
    refresh();
  }, [clone, refresh, replace]);

  const undo = useCallback(() => {
    const previous = undoRef.current.at(-1);
    if (!previous) return null;
    undoRef.current = undoRef.current.slice(0, -1);
    redoRef.current = [...redoRef.current.slice(-49), clone(valueRef.current)];
    const restored = clone(previous);
    replace(restored);
    refresh();
    return restored;
  }, [clone, refresh, replace]);

  const redo = useCallback(() => {
    const next = redoRef.current.at(-1);
    if (!next) return null;
    redoRef.current = redoRef.current.slice(0, -1);
    undoRef.current = [...undoRef.current.slice(-49), clone(valueRef.current)];
    const restored = clone(next);
    replace(restored);
    refresh();
    return restored;
  }, [clone, refresh, replace]);

  return {
    value,
    valueRef,
    replace,
    commit,
    beginTransaction,
    commitTransaction,
    cancelTransaction,
    reset,
    undo,
    redo,
    canUndo: availability.canUndo,
    canRedo: availability.canRedo,
  };
}
