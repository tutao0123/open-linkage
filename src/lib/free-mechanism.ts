export type SliderGuide = {
  originX: number;
  originY: number;
  angle: number;
};

export type FreeJoint = {
  id: string;
  x: number;
  y: number;
  fixed: boolean;
  slider?: SliderGuide;
};

export type FreeBarType = "rigid" | "telescopic";

export type FreeBar = {
  id: string;
  a: string;
  b: string;
  length: number;
  type?: FreeBarType;
  minLength?: number;
  maxLength?: number;
};

export type DimensionType = "distance" | "horizontal" | "vertical";

export type FreeDimension = {
  id: string;
  type: DimensionType;
  a: string;
  b: string;
  value: number;
};

export type DriverMode = "rotation" | "length";

export type FreeMechanismProject = {
  version: 2;
  joints: FreeJoint[];
  bars: FreeBar[];
  dimensions: FreeDimension[];
  driverId: string | null;
  driverMode: DriverMode;
  tracerId: string | null;
};

export type MechanismTemplate = {
  id: string;
  name: string;
  description: string;
  project: FreeMechanismProject;
};

export const FOUR_BAR_PROJECT: FreeMechanismProject = {
  version: 2,
  joints: [
    { id: "J1", x: -220, y: 120, fixed: true },
    { id: "J2", x: -140, y: 60, fixed: false },
    { id: "J3", x: 107.60650546413214, y: -90.96694489801627, fixed: false },
    { id: "J4", x: 170, y: 120, fixed: true },
  ],
  bars: [
    { id: "L1", a: "J1", b: "J2", length: 100, type: "rigid" },
    { id: "L2", a: "J2", b: "J3", length: 290, type: "rigid" },
    { id: "L3", a: "J3", b: "J4", length: 220, type: "rigid" },
  ],
  dimensions: [],
  driverId: "L1",
  driverMode: "rotation",
  tracerId: "J3",
};

export const SLIDER_CRANK_PROJECT: FreeMechanismProject = {
  version: 2,
  joints: [
    { id: "J1", x: -230, y: 40, fixed: true },
    { id: "J2", x: -145, y: -5, fixed: false },
    { id: "J3", x: 120, y: 40, fixed: false, slider: { originX: 120, originY: 40, angle: 0 } },
  ],
  bars: [
    { id: "L1", a: "J1", b: "J2", length: 96.2, type: "rigid" },
    { id: "L2", a: "J2", b: "J3", length: 268.8, type: "rigid" },
  ],
  dimensions: [],
  driverId: "L1",
  driverMode: "rotation",
  tracerId: "J3",
};

export const PARALLELOGRAM_PROJECT: FreeMechanismProject = {
  version: 2,
  joints: [
    { id: "J1", x: -210, y: 120, fixed: true },
    { id: "J2", x: -130, y: 10, fixed: false },
    { id: "J3", x: 120, y: 10, fixed: false },
    { id: "J4", x: 40, y: 120, fixed: true },
  ],
  bars: [
    { id: "L1", a: "J1", b: "J2", length: 136, type: "rigid" },
    { id: "L2", a: "J2", b: "J3", length: 250, type: "rigid" },
    { id: "L3", a: "J3", b: "J4", length: 136, type: "rigid" },
  ],
  dimensions: [],
  driverId: "L1",
  driverMode: "rotation",
  tracerId: "J3",
};

export const TELESCOPIC_PROJECT: FreeMechanismProject = {
  version: 2,
  joints: [
    { id: "J1", x: -210, y: 30, fixed: true },
    { id: "J2", x: 30, y: 30, fixed: false, slider: { originX: 30, originY: 30, angle: 0 } },
  ],
  bars: [
    { id: "L1", a: "J1", b: "J2", length: 240, type: "telescopic", minLength: 150, maxLength: 330 },
  ],
  dimensions: [],
  driverId: "L1",
  driverMode: "length",
  tracerId: "J2",
};

export const DEMO_PROJECT = FOUR_BAR_PROJECT;

export const MECHANISM_TEMPLATES: MechanismTemplate[] = [
  { id: "four-bar", name: "四杆机构", description: "两固定铰点与旋转主动杆", project: FOUR_BAR_PROJECT },
  { id: "slider-crank", name: "曲柄滑块", description: "转动副与水平移动副组合", project: SLIDER_CRANK_PROJECT },
  { id: "parallelogram", name: "平行四边形", description: "保持连杆姿态的平行机构", project: PARALLELOGRAM_PROJECT },
  { id: "telescopic", name: "伸缩执行器", description: "可变长度杆驱动直线滑块", project: TELESCOPIC_PROJECT },
];

export function cloneProject(project: FreeMechanismProject): FreeMechanismProject {
  return {
    ...project,
    joints: project.joints.map((joint) => ({
      ...joint,
      slider: joint.slider ? { ...joint.slider } : undefined,
    })),
    bars: project.bars.map((bar) => ({ ...bar })),
    dimensions: project.dimensions.map((dimension) => ({ ...dimension })),
  };
}

export function migrateProject(value: unknown): FreeMechanismProject | null {
  if (!value || typeof value !== "object") return null;
  const project = value as Record<string, unknown>;
  if (!Array.isArray(project.joints) || !Array.isArray(project.bars)) return null;
  if (project.version !== 1 && project.version !== 2) return null;
  const joints = project.joints as FreeJoint[];
  const bars = (project.bars as FreeBar[]).map((bar) => ({ ...bar, type: bar.type ?? "rigid" }));
  return {
    version: 2,
    joints,
    bars,
    dimensions: Array.isArray(project.dimensions) ? project.dimensions as FreeDimension[] : [],
    driverId: typeof project.driverId === "string" ? project.driverId : null,
    driverMode: project.driverMode === "length" ? "length" : "rotation",
    tracerId: typeof project.tracerId === "string" ? project.tracerId : null,
  };
}

export function distance(a: FreeJoint, b: FreeJoint) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function estimateDof(joints: FreeJoint[], bars: FreeBar[], dimensions: FreeDimension[] = []) {
  const movingCoordinates = joints.filter((joint) => !joint.fixed).length * 2;
  const sliderConstraints = joints.filter((joint) => !joint.fixed && joint.slider).length;
  const barConstraints = bars.filter((bar) => {
    const a = joints.find((joint) => joint.id === bar.a);
    const b = joints.find((joint) => joint.id === bar.b);
    return a && b && !(a.fixed && b.fixed);
  }).length;
  const dimensionConstraints = dimensions.filter((dimension) => {
    const a = joints.find((joint) => joint.id === dimension.a);
    const b = joints.find((joint) => joint.id === dimension.b);
    return a && b && !(a.fixed && b.fixed);
  }).length;
  return Math.max(0, movingCoordinates - sliderConstraints - barConstraints - dimensionConstraints);
}

export function getRotationDriver(joints: FreeJoint[], bars: FreeBar[], driverId: string | null) {
  const bar = bars.find((item) => item.id === driverId);
  if (!bar) return null;
  const a = joints.find((joint) => joint.id === bar.a);
  const b = joints.find((joint) => joint.id === bar.b);
  if (!a || !b || a.fixed === b.fixed) return null;
  return a.fixed ? { pivot: a, driven: b, bar } : { pivot: b, driven: a, bar };
}

export function getLengthDriver(bars: FreeBar[], driverId: string | null) {
  const bar = bars.find((item) => item.id === driverId);
  return bar?.type === "telescopic" ? bar : null;
}

export function hasValidDriver(project: FreeMechanismProject) {
  return project.driverMode === "length"
    ? Boolean(getLengthDriver(project.bars, project.driverId))
    : Boolean(getRotationDriver(project.joints, project.bars, project.driverId));
}

function targetBarLength(bar: FreeBar, driverId: string | null, driverMode: DriverMode, phase: number) {
  if (driverMode !== "length" || bar.id !== driverId || bar.type !== "telescopic") return bar.length;
  const minimum = Math.max(1, bar.minLength ?? bar.length * 0.7);
  const maximum = Math.max(minimum, bar.maxLength ?? bar.length * 1.3);
  return minimum + (maximum - minimum) * (0.5 - 0.5 * Math.cos(phase));
}

function projectDistance(a: FreeJoint, b: FreeJoint, target: number, locked: Set<string>) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const current = Math.hypot(dx, dy) || 0.0001;
  const correction = (current - target) / current;
  const aLocked = locked.has(a.id);
  const bLocked = locked.has(b.id);
  if (aLocked && bLocked) return;
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

function projectAxisDimension(a: FreeJoint, b: FreeJoint, axis: "x" | "y", target: number, locked: Set<string>) {
  const error = (b[axis] - a[axis]) - target;
  const aLocked = locked.has(a.id);
  const bLocked = locked.has(b.id);
  if (aLocked && bLocked) return;
  if (aLocked) b[axis] -= error;
  else if (bLocked) a[axis] += error;
  else {
    a[axis] += error * 0.5;
    b[axis] -= error * 0.5;
  }
}

function projectSlider(joint: FreeJoint) {
  if (!joint.slider || joint.fixed) return;
  const cosine = Math.cos(joint.slider.angle);
  const sine = Math.sin(joint.slider.angle);
  const dx = joint.x - joint.slider.originX;
  const dy = joint.y - joint.slider.originY;
  const along = dx * cosine + dy * sine;
  joint.x = joint.slider.originX + along * cosine;
  joint.y = joint.slider.originY + along * sine;
}

function resolveTwoCircleJoint(
  joint: FreeJoint,
  firstCenter: FreeJoint,
  firstRadius: number,
  secondCenter: FreeJoint,
  secondRadius: number,
) {
  const dx = secondCenter.x - firstCenter.x;
  const dy = secondCenter.y - firstCenter.y;
  const centerDistance = Math.hypot(dx, dy);
  if (centerDistance < 0.0001 || centerDistance > firstRadius + secondRadius || centerDistance < Math.abs(firstRadius - secondRadius)) return;
  const along = (firstRadius ** 2 - secondRadius ** 2 + centerDistance ** 2) / (2 * centerDistance);
  const height = Math.sqrt(Math.max(0, firstRadius ** 2 - along ** 2));
  const baseX = firstCenter.x + along * dx / centerDistance;
  const baseY = firstCenter.y + along * dy / centerDistance;
  const offsetX = -dy * height / centerDistance;
  const offsetY = dx * height / centerDistance;
  const candidates = [
    { x: baseX + offsetX, y: baseY + offsetY },
    { x: baseX - offsetX, y: baseY - offsetY },
  ];
  const closest = candidates.reduce((best, candidate) =>
    Math.hypot(candidate.x - joint.x, candidate.y - joint.y) < Math.hypot(best.x - joint.x, best.y - joint.y) ? candidate : best);
  joint.x = closest.x;
  joint.y = closest.y;
}

export function solveFreeMechanism(
  project: FreeMechanismProject,
  phase: number,
  iterations = 90,
) {
  const next = project.joints.map((joint) => ({
    ...joint,
    slider: joint.slider ? { ...joint.slider } : undefined,
  }));
  const byId = new Map(next.map((joint) => [joint.id, joint]));
  const locked = new Set(next.filter((joint) => joint.fixed).map((joint) => joint.id));

  if (project.driverMode === "rotation") {
    const driver = getRotationDriver(next, project.bars, project.driverId);
    if (driver) {
      driver.driven.x = driver.pivot.x + driver.bar.length * Math.cos(phase);
      driver.driven.y = driver.pivot.y + driver.bar.length * Math.sin(phase);
      locked.add(driver.driven.id);
    }
  }

  for (const joint of next) {
    if (locked.has(joint.id) || joint.slider) continue;
    const lockedConnections = project.bars.flatMap((bar) => {
      if (bar.a !== joint.id && bar.b !== joint.id) return [];
      const other = byId.get(bar.a === joint.id ? bar.b : bar.a);
      if (!other || !locked.has(other.id)) return [];
      return [{ center: other, radius: targetBarLength(bar, project.driverId, project.driverMode, phase) }];
    });
    if (lockedConnections.length >= 2) {
      resolveTwoCircleJoint(
        joint,
        lockedConnections[0].center,
        lockedConnections[0].radius,
        lockedConnections[1].center,
        lockedConnections[1].radius,
      );
    }
  }

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    for (const bar of project.bars) {
      const a = byId.get(bar.a);
      const b = byId.get(bar.b);
      if (a && b) projectDistance(a, b, targetBarLength(bar, project.driverId, project.driverMode, phase), locked);
    }
    for (const dimension of project.dimensions) {
      const a = byId.get(dimension.a);
      const b = byId.get(dimension.b);
      if (!a || !b) continue;
      if (dimension.type === "distance") projectDistance(a, b, dimension.value, locked);
      else projectAxisDimension(a, b, dimension.type === "horizontal" ? "y" : "x", dimension.value, locked);
    }
    for (const joint of next) projectSlider(joint);
  }
  return next;
}

export function maximumConstraintError(project: FreeMechanismProject, phase = 0) {
  const byId = new Map(project.joints.map((joint) => [joint.id, joint]));
  let maximum = 0;
  for (const bar of project.bars) {
    const a = byId.get(bar.a);
    const b = byId.get(bar.b);
    if (a && b) maximum = Math.max(maximum, Math.abs(distance(a, b) - targetBarLength(bar, project.driverId, project.driverMode, phase)));
  }
  for (const dimension of project.dimensions) {
    const a = byId.get(dimension.a);
    const b = byId.get(dimension.b);
    if (!a || !b) continue;
    const actual = dimension.type === "distance" ? distance(a, b) : dimension.type === "horizontal" ? b.y - a.y : b.x - a.x;
    maximum = Math.max(maximum, Math.abs(actual - dimension.value));
  }
  for (const joint of project.joints) {
    if (!joint.slider) continue;
    const normalX = -Math.sin(joint.slider.angle);
    const normalY = Math.cos(joint.slider.angle);
    const error = Math.abs((joint.x - joint.slider.originX) * normalX + (joint.y - joint.slider.originY) * normalY);
    maximum = Math.max(maximum, error);
  }
  return maximum;
}
