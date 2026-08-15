import {
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";

import {
  EXACT_EN_TRANSLATIONS,
  FRAGMENT_EN_TRANSLATIONS,
} from "./i18n.generated";

export const LANGUAGES = ["zh", "en"] as const;
export type Language = (typeof LANGUAGES)[number];

export const PAGE_METADATA = {
  home: {
    zh: {
      title: "OpenLinkage · 平面机构设计",
      description: "开源、浏览器端的平面机构设计与自动综合平台。",
    },
    en: {
      title: "OpenLinkage · Planar Mechanism Design",
      description: "An open-source, browser-based platform for planar mechanism design and automated synthesis.",
    },
  },
  lab: {
    zh: {
      title: "四杆机构实验室 · OpenLinkage",
      description: "输入杆长并实时分析平面四杆机构的运动、轨迹与工程性能。",
    },
    en: {
      title: "Four-bar Mechanism Lab · OpenLinkage",
      description: "Enter link lengths and analyze the motion, trajectory, and engineering performance of planar four-bar mechanisms in real time.",
    },
  },
  sketchMechanism: {
    zh: {
      title: "草图生成连杆机构 · OpenLinkage",
      description: "从特洛伊木马轮廓闭合曲线出发，对比经典四杆与齿轮同步五杆机构并播放拟合动画。",
    },
    en: {
      title: "Sketch to Linkage Mechanism · OpenLinkage",
      description: "Compare classic four-bar and gear-synchronized five-bar mechanisms that trace a closed Trojan horse outline.",
    },
  },
  leg: {
    zh: {
      title: "六杆机械腿轨迹综合 · OpenLinkage",
      description: "手绘足端轨迹，自动生成并比较多套兼顾轨迹精度、连续装配和传动性能的 Watt 类六杆腿。",
    },
    en: {
      title: "Six-bar Leg Trajectory Synthesis · OpenLinkage",
      description: "Draw a target foot path and compare Watt-type six-bar leg designs for accuracy, assembly continuity, and transmission quality.",
    },
  },
  variableLeg: {
    zh: {
      title: "可变几何步行腿 · OpenLinkage",
      description: "以克兰腿和简森腿为基础，通过移动固定铰点或可锁止伸缩杆，同时拟合巡航、高速与越障足端轨迹。",
    },
    en: {
      title: "Variable-geometry Walking Leg · OpenLinkage",
      description: "Adapt Klann and Jansen legs to cruise, high-speed, and obstacle trajectories using movable ground pivots or lockable telescopic links.",
    },
  },
  straightLine: {
    zh: {
      title: "经典直线机构工作台 · OpenLinkage",
      description: "比较瓦特、彻比雪夫、霍肯与波塞利耶–利普金机构的直线行程、偏差和速度均匀性。",
    },
    en: {
      title: "Classic Straight-line Mechanisms · OpenLinkage",
      description: "Compare the stroke, deviation, and speed uniformity of Watt, Chebyshev, Hoekens, and Peaucellier–Lipkin mechanisms.",
    },
  },
  designer: {
    zh: {
      title: "自由机构设计器 · OpenLinkage",
      description: "自由添加铰点和杆件，搭建、驱动并观察平面 N 杆机构的运动轨迹。",
    },
    en: {
      title: "Free Mechanism Designer · OpenLinkage",
      description: "Add joints and links freely, define drives, and inspect the motion paths of planar N-link mechanisms.",
    },
  },
} as const;

const EN_OVERRIDES: Record<string, string> = {
  "OpenLinkage 首页": "OpenLinkage Home",
  "从运动目标，": "From motion goals,",
  "到机构方案。": "to mechanism designs.",
  "一个开源、浏览器端的平面机构设计与自动综合平台。选择标准机构快速分析， 或从铰点和杆件开始自由搭建自己的机构。":
    "An open-source, browser-based platform for planar mechanism design and automated synthesis. Analyze standard mechanisms quickly, or build your own from joints and links.",
  "选择设计模块": "Choose a Workbench",
  "选择你的设计方式": "Choose how you want to design",
  "标准机构快速求解，自由机构灵活探索。": "Solve standard mechanisms quickly or explore freely.",
  "进入四杆设计": "Open Four-bar Design",
  "草图生成四杆机构": "Sketch to Four-bar Mechanism",
  "草图生成连杆机构": "Sketch to Linkage Mechanism",
  "给定特洛伊木马轮廓闭合曲线，对比经典四杆与齿轮同步五杆机构，让连杆绘图点描出相似轨迹。":
    "Given a closed Trojan horse outline, compare classic four-bar and gear-synchronized five-bar mechanisms whose coupler points trace a similar curve.",
  "特洛伊木马轮廓 · 四杆 / 齿轮五杆": "Trojan Horse Outline · Four-bar / Geared Five-bar",
  "给定特洛伊木马轮廓闭合曲线，从经典闭环方程出发搜索完整可转的四杆机构，让连杆绘图点描出相似轨迹。":
    "Given a closed Trojan horse outline, search the classic loop-closure equations for a full-cycle four-bar whose coupler point traces a similar curve.",
  "打开草图生成机构": "Open Sketch Synthesis",
  "特洛伊木马轮廓 · 四杆综合": "Trojan Horse Outline · Four-bar Synthesis",
  "进入六杆腿设计": "Open Six-bar Leg Design",
  "进入可变步行腿工作台": "Open Variable-leg Workbench",
  "进入直线机构工作台": "Open Straight-line Workbench",
  "机械腿 · 综合求解": "Walking Legs · Design Synthesis",
  "经典机构 · 直线性能": "Classic Mechanisms · Straightness",
  "N 杆 · 自由拓扑": "N-link · Free Topology",
  "机构参数": "Mechanism Parameters",
  "工程分析": "Engineering Analysis",
  "杆长 · MM": "Link Lengths · mm",
  "连杆轨迹点": "Coupler Point",
  "装配分支": "Assembly Branch",
  "项目文件": "Project File",
  "六杆腿轨迹综合 · BETA": "Six-bar Leg Synthesis · BETA",
  "设计与目标": "Design & Targets",
  "前固定铰距": "Ground-pivot Spacing",
  "主曲柄": "Input Crank",
  "一级连杆": "Primary Coupler",
  "一级摇杆": "Primary Rocker",
  "候选与排序": "Candidates & Ranking",
  "等待开放工作轨迹": "Waiting for a Target Path",
  "理论步长": "Theoretical Step Length",
  "轨迹总高度": "Total Path Height",
  "机构性能分": "Mechanism Score",
  "工作段转角": "Working Input Range",
  "经典机构": "Classic Mechanisms",
  "直线性能": "Straight-line Performance",
  "四杆 · 近似直线": "Four-bar · Approximate Straight Line",
  "四杆 · 近似匀速": "Four-bar · Near-uniform Speed",
  "四杆 · 慢进快回": "Four-bar · Slow Advance, Quick Return",
  "建模工具": "Modeling Tools",
  "机构模板": "Mechanism Templates",
  "自由机构画布操作": "Free Mechanism Canvas Tools",
  "克兰步行腿": "Klann Walking Leg",
  "简森步行腿": "Jansen Walking Leg",
  "改为移动副": "Change to Prismatic Joint",
  "固定到机架": "Fix to Ground",
  "相对运动副": "Relative Joints",
  "分析曲柄摇杆、双曲柄和双摇杆机构，绘制目标轨迹并自动拟合四杆尺寸。":
    "Analyze crank-rocker, double-crank, and double-rocker mechanisms, draw a target path, and fit four-bar dimensions automatically.",
  "面向步行与奔跑机构，绘制足端轨迹并生成多套兼顾精度和传动性能的六杆方案。":
    "Draw foot-end trajectories for walking and running, then generate six-bar designs balancing accuracy and transmission quality.",
  "以克兰腿和简森腿为原型，通过移动固定铰点或可锁止伸缩杆，让同一机构适配巡航、高速与越障轨迹。":
    "Adapt one Klann or Jansen mechanism to cruise, high-speed, and obstacle trajectories using a movable ground pivot or lockable telescopic link.",
  "比较瓦特、彻比雪夫、霍肯和波塞利耶机构，自动识别最佳直线段并评价行程与误差。":
    "Compare Watt, Chebyshev, Hoekens, and Peaucellier mechanisms, automatically identifying the best straight segment and its error.",
  "像搭积木一样添加铰点与杆件，指定主动杆，实时观察任意平面机构的运动和轨迹。":
    "Add joints and links like building blocks, choose an input link, and inspect motion and trajectories in real time.",
  "编辑机构": "Edit Mechanism",
  "播放机构运动": "Play Mechanism",
  "播放运动": "Play Motion",
  "暂停运动": "Pause Motion",
  "播放六杆腿动画": "Play Six-bar Leg Animation",
  "暂停六杆腿动画": "Pause Six-bar Leg Animation",
  "机构状态": "Mechanism Status",
  "工作原理": "How It Works",
  "典型应用": "Typical Applications",
  "目标驱动设计": "Goal-driven Design",
  "选择工况": "Select Conditions",
  "定义目标": "Define Targets",
  "机构与调节": "Mechanism & Adjustment",
  "生成比较": "Generate & Compare",
  "精修与定版": "Refine & Finalize",
  "先让它走起来": "Start by Making It Walk",
  "重新开始": "Start Over",
  "暂停": "Pause",
  "这个示例已经可以走": "This Example Is Ready to Walk",
  "播放看看，也可以表达你想要的步子、抬脚和速度。拖动后会匹配最接近的已验证走法，并始终保留上一个可走参考。":
    "Press play, or describe the step, clearance, and speed you want. The controls match the nearest verified gait while keeping the last working reference.",
  "选择一种走法": "Choose a Gait",
  "走法参考预设": "Verified Gait Presets",
  "平稳走": "Smooth",
  "快速走": "Quick",
  "高抬脚": "High Step",
  "步幅适中，先观察连续、稳定的足端运动。":
    "A moderate stride for observing smooth, continuous foot motion.",
  "提高节奏，用更快的完整周期观察运动。":
    "A faster cadence that remains continuous over the full cycle.",
  "增加摆动离地高度，更容易看清抬脚过程。":
    "More swing clearance, making the lifting motion easier to see.",
  "想走多远": "Desired Step",
  "匹配最接近的已验证步幅": "Matches the nearest verified step length",
  "想抬多高": "Desired Clearance",
  "匹配最接近的已验证离地高度": "Matches the nearest verified foot clearance",
  "想走多快": "Desired Speed",
  "匹配最接近的已验证主轴速度": "Matches the nearest verified crank speed",
  "mm 期望": "mm target",
  "rpm 期望": "rpm target",
  "步子大小": "Step Length",
  "抬脚高度": "Foot Clearance",
  "行走速度": "Walking Speed",
  "可走参考已匹配": "Verified Reference Matched",
  "继续使用上一个参考": "Keeping the Last Working Reference",
  "按这个效果继续": "Continue with This Gait",
  "我有明确目标": "I Have Specific Targets",
  "专业设置": "Advanced Settings",
  "采用后当前方案即可继续使用；生成新方案和工程细调都是可选步骤。":
    "Once accepted, this gait is ready to use. Generating alternatives and engineering refinement are optional.",
  "当前方案已经可用": "The Current Gait Is Ready",
  "你可以继续播放和使用它。只有想寻找其他走法时，才需要生成并比较新方案。":
    "Keep playing or use it as-is. Generate and compare alternatives only when you want a different gait.",
  "已采用可走参考": "Verified Reference Accepted",
  "下面的生成是可选优化，不会覆盖当前方案。":
    "Generating alternatives below is optional and will not overwrite the current gait.",
  "已验证参考": "Verified Reference",
  "先播放一个完整周期，再试试左侧的三个控制":
    "Play one full cycle, then try the three controls on the left",
  "播放看看": "Play",
  "当前效果": "Current Gait",
  "这一版可以完整演示": "Ready for a Full-cycle Demo",
  "参数来自本机预先验证的可走参考，不需要先解决工程警告。":
    "These parameters come from a locally pre-verified walking reference, so no engineering warnings need to be resolved first.",
  "实际步子": "Actual Step",
  "实际抬脚": "Actual Clearance",
  "运动连续性": "Motion Continuity",
  "当前速度": "Current Speed",
  "先看它动起来。闭环误差、奇异裕度和约束等级等工程指标，需要时再展开。":
    "Start by watching it move. Expand closure error, singularity margin, and constraint levels only when needed.",
  "查看工程细节": "View Engineering Details",
  "工程细节": "Engineering Details",
  "查看当前效果": "View Current Gait",
  "已载入经过整周验证的平稳行走参考。":
    "Loaded a smooth-walking reference verified over the full cycle.",
  "已载入一个可完整运动的平稳行走参考；点击播放即可开始。":
    "Loaded a smooth-walking reference that completes the full cycle. Press play to begin.",
  "暂时无法载入该参考，画布已保留上一个可走方案。":
    "This reference could not be loaded, so the canvas is keeping the last working gait.",
  "没有找到更合适的参考，画布继续使用上一个可走方案。":
    "No closer reference was found, so the canvas is keeping the last working gait.",
  "当前可走参考已采用，可以继续播放和使用；生成新方案只是可选优化。":
    "The verified reference is accepted and ready to use; generating alternatives is optional.",
  "当前参考已作为起点保留；现在可以输入明确目标，不会重置已有工况。":
    "The current reference remains the starting point while you enter specific targets; existing conditions will not be reset.",
  "当前参考已作为起点保留；现在可以展开机构与调节设置。":
    "The current reference remains the starting point while you open mechanism and adjustment settings.",
  "自动保存数据无效，已保留可完整运动的平稳行走参考。":
    "The autosave data was invalid, so the full-cycle smooth-walking reference was kept.",
  "已恢复经过整周验证的平稳行走参考。":
    "Restored the smooth-walking reference verified over the full cycle.",
  "已切换到": "Switched to ",
  "参考；这是经过整周验证的可走方案。":
    " reference; this gait has been verified over the full cycle.",
  "已匹配到最接近的可走参考：": "Matched the nearest verified reference: ",
  "；实际约 ": "; actual ",
  " mm 步幅、": " mm step, ",
  " mm 抬脚、": " mm clearance, ",
  " rpm。": " rpm.",
  "定义每个工况的目标": "Define Targets for Each Condition",
  "先选择一种工况": "Choose an Operating Condition",
  "其他参数稍后再设置。现在只需要告诉我们，这台腿最主要用来做什么。":
    "You can set the details later. For now, choose the leg's primary operating condition.",
  "还有其他需要兼顾的工况吗？": "Do you need to include any additional conditions?",
  "不勾选也没关系，可以先完成单工况设计。": "You can start with a single-condition design and add more later.",
  "当前工况目标": "Current Condition Targets",
  "复制当前工况": "Duplicate Current Condition",
  "删除当前工况": "Delete Current Condition",
  "选择机构与调节方式": "Choose the Mechanism and Adjustment",
  "先确定机构拓扑，再选择移动铰点或伸缩杆，以及每个工况对应的锁止值。":
    "Choose the mechanism topology, then select a movable pivot or telescopic link and set its locked value for each condition.",
  "候选与工程检查": "Candidates & Engineering Checks",
  "项目提示": "Engineering Notes",
  "主轴相位": "Crank Phase",
  "巡航": "Cruise",
  "高速": "High Speed",
  "越障": "Obstacle",
  "选择": "Choose ",
  "已选择": "Selected ",
  "工况。": " operating condition.",
  "条腿的整机部署，播放可以看到整机步态。": "legs on this machine; press play to watch the gait.",
  "条腿的整机部署；接下来选择机构与调节方式。": "legs for this machine; next, choose the mechanism and adjustment.",
  "腿整机部署。": "legs for the whole machine.",
  "固定 RPM": " Fixed RPM",
  "步长目标": " Step Length target",
  "抬脚目标": " Foot Clearance target",
  "支撑相目标": " Stance Phase target",
  "落地速度目标": " Landing Speed target",
  "轨迹 RMSE": " Trajectory RMSE",
  "整周装配": "Full-cycle Assembly",
  "整周装配率": "Full-cycle Assembly Rate",
  "整周可装配率": "Full-cycle Assembly Rate",
  "整周求解率": "Full-cycle Solution Rate",
  "整周检查": "Full-cycle Check",
  "整周连续": "Full-cycle Continuous",
  "整周转角范围": "Full-cycle Angular Range",
  "草稿整周可达，可以应用；当前机构仍未修改。": "The draft is reachable over the full cycle and can be applied; the current mechanism is unchanged.",
  "已应用经过整周检查的参数，并保存为新的可行基线。": "Applied the parameters after a full-cycle check and saved a new feasible baseline.",
  "这里的“高速、越障”仅代表目标足迹工况。当前版本不计算质量、地面接触力、弹簧储能、结构应力或整机稳定性。":
    "“High Speed” and “Obstacle” describe target foot-path conditions only. This version does not calculate mass, ground-contact forces, spring energy, structural stress, or whole-machine stability.",
};

const ENGLISH_FIXUPS: Array<[RegExp, string]> = [
  [/\bCrane (?:leg|legs)\b/gi, "Klann leg"],
  [/\bClan (?:leg|legs)\b/gi, "Klann leg"],
  [/\bJensen (?:leg|legs)\b/gi, "Jansen leg"],
  [/\bJenson\b/gi, "Jansen"],
  [/\bCrane walking legs\b/gi, "Klann Walking Leg"],
  [/\bHawken\b/g, "Hoekens"],
  [/\bPosellier\b/g, "Peaucellier"],
  [/\borganization\b/gi, "mechanism"],
  [/\borganizations\b/gi, "mechanisms"],
  [/\binstitution\b/gi, "mechanism"],
  [/\binstitutions\b/gi, "mechanisms"],
  [/\bbody sports\b/gi, "mechanism motion"],
  [/\bsports\b/gi, "motion"],
  [/\ball week\b/gi, "full cycle"],
  [/\bweekly\b/gi, "full-cycle"],
  [/\bthe entire week\b/gi, "the full cycle"],
  [/\bthroughout the entire cycle\b/gi, "over the full cycle"],
  [/\bthroughout the week\b/gi, "over the full cycle"],
  [/\bworking condition\b/gi, "operating condition"],
  [/\bworking conditions\b/gi, "operating conditions"],
  [/\btoe trajectories\b/gi, "foot-end trajectories"],
  [/\bpayload\b/gi, "load"],
  [/\bunapplicable\b/gi, "inapplicable"],
  [/\bEditorial mechanism\b/g, "Edit Mechanism"],
  [/\bFour-pole\b/gi, "Four-bar"],
  [/\bSix-pole\b/gi, "Six-bar"],
  [/\bMulti-pole\b/gi, "Multi-link"],
  [/\blinear mechanism\b/gi, "straight-line mechanism"],
  [/\bSpindle phase\b/gi, "Crank Phase"],
  [/\bwork case\b/gi, "operating condition"],
  [/\bwork cases\b/gi, "operating conditions"],
  [/\bInstitutions and Regulation\b/g, "Mechanism & Adjustment"],
  [/\bFine revision and final version\b/gi, "Refine & Finalize"],
  [/([a-z])target\b/gi, "$1 target"],
  [/\s{2,}/g, " "],
  [/\s+([,.;:!?])/g, "$1"],
  [/:([A-Z])/g, ": $1"],
  [/Selected ([A-Z][a-z]+)working conditions\./g, "Selected $1 operating condition."],
];

const manualFragmentEntries = Object.entries(EN_OVERRIDES)
  .filter(([source]) => source.length > 1)
  .sort(([first], [second]) => second.length - first.length);

const fragmentEntries = Object.entries({
  ...EXACT_EN_TRANSLATIONS,
  ...FRAGMENT_EN_TRANSLATIONS,
})
  .filter(([source]) => source.length > 1)
  .sort(([first], [second]) => second.length - first.length);

export function isLanguage(value: unknown): value is Language {
  return value === "zh" || value === "en";
}

function polishEnglish(value: string) {
  return ENGLISH_FIXUPS.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), value);
}

export function translateText(value: string, language: Language) {
  if (language === "zh" || !/\p{Script=Han}/u.test(value)) return value;
  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  const normalized = value.trim().replace(/\s+/g, " ");
  const exact = EN_OVERRIDES[normalized] ?? EXACT_EN_TRANSLATIONS[normalized];
  if (exact) return `${leading}${polishEnglish(exact)}${trailing}`;
  const manuallyTranslated = manualFragmentEntries.reduce(
    (current, [source, target]) => current.includes(source) ? current.replaceAll(source, target) : current,
    normalized,
  );
  const translated = fragmentEntries.reduce(
    (current, [source, target]) => current.includes(source) ? current.replaceAll(source, target) : current,
    manuallyTranslated,
  );
  return `${leading}${polishEnglish(translated)}${trailing}`;
}

export function withLanguagePath(href: string, language: Language) {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  if (/^\/(?:zh|en)(?:\/|$)/.test(href)) {
    return href.replace(/^\/(?:zh|en)(?=\/|$)/, `/${language}`);
  }
  return `/${language}${href === "/" ? "" : href}`;
}

const translatedProps = ["aria-label", "aria-description", "title", "placeholder", "alt"] as const;

export function localizeReactTree(node: ReactNode, language: Language): ReactNode {
  if (language === "zh" || node === null || node === undefined || typeof node === "boolean") return node;
  if (typeof node === "string") return translateText(node, language);
  if (typeof node === "number") return node;
  if (Array.isArray(node)) return node.map((child) => localizeReactTree(child, language));
  if (!isValidElement(node)) return node;

  const element = node as ReactElement<Record<string, unknown>>;
  const props = { ...element.props };
  for (const key of translatedProps) {
    if (typeof props[key] === "string") props[key] = translateText(props[key], language);
  }
  if (typeof props.href === "string") props.href = withLanguagePath(props.href, language);
  if ("children" in props) props.children = Children.map(
    props.children as ReactNode,
    (child) => localizeReactTree(child, language),
  );
  return cloneElement(element, props);
}
