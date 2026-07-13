export type FreeJoint = {
  id: string;
  x: number;
  y: number;
  fixed: boolean;
};

export type FreeBar = {
  id: string;
  a: string;
  b: string;
  length: number;
};

export type FreeMechanismProject = {
  version: 1;
  joints: FreeJoint[];
  bars: FreeBar[];
  driverId: string | null;
  tracerId: string | null;
};

export const DEMO_PROJECT: FreeMechanismProject = {
  version: 1,
  joints: [
    { id: "J1", x: -220, y: 120, fixed: true },
    { id: "J2", x: -140, y: 60, fixed: false },
    { id: "J3", x: 107.5, y: -91.2, fixed: false },
    { id: "J4", x: 170, y: 120, fixed: true },
  ],
  bars: [
    { id: "L1", a: "J1", b: "J2", length: 100 },
    { id: "L2", a: "J2", b: "J3", length: 290 },
    { id: "L3", a: "J3", b: "J4", length: 220 },
  ],
  driverId: "L1",
  tracerId: "J3",
};

export function distance(a: FreeJoint, b: FreeJoint) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function estimateDof(joints: FreeJoint[], bars: FreeBar[]) {
  const movingCoordinates = joints.filter((joint) => !joint.fixed).length * 2;
  const activeConstraints = bars.filter((bar) => {
    const a = joints.find((joint) => joint.id === bar.a);
    const b = joints.find((joint) => joint.id === bar.b);
    return a && b && !(a.fixed && b.fixed);
  }).length;
  return Math.max(0, movingCoordinates - activeConstraints);
}

export function getDriverEndpoints(joints: FreeJoint[], bars: FreeBar[], driverId: string | null) {
  const bar = bars.find((item) => item.id === driverId);
  if (!bar) return null;
  const a = joints.find((joint) => joint.id === bar.a);
  const b = joints.find((joint) => joint.id === bar.b);
  if (!a || !b || a.fixed === b.fixed) return null;
  return a.fixed ? { pivot: a, driven: b, bar } : { pivot: b, driven: a, bar };
}

export function solveFreeMechanism(
  joints: FreeJoint[],
  bars: FreeBar[],
  driverId: string | null,
  angle: number,
) {
  const next = joints.map((joint) => ({ ...joint }));
  const byId = new Map(next.map((joint) => [joint.id, joint]));
  const driver = getDriverEndpoints(next, bars, driverId);
  const locked = new Set(next.filter((joint) => joint.fixed).map((joint) => joint.id));

  if (driver) {
    driver.driven.x = driver.pivot.x + driver.bar.length * Math.cos(angle);
    driver.driven.y = driver.pivot.y + driver.bar.length * Math.sin(angle);
    locked.add(driver.driven.id);
  }

  for (let iteration = 0; iteration < 55; iteration += 1) {
    for (const bar of bars) {
      const a = byId.get(bar.a);
      const b = byId.get(bar.b);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const current = Math.hypot(dx, dy) || 0.0001;
      const correction = (current - bar.length) / current;
      const aLocked = locked.has(a.id);
      const bLocked = locked.has(b.id);
      if (aLocked && bLocked) continue;
      if (aLocked) {
        b.x -= dx * correction;
        b.y -= dy * correction;
      } else if (bLocked) {
        a.x += dx * correction;
        a.y += dy * correction;
      } else {
        a.x += dx * correction * 0.5;
        a.y += dy * correction * 0.5;
        b.x -= dx * correction * 0.5;
        b.y -= dy * correction * 0.5;
      }
    }
  }
  return next;
}

export function maximumConstraintError(joints: FreeJoint[], bars: FreeBar[]) {
  const byId = new Map(joints.map((joint) => [joint.id, joint]));
  return bars.reduce((maximum, bar) => {
    const a = byId.get(bar.a);
    const b = byId.get(bar.b);
    return a && b ? Math.max(maximum, Math.abs(distance(a, b) - bar.length)) : maximum;
  }, 0);
}
