export type SliderGuide = {
  originX: number;
  originY: number;
  angle: number;
  referenceBarId?: string;
  offset?: number;
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
  minAngle?: number;
  maxAngle?: number;
};

export type DimensionType = "distance" | "horizontal" | "vertical";

export type FreeDimension = {
  id: string;
  type: DimensionType;
  a: string;
  b: string;
  value: number;
};

export type RigidBodyPair = {
  a: string;
  b: string;
  length: number;
};

export type FreeRigidBody = {
  id: string;
  jointIds: string[];
  pairs: RigidBodyPair[];
};

export type FreeTracer =
  | { id: string; kind: "joint"; jointId: string }
  | { id: string; kind: "bar"; barId: string; localX: number; localY: number }
  | { id: string; kind: "body"; bodyId: string; localX: number; localY: number };

export type DriverMode = "rotation" | "oscillation" | "length" | "hydraulic";

export type HydraulicActuator = {
  id: string;
  barId: string;
  phaseOffset: number;
  cycleRatio?: number;
  forceLimit: number;
  enabled?: boolean;
};

export type FreeJointLoad = {
  id: string;
  jointId: string;
  fx: number;
  fy: number;
  label?: string;
};

export type FreeMechanismProject = {
  version: 3;
  joints: FreeJoint[];
  bars: FreeBar[];
  dimensions: FreeDimension[];
  bodies: FreeRigidBody[];
  tracers: FreeTracer[];
  activeTracerId: string | null;
  driverId: string | null;
  driverMode: DriverMode;
  hydraulicActuators?: HydraulicActuator[];
  loads?: FreeJointLoad[];
};

export type MechanismTemplate = {
  id: string;
  name: string;
  description: string;
  project: FreeMechanismProject;
};

export type CycleAnalysis = {
  valid: boolean;
  samples: number;
  maxConstraintError: number;
  maxJointStep: number;
  closureError: number;
  branchSwitches: number;
  failedPhases: number[];
};

export type HydraulicForceResult = {
  actuatorId: string;
  barId: string;
  targetLength: number;
  requiredForce: number;
  forceLimit: number;
  utilization: number;
  derivativeValid: boolean;
};

export type HydraulicLoadAnalysis = {
  valid: boolean;
  totalLoad: number;
  maxUtilization: number;
  results: HydraulicForceResult[];
  message?: string;
};

export const FOUR_BAR_PROJECT: FreeMechanismProject = {
  version: 3,
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
  bodies: [],
  tracers: [{ id: "T1", kind: "joint", jointId: "J3" }],
  activeTracerId: "T1",
  driverId: "L1",
  driverMode: "rotation",
};

export const SLIDER_CRANK_PROJECT: FreeMechanismProject = {
  version: 3,
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
  bodies: [],
  tracers: [{ id: "T1", kind: "joint", jointId: "J3" }],
  activeTracerId: "T1",
  driverId: "L1",
  driverMode: "rotation",
};

export const PARALLELOGRAM_PROJECT: FreeMechanismProject = {
  version: 3,
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
  bodies: [],
  tracers: [{ id: "T1", kind: "joint", jointId: "J3" }],
  activeTracerId: "T1",
  driverId: "L1",
  driverMode: "rotation",
};

export const TELESCOPIC_PROJECT: FreeMechanismProject = {
  version: 3,
  joints: [
    { id: "J1", x: -210, y: 30, fixed: true },
    { id: "J2", x: 30, y: 30, fixed: false, slider: { originX: 30, originY: 30, angle: 0 } },
  ],
  bars: [
    { id: "L1", a: "J1", b: "J2", length: 240, type: "telescopic", minLength: 150, maxLength: 330 },
  ],
  dimensions: [],
  bodies: [],
  tracers: [{ id: "T1", kind: "joint", jointId: "J2" }],
  activeTracerId: "T1",
  driverId: "L1",
  driverMode: "length",
};

export function createRigidBody(id: string, jointIds: string[], joints: FreeJoint[]): FreeRigidBody {
  const byId = new Map(joints.map((joint) => [joint.id, joint]));
  const uniqueIds = [...new Set(jointIds)].filter((jointId) => byId.has(jointId));
  const pairs: RigidBodyPair[] = [];
  for (let first = 0; first < uniqueIds.length; first += 1) {
    for (let second = first + 1; second < uniqueIds.length; second += 1) {
      const a = byId.get(uniqueIds[first]);
      const b = byId.get(uniqueIds[second]);
      if (a && b) pairs.push({ a: a.id, b: b.id, length: distance(a, b) });
    }
  }
  return { id, jointIds: uniqueIds, pairs };
}

export const MULTI_JOINT_BODY_PROJECT: FreeMechanismProject = {
  version: 3,
  joints: [
    { id: "J1", x: -220, y: 120, fixed: true },
    { id: "J2", x: -140, y: 60, fixed: false },
    { id: "J3", x: 107.60650546413214, y: -90.96694489801627, fixed: false },
    { id: "J4", x: 170, y: 120, fixed: true },
    { id: "J5", x: -15, y: -105, fixed: false },
  ],
  bars: [
    { id: "L1", a: "J1", b: "J2", length: 100, type: "rigid" },
    { id: "L2", a: "J3", b: "J4", length: 220, type: "rigid" },
  ],
  dimensions: [],
  bodies: [createRigidBody("B1", ["J2", "J3", "J5"], [
    { id: "J2", x: -140, y: 60, fixed: false },
    { id: "J3", x: 107.60650546413214, y: -90.96694489801627, fixed: false },
    { id: "J5", x: -15, y: -105, fixed: false },
  ])],
  tracers: [{ id: "T1", kind: "body", bodyId: "B1", localX: 150, localY: 55 }],
  activeTracerId: "T1",
  driverId: "L1",
  driverMode: "rotation",
};

const WATT_JOINTS: FreeJoint[] = [
  { id: "J1", x: -180, y: -100, fixed: true },
  { id: "J2", x: -270, y: 55.8845726812, fixed: false },
  { id: "J3", x: 69.7271882728, y: 42.2670270786, fixed: false },
  { id: "J4", x: 180, y: -100, fixed: true },
  { id: "J5", x: -101.537, y: 14.078, fixed: false },
];

export const WATT_PROJECT: FreeMechanismProject = {
  version: 3,
  joints: WATT_JOINTS,
  bars: [
    { id: "L1", a: "J1", b: "J2", length: 180, type: "rigid", minAngle: Math.PI / 3, maxAngle: Math.PI * 2 / 3 },
    { id: "L2", a: "J3", b: "J4", length: 180, type: "rigid" },
  ],
  dimensions: [],
  bodies: [createRigidBody("B1", ["J2", "J3", "J5"], WATT_JOINTS)],
  tracers: [{ id: "T1", kind: "body", bodyId: "B1", localX: 170, localY: 0 }],
  activeTracerId: "T1",
  driverId: "L1",
  driverMode: "oscillation",
};

const CHEBYSHEV_JOINTS: FreeJoint[] = [
  { id: "J1", x: -180, y: 80, fixed: true },
  { id: "J2", x: -130, y: -6.6025403784, fixed: false },
  { id: "J3", x: 62.2603939956, y: 239.8076211353, fixed: false },
  { id: "J4", x: 20, y: 80, fixed: true },
  { id: "J5", x: -57.225, y: 135.08, fixed: false },
];

function chebyshevProject(tracerX: number): FreeMechanismProject {
  return {
    version: 3,
    joints: CHEBYSHEV_JOINTS.map((joint) => ({ ...joint })),
    bars: [
      { id: "L1", a: "J1", b: "J2", length: 100, type: "rigid" },
      { id: "L2", a: "J3", b: "J4", length: 250, type: "rigid" },
    ],
    dimensions: [],
    bodies: [createRigidBody("B1", ["J2", "J3", "J5"], CHEBYSHEV_JOINTS)],
    tracers: [{ id: "T1", kind: "body", bodyId: "B1", localX: tracerX, localY: 0 }],
    activeTracerId: "T1",
    driverId: "L1",
    driverMode: "rotation",
  };
}

export const CHEBYSHEV_PROJECT = chebyshevProject(200);
export const HOEKENS_PROJECT = chebyshevProject(375);

const KLANN_RAW_JOINTS: FreeJoint[] = [
  { id: "J1", x: 95.16, y: -205.16, fixed: true },
  { id: "J2", x: 2.34, y: 0.76, fixed: true },
  { id: "J3", x: 155.74, y: -45, fixed: true },
  { id: "J4", x: -67.34, y: -45, fixed: false },
  { id: "J5", x: 86.06, y: -45, fixed: false },
  { id: "J6", x: -260, y: 150, fixed: false },
  { id: "J7", x: -199.68, y: -75.16, fixed: false },
  { id: "J8", x: -34.84, y: -240, fixed: false },
];

function rotateJointAround(joint: FreeJoint, origin: FreeJoint, degrees: number): FreeJoint {
  const angle = degrees * Math.PI / 180;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const x = joint.x - origin.x;
  const y = joint.y - origin.y;
  return {
    ...joint,
    x: origin.x + x * cosine - y * sine,
    y: origin.y + x * sine + y * cosine,
  };
}

// The former Klann seed used the correct connectivity but an end-effector
// triangle assembled on the wrong angular branch. It produced a tall loop
// instead of the characteristic long, nearly level support stroke. Set the
// leg angle first, then orient the complete mechanism for a horizontal gait.
const KLANN_LEG_ANGLE_JOINTS = KLANN_RAW_JOINTS.map((joint) => joint.id === "J6"
  ? rotateJointAround(joint, KLANN_RAW_JOINTS.find((item) => item.id === "J7")!, -50)
  : joint);
const KLANN_ORIGIN = KLANN_LEG_ANGLE_JOINTS.find((joint) => joint.id === "J3")!;
const KLANN_JOINTS: FreeJoint[] = KLANN_LEG_ANGLE_JOINTS.map((joint) => rotateJointAround(joint, KLANN_ORIGIN, 36));

export const KLANN_PROJECT: FreeMechanismProject = {
  version: 3,
  joints: KLANN_JOINTS,
  bars: [
    { id: "L1", a: "J3", b: "J5", length: 69.68, type: "rigid" },
    { id: "L2", a: "J2", b: "J4", length: 83.36, type: "rigid" },
    { id: "L3", a: "J1", b: "J8", length: 134.58, type: "rigid" },
  ],
  dimensions: [],
  bodies: [
    createRigidBody("B1", ["J4", "J5", "J7"], KLANN_JOINTS),
    createRigidBody("B2", ["J6", "J7", "J8"], KLANN_JOINTS),
  ],
  tracers: [{ id: "T1", kind: "joint", jointId: "J6" }],
  activeTracerId: "T1",
  driverId: "L1",
  driverMode: "rotation",
};

export const PEAUCELLIER_PROJECT: FreeMechanismProject = {
  version: 3,
  joints: [
    { id: "J1", x: -120, y: 0, fixed: true },
    { id: "J2", x: 0, y: 0, fixed: true },
    { id: "J3", x: -20.8377813200, y: 118.1769303615, fixed: false },
    { id: "J4", x: -108.7221710158, y: 239.7348755884, fixed: false },
    { id: "J5", x: 114.1343896958, y: 52.7360176899, fixed: false },
    { id: "J6", x: 26.25, y: 174.2939629169, fixed: false },
  ],
  bars: [
    { id: "L1", a: "J2", b: "J3", length: 120, type: "rigid", minAngle: -Math.PI * 5 / 9, maxAngle: Math.PI * 5 / 9 },
    { id: "L2", a: "J1", b: "J4", length: 240, type: "rigid" },
    { id: "L3", a: "J1", b: "J5", length: 240, type: "rigid" },
    { id: "L4", a: "J3", b: "J4", length: 150, type: "rigid" },
    { id: "L5", a: "J3", b: "J5", length: 150, type: "rigid" },
    { id: "L6", a: "J4", b: "J6", length: 150, type: "rigid" },
    { id: "L7", a: "J5", b: "J6", length: 150, type: "rigid" },
  ],
  dimensions: [],
  bodies: [],
  tracers: [{ id: "T1", kind: "joint", jointId: "J6" }],
  activeTracerId: "T1",
  driverId: "L1",
  driverMode: "oscillation",
};

export const JANSEN_PROJECT: FreeMechanismProject = {
  version: 3,
  joints: [
    { id: "J1", x: 0, y: 0, fixed: true },
    { id: "J2", x: 45, y: 0, fixed: false },
    { id: "J3", x: -114, y: 23.4, fixed: true },
    { id: "J4", x: -72.040605, y: -93.816293, fixed: false },
    { id: "J5", x: -80.856321, y: 136.545511, fixed: false },
    { id: "J6", x: -224.383097, y: -24.429511, fixed: false },
    { id: "J7", x: -177.694545, y: 84.158791, fixed: false },
    { id: "J8", x: -129.480332, y: 275.270799, fixed: false },
  ],
  bars: [
    { id: "L1", a: "J1", b: "J2", length: 45, type: "rigid" },
    { id: "L2", a: "J2", b: "J4", length: 150, type: "rigid" },
    { id: "L3", a: "J3", b: "J4", length: 124.5, type: "rigid" },
    { id: "L4", a: "J3", b: "J6", length: 120.3, type: "rigid" },
    { id: "L5", a: "J4", b: "J6", length: 167.4, type: "rigid" },
    { id: "L6", a: "J2", b: "J5", length: 185.7, type: "rigid" },
    { id: "L7", a: "J3", b: "J5", length: 117.9, type: "rigid" },
    { id: "L8", a: "J5", b: "J7", length: 110.1, type: "rigid" },
    { id: "L9", a: "J6", b: "J7", length: 118.2, type: "rigid" },
    { id: "L10", a: "J5", b: "J8", length: 147, type: "rigid" },
    { id: "L11", a: "J7", b: "J8", length: 197.1, type: "rigid" },
  ],
  dimensions: [],
  bodies: [],
  tracers: [{ id: "T1", kind: "joint", jointId: "J8" }],
  activeTracerId: "T1",
  driverId: "L1",
  driverMode: "rotation",
};

const SCISSOR_DIAGONAL = Math.hypot(360, 400);

export const SCISSOR_PROJECT: FreeMechanismProject = {
  version: 3,
  joints: [
    { id: "J1", x: -200, y: 200, fixed: true },
    { id: "J2", x: 160, y: 200, fixed: false, slider: { originX: -200, originY: 200, angle: 0 } },
    { id: "J3", x: 160, y: -200, fixed: false, slider: { originX: -200, originY: -200, angle: 0, referenceBarId: "L2", offset: 0 } },
    { id: "J4", x: -200, y: -200, fixed: false },
    { id: "J5", x: 300, y: -200, fixed: false },
  ],
  bars: [
    { id: "L1", a: "J1", b: "J2", length: 360, type: "telescopic", minLength: 210, maxLength: 470 },
    { id: "L2", a: "J4", b: "J5", length: 500, type: "rigid" },
    { id: "L3", a: "J1", b: "J3", length: SCISSOR_DIAGONAL, type: "rigid" },
    { id: "L4", a: "J2", b: "J4", length: SCISSOR_DIAGONAL, type: "rigid" },
  ],
  dimensions: [
    { id: "D1", type: "horizontal", a: "J4", b: "J5", value: 0 },
    { id: "D2", type: "vertical", a: "J1", b: "J4", value: 0 },
  ],
  bodies: [],
  tracers: [{ id: "T1", kind: "joint", jointId: "J5" }],
  activeTracerId: "T1",
  driverId: "L1",
  driverMode: "length",
};

const EXCAVATOR_JOINTS: FreeJoint[] = [
  { id: "J1", x: -280, y: 140, fixed: true },
  { id: "J2", x: -34.3, y: -32.1, fixed: false },
  { id: "J3", x: -160.4, y: 92.9, fixed: false },
  { id: "J4", x: -149.8, y: 12.2, fixed: false },
  { id: "J5", x: 119.9, y: 151.7, fixed: false },
  { id: "J6", x: -8.5, y: 37.6, fixed: false },
  { id: "J7", x: 81.3, y: 66.7, fixed: false },
  { id: "J8", x: 267.6, y: 177.7, fixed: false },
  { id: "J9", x: 170.3, y: 125, fixed: false },
  { id: "J10", x: -340, y: 230, fixed: true },
];

export const EXCAVATOR_PROJECT: FreeMechanismProject = {
  version: 3,
  joints: EXCAVATOR_JOINTS,
  bars: [
    { id: "L1", a: "J10", b: "J3", length: distance(EXCAVATOR_JOINTS[9], EXCAVATOR_JOINTS[2]), type: "telescopic", minLength: distance(EXCAVATOR_JOINTS[9], EXCAVATOR_JOINTS[2]) - 8, maxLength: distance(EXCAVATOR_JOINTS[9], EXCAVATOR_JOINTS[2]) + 8 },
    { id: "L2", a: "J4", b: "J6", length: distance(EXCAVATOR_JOINTS[3], EXCAVATOR_JOINTS[5]), type: "telescopic", minLength: distance(EXCAVATOR_JOINTS[3], EXCAVATOR_JOINTS[5]) - 8, maxLength: distance(EXCAVATOR_JOINTS[3], EXCAVATOR_JOINTS[5]) + 8 },
    { id: "L3", a: "J7", b: "J9", length: distance(EXCAVATOR_JOINTS[6], EXCAVATOR_JOINTS[8]), type: "telescopic", minLength: distance(EXCAVATOR_JOINTS[6], EXCAVATOR_JOINTS[8]) - 8, maxLength: distance(EXCAVATOR_JOINTS[6], EXCAVATOR_JOINTS[8]) + 8 },
  ],
  dimensions: [],
  bodies: [
    createRigidBody("B1", ["J1", "J2", "J3", "J4"], EXCAVATOR_JOINTS),
    createRigidBody("B2", ["J2", "J5", "J6", "J7"], EXCAVATOR_JOINTS),
    createRigidBody("B3", ["J5", "J8", "J9"], EXCAVATOR_JOINTS),
  ],
  tracers: [{ id: "T1", kind: "joint", jointId: "J8" }],
  activeTracerId: "T1",
  driverId: null,
  driverMode: "hydraulic",
  hydraulicActuators: [
    { id: "A1", barId: "L1", phaseOffset: Math.PI * 3 / 2, cycleRatio: 1, forceLimit: 120, enabled: true },
    { id: "A2", barId: "L2", phaseOffset: Math.PI / 2, cycleRatio: 1, forceLimit: 90, enabled: true },
    { id: "A3", barId: "L3", phaseOffset: Math.PI * 3 / 2, cycleRatio: 1, forceLimit: 70, enabled: true },
  ],
  loads: [{ id: "F1", jointId: "J8", fx: 0, fy: 12, label: "斗齿载荷" }],
};

export const DEMO_PROJECT = FOUR_BAR_PROJECT;

export const MECHANISM_TEMPLATES: MechanismTemplate[] = [
  { id: "four-bar", name: "四杆机构", description: "两固定铰点与旋转主动杆", project: FOUR_BAR_PROJECT },
  { id: "slider-crank", name: "曲柄滑块", description: "转动副与水平移动副组合", project: SLIDER_CRANK_PROJECT },
  { id: "parallelogram", name: "平行四边形", description: "保持连杆姿态的平行机构", project: PARALLELOGRAM_PROJECT },
  { id: "telescopic", name: "伸缩执行器", description: "可变长度杆驱动直线滑块", project: TELESCOPIC_PROJECT },
  { id: "rigid-body", name: "多铰点刚体", description: "三元连杆与刚体轨迹铰点", project: MULTI_JOINT_BODY_PROJECT },
  { id: "watt", name: "瓦特连杆", description: "双摇杆与近似直线中点轨迹", project: WATT_PROJECT },
  { id: "chebyshev", name: "彻比雪夫连杆", description: "经典比例的近似直线导向", project: CHEBYSHEV_PROJECT },
  { id: "hoekens", name: "霍肯连杆", description: "长直线段与快速返回轨迹", project: HOEKENS_PROJECT },
  { id: "klann", name: "克兰步行腿", description: "六连杆仿生足端闭合轨迹", project: KLANN_PROJECT },
  { id: "peaucellier", name: "波塞利耶–利普金", description: "八连杆精确直线反演机构", project: PEAUCELLIER_PROJECT },
  { id: "jansen", name: "简森步行腿", description: "经典比例的多杆仿生步态", project: JANSEN_PROJECT },
  { id: "scissor", name: "剪叉式升降台", description: "相对平台导轨与周期伸缩驱动", project: SCISSOR_PROJECT },
  { id: "excavator", name: "挖掘机工作装置", description: "三刚体、三液压缸与斗齿载荷分析", project: EXCAVATOR_PROJECT },
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
    bodies: project.bodies.map((body) => ({
      ...body,
      jointIds: [...body.jointIds],
      pairs: body.pairs.map((pair) => ({ ...pair })),
    })),
    tracers: project.tracers.map((tracer) => ({ ...tracer })),
    hydraulicActuators: project.hydraulicActuators?.map((actuator) => ({ ...actuator })),
    loads: project.loads?.map((load) => ({ ...load })),
  };
}

export function migrateProject(value: unknown): FreeMechanismProject | null {
  if (!value || typeof value !== "object") return null;
  const project = value as Record<string, unknown>;
  if (!Array.isArray(project.joints) || !Array.isArray(project.bars)) return null;
  if (project.version !== 1 && project.version !== 2 && project.version !== 3) return null;
  const joints = project.joints as FreeJoint[];
  const bars = (project.bars as FreeBar[]).map((bar) => ({ ...bar, type: bar.type ?? "rigid" }));
  const legacyTracerId = typeof project.tracerId === "string" ? project.tracerId : null;
  const tracers = Array.isArray(project.tracers)
    ? project.tracers as FreeTracer[]
    : legacyTracerId
      ? [{ id: "T1", kind: "joint" as const, jointId: legacyTracerId }]
      : [];
  return {
    version: 3,
    joints,
    bars,
    dimensions: Array.isArray(project.dimensions) ? project.dimensions as FreeDimension[] : [],
    bodies: Array.isArray(project.bodies) ? project.bodies as FreeRigidBody[] : [],
    tracers,
    activeTracerId: typeof project.activeTracerId === "string" ? project.activeTracerId : tracers[0]?.id ?? null,
    driverId: typeof project.driverId === "string" ? project.driverId : null,
    driverMode: project.driverMode === "hydraulic" ? "hydraulic" : project.driverMode === "length" ? "length" : project.driverMode === "oscillation" ? "oscillation" : "rotation",
    hydraulicActuators: Array.isArray(project.hydraulicActuators) ? project.hydraulicActuators as HydraulicActuator[] : [],
    loads: Array.isArray(project.loads) ? project.loads as FreeJointLoad[] : [],
  };
}

export function bodyPointToLocal(body: FreeRigidBody, joints: FreeJoint[], x: number, y: number) {
  const origin = joints.find((joint) => joint.id === body.jointIds[0]);
  const axisPoint = joints.find((joint) => joint.id === body.jointIds[1]);
  return pointsToLocal(origin, axisPoint, x, y);
}

export function barPointToLocal(bar: FreeBar, joints: FreeJoint[], x: number, y: number) {
  const origin = joints.find((joint) => joint.id === bar.a);
  const axisPoint = joints.find((joint) => joint.id === bar.b);
  return pointsToLocal(origin, axisPoint, x, y);
}

function pointsToLocal(origin: FreeJoint | undefined, axisPoint: FreeJoint | undefined, x: number, y: number) {
  if (!origin || !axisPoint) return null;
  const length = Math.hypot(axisPoint.x - origin.x, axisPoint.y - origin.y);
  if (length < 0.0001) return null;
  const cosine = (axisPoint.x - origin.x) / length;
  const sine = (axisPoint.y - origin.y) / length;
  const dx = x - origin.x;
  const dy = y - origin.y;
  return { localX: dx * cosine + dy * sine, localY: -dx * sine + dy * cosine };
}

export function resolveTracerPoint(project: FreeMechanismProject, tracerId = project.activeTracerId) {
  const tracer = project.tracers.find((item) => item.id === tracerId);
  if (!tracer) return null;
  if (tracer.kind === "joint") {
    const joint = project.joints.find((item) => item.id === tracer.jointId);
    return joint ? { x: joint.x, y: joint.y } : null;
  }
  const body = tracer.kind === "body" ? project.bodies.find((item) => item.id === tracer.bodyId) : null;
  const bar = tracer.kind === "bar" ? project.bars.find((item) => item.id === tracer.barId) : null;
  const originId = body?.jointIds[0] ?? bar?.a;
  const axisPointId = body?.jointIds[1] ?? bar?.b;
  const origin = project.joints.find((joint) => joint.id === originId);
  const axisPoint = project.joints.find((joint) => joint.id === axisPointId);
  if ((!body && !bar) || !origin || !axisPoint) return null;
  const length = Math.hypot(axisPoint.x - origin.x, axisPoint.y - origin.y);
  if (length < 0.0001) return null;
  const cosine = (axisPoint.x - origin.x) / length;
  const sine = (axisPoint.y - origin.y) / length;
  return {
    x: origin.x + tracer.localX * cosine - tracer.localY * sine,
    y: origin.y + tracer.localX * sine + tracer.localY * cosine,
  };
}

export function distance(a: FreeJoint, b: FreeJoint) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function estimateDof(
  joints: FreeJoint[],
  bars: FreeBar[],
  dimensions: FreeDimension[] = [],
  bodies: FreeRigidBody[] = [],
) {
  const movingCoordinates = joints.filter((joint) => !joint.fixed).length * 2;
  const sliderConstraints = joints.filter((joint) => !joint.fixed && joint.slider).length;
  const barConstraints = bars.filter((bar) => {
    if (bar.type === "telescopic") return false;
    const a = joints.find((joint) => joint.id === bar.a);
    const b = joints.find((joint) => joint.id === bar.b);
    return a && b && !(a.fixed && b.fixed);
  }).length;
  const dimensionConstraints = dimensions.filter((dimension) => {
    const a = joints.find((joint) => joint.id === dimension.a);
    const b = joints.find((joint) => joint.id === dimension.b);
    return a && b && !(a.fixed && b.fixed);
  }).length;
  const bodyConstraints = bodies.reduce((total, body) => total + Math.max(0, body.jointIds.length * 2 - 3), 0);
  return Math.max(0, movingCoordinates - sliderConstraints - barConstraints - dimensionConstraints - bodyConstraints);
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

export function getHydraulicActuators(project: FreeMechanismProject) {
  return (project.hydraulicActuators ?? []).filter((actuator) => {
    const bar = project.bars.find((item) => item.id === actuator.barId);
    return actuator.enabled !== false && bar?.type === "telescopic";
  });
}

export function hasValidDriver(project: FreeMechanismProject) {
  if (project.driverMode === "hydraulic") return getHydraulicActuators(project).length > 0;
  return project.driverMode === "length"
    ? Boolean(getLengthDriver(project.bars, project.driverId))
    : Boolean(getRotationDriver(project.joints, project.bars, project.driverId));
}

export function targetBarLength(
  bar: FreeBar,
  project: FreeMechanismProject,
  phase: number,
  lengthOverrides?: Record<string, number>,
) {
  if (lengthOverrides?.[bar.id] !== undefined) return lengthOverrides[bar.id];
  let actuatorPhase: number | null = null;
  if (project.driverMode === "length" && bar.id === project.driverId) actuatorPhase = phase;
  if (project.driverMode === "hydraulic") {
    const actuator = getHydraulicActuators(project).find((item) => item.barId === bar.id);
    if (actuator) actuatorPhase = phase * (actuator.cycleRatio ?? 1) + actuator.phaseOffset;
  }
  if (actuatorPhase === null || bar.type !== "telescopic") return bar.length;
  const minimum = Math.max(1, bar.minLength ?? bar.length * 0.7);
  const maximum = Math.max(minimum, bar.maxLength ?? bar.length * 1.3);
  return minimum + (maximum - minimum) * (0.5 - 0.5 * Math.cos(actuatorPhase));
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

export function resolveSliderGuide(joint: FreeJoint, joints: FreeJoint[], bars: FreeBar[]) {
  if (!joint.slider) return null;
  const referenceBar = joint.slider.referenceBarId
    ? bars.find((bar) => bar.id === joint.slider?.referenceBarId)
    : null;
  if (referenceBar) {
    const a = joints.find((item) => item.id === referenceBar.a);
    const b = joints.find((item) => item.id === referenceBar.b);
    if (a && b) {
      const referenceAngle = Math.atan2(b.y - a.y, b.x - a.x);
      const offset = joint.slider.offset ?? 0;
      return {
        originX: a.x - Math.sin(referenceAngle) * offset,
        originY: a.y + Math.cos(referenceAngle) * offset,
        angle: referenceAngle + joint.slider.angle,
        referenceBarId: referenceBar.id,
      };
    }
  }
  return {
    originX: joint.slider.originX,
    originY: joint.slider.originY,
    angle: joint.slider.angle,
    referenceBarId: null,
  };
}

function projectSlider(joint: FreeJoint, joints: FreeJoint[], bars: FreeBar[], locked: Set<string>) {
  if (!joint.slider || joint.fixed || locked.has(joint.id)) return;
  const guide = resolveSliderGuide(joint, joints, bars);
  if (!guide) return;
  const cosine = Math.cos(guide.angle);
  const sine = Math.sin(guide.angle);
  const dx = joint.x - guide.originX;
  const dy = joint.y - guide.originY;
  const along = dx * cosine + dy * sine;
  joint.x = guide.originX + along * cosine;
  joint.y = guide.originY + along * sine;
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
  lengthOverrides?: Record<string, number>,
) {
  const next = project.joints.map((joint) => ({
    ...joint,
    slider: joint.slider ? { ...joint.slider } : undefined,
  }));
  const byId = new Map(next.map((joint) => [joint.id, joint]));
  const locked = new Set(next.filter((joint) => joint.fixed).map((joint) => joint.id));

  if (project.driverMode === "rotation" || project.driverMode === "oscillation") {
    const driver = getRotationDriver(next, project.bars, project.driverId);
    if (driver) {
      const angle = project.driverMode === "oscillation"
        ? (driver.bar.minAngle ?? -Math.PI / 3) + ((driver.bar.maxAngle ?? Math.PI / 3) - (driver.bar.minAngle ?? -Math.PI / 3)) * (0.5 + 0.5 * Math.cos(phase))
        : phase;
      driver.driven.x = driver.pivot.x + driver.bar.length * Math.cos(angle);
      driver.driven.y = driver.pivot.y + driver.bar.length * Math.sin(angle);
      locked.add(driver.driven.id);
    }
  }

  for (const joint of next) {
    if (locked.has(joint.id) || joint.slider) continue;
    const lockedConnections = project.bars.flatMap((bar) => {
      if (bar.a !== joint.id && bar.b !== joint.id) return [];
      const other = byId.get(bar.a === joint.id ? bar.b : bar.a);
      if (!other || !locked.has(other.id)) return [];
      return [{ center: other, radius: targetBarLength(bar, project, phase, lengthOverrides) }];
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
      if (a && b) projectDistance(a, b, targetBarLength(bar, project, phase, lengthOverrides), locked);
    }
    for (const dimension of project.dimensions) {
      const a = byId.get(dimension.a);
      const b = byId.get(dimension.b);
      if (!a || !b) continue;
      if (dimension.type === "distance") projectDistance(a, b, dimension.value, locked);
      else projectAxisDimension(a, b, dimension.type === "horizontal" ? "y" : "x", dimension.value, locked);
    }
    for (const body of project.bodies) {
      for (const pair of body.pairs) {
        const a = byId.get(pair.a);
        const b = byId.get(pair.b);
        if (a && b) projectDistance(a, b, pair.length, locked);
      }
    }
    for (const joint of next) projectSlider(joint, next, project.bars, locked);
  }
  return next;
}

export function predictJointPositions(current: FreeJoint[], previous: FreeJoint[] | null) {
  if (!previous) return current.map((joint) => ({ ...joint, slider: joint.slider ? { ...joint.slider } : undefined }));
  const previousById = new Map(previous.map((joint) => [joint.id, joint]));
  return current.map((joint) => {
    const before = previousById.get(joint.id);
    if (!before || joint.fixed) return { ...joint, slider: joint.slider ? { ...joint.slider } : undefined };
    return {
      ...joint,
      x: joint.x + (joint.x - before.x),
      y: joint.y + (joint.y - before.y),
      slider: joint.slider ? { ...joint.slider } : undefined,
    };
  });
}

export function maximumConstraintError(project: FreeMechanismProject, phase = 0, lengthOverrides?: Record<string, number>) {
  const byId = new Map(project.joints.map((joint) => [joint.id, joint]));
  let maximum = 0;
  for (const bar of project.bars) {
    const a = byId.get(bar.a);
    const b = byId.get(bar.b);
    if (a && b) maximum = Math.max(maximum, Math.abs(distance(a, b) - targetBarLength(bar, project, phase, lengthOverrides)));
  }
  for (const dimension of project.dimensions) {
    const a = byId.get(dimension.a);
    const b = byId.get(dimension.b);
    if (!a || !b) continue;
    const actual = dimension.type === "distance" ? distance(a, b) : dimension.type === "horizontal" ? b.y - a.y : b.x - a.x;
    maximum = Math.max(maximum, Math.abs(actual - dimension.value));
  }
  for (const body of project.bodies) {
    for (const pair of body.pairs) {
      const a = byId.get(pair.a);
      const b = byId.get(pair.b);
      if (a && b) maximum = Math.max(maximum, Math.abs(distance(a, b) - pair.length));
    }
  }
  for (const joint of project.joints) {
    if (!joint.slider) continue;
    const guide = resolveSliderGuide(joint, project.joints, project.bars);
    if (!guide) continue;
    const normalX = -Math.sin(guide.angle);
    const normalY = Math.cos(guide.angle);
    const error = Math.abs((joint.x - guide.originX) * normalX + (joint.y - guide.originY) * normalY);
    maximum = Math.max(maximum, error);
  }
  return maximum;
}

function branchSignatures(project: FreeMechanismProject) {
  const byId = new Map(project.joints.map((joint) => [joint.id, joint]));
  const rotationDriver = project.driverMode === "rotation" || project.driverMode === "oscillation" ? getRotationDriver(project.joints, project.bars, project.driverId) : null;
  const neighbors = new Map<string, string[]>();
  for (const bar of project.bars) {
    neighbors.set(bar.a, [...(neighbors.get(bar.a) ?? []), bar.b]);
    neighbors.set(bar.b, [...(neighbors.get(bar.b) ?? []), bar.a]);
  }
  const signatures = new Map<string, number>();
  for (const joint of project.joints) {
    if (joint.fixed || joint.id === rotationDriver?.driven.id) continue;
    const adjacent = [...new Set(neighbors.get(joint.id) ?? [])].sort();
    if (adjacent.length < 2) continue;
    const first = byId.get(adjacent[0]);
    const second = byId.get(adjacent[1]);
    if (!first || !second) continue;
    const cross = (second.x - first.x) * (joint.y - first.y) - (second.y - first.y) * (joint.x - first.x);
    const scale = Math.max(1, distance(first, second) * Math.max(distance(first, joint), distance(second, joint)));
    signatures.set(`${adjacent[0]}:${joint.id}:${adjacent[1]}`, cross / scale);
  }
  return signatures;
}

export function analyzeMechanismCycle(
  project: FreeMechanismProject,
  samples = 144,
  iterations = 160,
  tolerance = 0.1,
  phaseOverride?: number,
): CycleAnalysis {
  const sampleCount = Math.max(12, Math.round(samples));
  const rotationDriver = project.driverMode === "rotation" || project.driverMode === "oscillation" ? getRotationDriver(project.joints, project.bars, project.driverId) : null;
  const inferredPhase = rotationDriver && project.driverMode === "rotation"
    ? Math.atan2(rotationDriver.driven.y - rotationDriver.pivot.y, rotationDriver.driven.x - rotationDriver.pivot.x)
    : 0;
  const startPhase = phaseOverride !== undefined && Number.isFinite(phaseOverride) ? phaseOverride : inferredPhase;
  let state = cloneProject(project);
  state.joints = solveFreeMechanism(state, startPhase, iterations);
  state = { ...state, joints: state.joints };
  const startJoints = state.joints.map((joint) => ({ ...joint }));
  let beforePreviousJoints: FreeJoint[] | null = null;
  let previousJoints = startJoints;
  let previousSignatures = branchSignatures(state);
  let maxConstraintError = maximumConstraintError(state, startPhase);
  let maxJointStep = 0;
  let branchSwitches = 0;
  const failedPhases: number[] = [];

  if (!Number.isFinite(maxConstraintError) || maxConstraintError > tolerance) failedPhases.push(0);

  for (let index = 1; index <= sampleCount; index += 1) {
    const phase = startPhase + index * Math.PI * 2 / sampleCount;
    const seed = { ...state, joints: predictJointPositions(state.joints, beforePreviousJoints) };
    const joints = solveFreeMechanism(seed, phase, iterations);
    const next = { ...state, joints };
    const error = maximumConstraintError(next, phase);
    if (!Number.isFinite(error) || error > tolerance) failedPhases.push(index * 360 / sampleCount);
    maxConstraintError = Math.max(maxConstraintError, Number.isFinite(error) ? error : Number.POSITIVE_INFINITY);

    for (const joint of joints) {
      const previous = previousJoints.find((item) => item.id === joint.id);
      if (previous) maxJointStep = Math.max(maxJointStep, distance(previous, joint));
    }

    const signatures = branchSignatures(next);
    for (const [key, value] of signatures) {
      const previous = previousSignatures.get(key);
      if (previous === undefined) continue;
      if (Math.abs(previous) > 0.08 && Math.abs(value) > 0.08 && Math.sign(previous) !== Math.sign(value)) {
        branchSwitches += 1;
      }
    }
    previousSignatures = signatures;
    beforePreviousJoints = previousJoints;
    previousJoints = joints;
    state = next;
  }

  let closureError = 0;
  for (const joint of state.joints) {
    const initial = startJoints.find((item) => item.id === joint.id);
    if (initial) closureError = Math.max(closureError, distance(initial, joint));
  }

  return {
    valid: failedPhases.length === 0 && branchSwitches === 0 && closureError <= Math.max(tolerance * 5, 0.25),
    samples: sampleCount,
    maxConstraintError,
    maxJointStep,
    closureError,
    branchSwitches,
    failedPhases,
  };
}

export function analyzeHydraulicLoads(
  project: FreeMechanismProject,
  phase: number,
  iterations = 12000,
): HydraulicLoadAnalysis {
  const actuators = getHydraulicActuators(project);
  const loads = (project.loads ?? []).filter((load) => project.joints.some((joint) => joint.id === load.jointId));
  if (actuators.length === 0) {
    return { valid: false, totalLoad: 0, maxUtilization: 0, results: [], message: "没有启用的液压缸。" };
  }
  if (loads.length === 0) {
    return { valid: false, totalLoad: 0, maxUtilization: 0, results: [], message: "请先在受力铰点上添加载荷。" };
  }

  const barById = new Map(project.bars.map((bar) => [bar.id, bar]));
  const baseLengths = Object.fromEntries(actuators.flatMap((actuator) => {
    const bar = barById.get(actuator.barId);
    return bar ? [[bar.id, targetBarLength(bar, project, phase)]] : [];
  }));
  const baseJoints = solveFreeMechanism(project, phase, iterations, baseLengths);
  const base = { ...project, joints: baseJoints };
  const results: HydraulicForceResult[] = [];

  for (const actuator of actuators) {
    const bar = barById.get(actuator.barId);
    const targetLength = baseLengths[actuator.barId];
    if (!bar || targetLength === undefined) continue;
    const minimum = Math.max(1, bar.minLength ?? bar.length * 0.7);
    const maximum = Math.max(minimum, bar.maxLength ?? bar.length * 1.3);
    // Keep the finite-difference step comfortably above the projection solver's
    // sub-millimetre residual, otherwise actuator forces become iteration-sensitive.
    const epsilon = Math.max(0.5, (maximum - minimum) * 0.01);
    const lower = Math.max(minimum + 0.001, targetLength - epsilon);
    const upper = Math.min(maximum - 0.001, targetLength + epsilon);
    const denominator = upper - lower;
    const lowerOverrides = { ...baseLengths, [bar.id]: lower };
    const upperOverrides = { ...baseLengths, [bar.id]: upper };
    const lowerJoints = denominator > 0.0001
      ? solveFreeMechanism(base, phase, iterations, lowerOverrides)
      : baseJoints;
    const upperJoints = denominator > 0.0001
      ? solveFreeMechanism(base, phase, iterations, upperOverrides)
      : baseJoints;
    const lowerProject = { ...project, joints: lowerJoints };
    const upperProject = { ...project, joints: upperJoints };
    const derivativeValid = denominator > 0.0001
      && maximumConstraintError(lowerProject, phase, lowerOverrides) < 0.2
      && maximumConstraintError(upperProject, phase, upperOverrides) < 0.2;
    const lowerById = new Map(lowerJoints.map((joint) => [joint.id, joint]));
    const upperById = new Map(upperJoints.map((joint) => [joint.id, joint]));
    let generalizedForce = 0;
    if (derivativeValid) {
      for (const load of loads) {
        const before = lowerById.get(load.jointId);
        const after = upperById.get(load.jointId);
        if (!before || !after) continue;
        generalizedForce += load.fx * (after.x - before.x) / denominator
          + load.fy * (after.y - before.y) / denominator;
      }
    }
    const requiredForce = derivativeValid ? -generalizedForce : Number.NaN;
    const forceLimit = Math.max(0.001, actuator.forceLimit);
    const utilization = derivativeValid ? Math.abs(requiredForce) / forceLimit : Number.POSITIVE_INFINITY;
    results.push({
      actuatorId: actuator.id,
      barId: actuator.barId,
      targetLength,
      requiredForce,
      forceLimit,
      utilization,
      derivativeValid,
    });
  }

  const finiteUtilizations = results.filter((result) => Number.isFinite(result.utilization)).map((result) => result.utilization);
  const maxUtilization = finiteUtilizations.length > 0 ? Math.max(...finiteUtilizations) : Number.POSITIVE_INFINITY;
  return {
    valid: results.length === actuators.length && results.every((result) => result.derivativeValid),
    totalLoad: loads.reduce((total, load) => total + Math.hypot(load.fx, load.fy), 0),
    maxUtilization,
    results,
    message: results.some((result) => !result.derivativeValid) ? "部分姿态的数值导数未收敛，请避开行程端点或奇异位形。" : undefined,
  };
}
