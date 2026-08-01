import type { Language } from "@/lib/i18n";

export type PreviewKind =
  | "four-bar"
  | "six-bar"
  | "variable-leg"
  | "straight-line"
  | "free-mechanism";

type WorkbenchId =
  | "four-bar"
  | "six-bar-leg"
  | "variable-leg"
  | "straight-line"
  | "free-mechanism";

type WorkbenchRoute =
  | "/lab"
  | "/leg"
  | "/variable-leg"
  | "/straight-line"
  | "/designer";

export type WorkbenchCardContent = {
  id: WorkbenchId;
  number: string;
  eyebrow: string;
  title: string;
  description: string;
  href: WorkbenchRoute;
  action: string;
  status: string;
  capabilities: readonly string[];
  previewKind: PreviewKind;
  featured: boolean;
  ariaLabel: string;
  previewAriaLabel: string;
};

type HomeChapterContent = {
  id: "target" | "generate" | "verify";
  number: string;
  title: string;
  description: string;
};

type HomeFactContent = {
  id: "workbenches" | "runtime" | "license" | "synthesis";
  label: string;
  detail: string;
};

export type HomeContent = {
  locale: Language;
  skipLabel: string;
  nav: {
    ariaLabel: string;
    homeLabel: string;
    workbenchesLabel: string;
    workbenchesAriaLabel: string;
    githubLabel: string;
    githubAriaLabel: string;
    githubHref: string;
    languageLabel: string;
  };
  hero: {
    eyebrow: string;
    headline: string;
    intro: string;
    primaryCta: string;
    secondaryCta: string;
    sceneLabels: {
      sceneAriaLabel: string;
      playAriaLabel: string;
      pauseAriaLabel: string;
      phaseLabel: string;
      solverLabel: string;
      solverReadyLabel: string;
      trajectoryLabel: string;
    };
  };
  chapters: readonly HomeChapterContent[];
  facts: readonly HomeFactContent[];
  workbenchSection: {
    eyebrow: string;
    title: string;
    intro: string;
    featuredLabel: string;
    ariaLabel: string;
  };
  workbenches: readonly WorkbenchCardContent[];
  openSource: {
    eyebrow: string;
    title: string;
    description: string;
    cta: string;
    href: string;
    ariaLabel: string;
  };
  footer: {
    tagline: string;
    licenseLabel: string;
    githubLabel: string;
    githubAriaLabel: string;
    githubHref: string;
  };
  aria: {
    mainLabel: string;
    chaptersLabel: string;
    factRailLabel: string;
    workbenchesLabel: string;
    openSourceLabel: string;
    footerLabel: string;
  };
};

const GITHUB_HREF = "https://github.com/tutao0123/open-linkage";

export const HOME_CONTENT = {
  zh: {
    locale: "zh",
    skipLabel: "跳至主要内容",
    nav: {
      ariaLabel: "主页导航",
      homeLabel: "OpenLinkage 首页",
      workbenchesLabel: "工作台",
      workbenchesAriaLabel: "跳至设计工作台",
      githubLabel: "GitHub",
      githubAriaLabel: "在 GitHub 打开 OpenLinkage（新窗口）",
      githubHref: GITHUB_HREF,
      languageLabel: "语言选择",
    },
    hero: {
      eyebrow: "PLANAR MECHANISM DESIGN, IN THE BROWSER",
      headline: "从一条轨迹，到一套会动的机构。",
      intro: "OpenLinkage 把目标轨迹、机构综合与性能验证放进同一个浏览器工作流。选择合适的工作台，把想要的运动变成可验证、可继续编辑的机构。",
      primaryCta: "选择工作台",
      secondaryCta: "试试可变几何腿",
      sceneLabels: {
        sceneAriaLabel: "可变几何步行腿运动与足端轨迹预览",
        playAriaLabel: "播放机构运动",
        pauseAriaLabel: "暂停机构运动",
        phaseLabel: "主轴相位",
        solverLabel: "求解状态",
        solverReadyLabel: "整周求解完成",
        trajectoryLabel: "足端轨迹",
      },
    },
    chapters: [
      {
        id: "target",
        number: "01",
        title: "定义运动目标",
        description: "用目标足端轨迹、步长、抬脚高度与速度，把想要的运动变成清晰的设计输入。",
      },
      {
        id: "generate",
        number: "02",
        title: "自动生成机构方案",
        description: "在浏览器中搜索机构尺寸与调节方式，并比较能够完成目标的候选方案。",
      },
      {
        id: "verify",
        number: "03",
        title: "验证性能并继续设计",
        description: "查看足端轨迹、主轴相位和整周求解状态，再进入工作台细化方案或重新定义目标。",
      },
    ],
    facts: [
      { id: "workbenches", label: "5 个工作台", detail: "分析、综合与自由搭建" },
      { id: "runtime", label: "浏览器端", detail: "无需本地安装" },
      { id: "license", label: "开源", detail: "Apache-2.0" },
      { id: "synthesis", label: "多工况综合", detail: "一次比较多种运动目标" },
    ],
    workbenchSection: {
      eyebrow: "DESIGN WORKBENCHES",
      title: "选择适合这次任务的工作台",
      intro: "从标准机构分析、目标轨迹综合到自由拓扑搭建，每个工作台都从一个明确的设计任务开始。",
      featuredLabel: "重点推荐",
      ariaLabel: "机构设计工作台",
    },
    workbenches: [
      {
        id: "four-bar",
        number: "01",
        eyebrow: "FOUR-BAR DESIGN",
        title: "四杆机构设计",
        description: "分析曲柄摇杆、双曲柄与双摇杆机构；绘制目标轨迹，并自动拟合四杆尺寸。",
        href: "/lab",
        action: "进入四杆工作台",
        status: "分析 · 轨迹拟合",
        capabilities: ["运动分析", "轨迹拟合"],
        previewKind: "four-bar",
        featured: false,
        ariaLabel: "进入四杆机构设计工作台",
        previewAriaLabel: "四杆机构与连杆点轨迹预览",
      },
      {
        id: "six-bar-leg",
        number: "02",
        eyebrow: "SIX-BAR SYNTHESIS",
        title: "六杆腿机构综合",
        description: "绘制步行或奔跑的足端轨迹，生成并比较兼顾精度、装配连续性与传动性能的六杆方案。",
        href: "/leg",
        action: "进入六杆腿工作台",
        status: "机械腿 · 多方案综合",
        capabilities: ["足端轨迹", "多方案综合"],
        previewKind: "six-bar",
        featured: false,
        ariaLabel: "进入六杆腿机构综合工作台",
        previewAriaLabel: "六杆腿机构与足端轨迹预览",
      },
      {
        id: "variable-leg",
        number: "03",
        eyebrow: "VARIABLE GEOMETRY LEG",
        title: "可变几何步行腿",
        description: "以克兰腿和简森腿为原型，通过移动固定铰点或锁止伸缩杆，让同一机构适配巡航、高速与越障轨迹。",
        href: "/variable-leg",
        action: "试试可变几何腿",
        status: "多工况 · 轨迹族综合",
        capabilities: ["多工况目标", "几何调节", "整周验证"],
        previewKind: "variable-leg",
        featured: true,
        ariaLabel: "进入可变几何步行腿工作台（重点推荐）",
        previewAriaLabel: "可变几何步行腿与多工况足端轨迹预览",
      },
      {
        id: "straight-line",
        number: "04",
        eyebrow: "STRAIGHT-LINE MECHANISMS",
        title: "经典直线机构",
        description: "比较瓦特、切比雪夫、霍肯与波塞利耶机构，识别最佳直线段并评价行程、偏差与速度均匀性。",
        href: "/straight-line",
        action: "进入直线机构工作台",
        status: "经典机构 · 直线性能",
        capabilities: ["机构比较", "直线性能"],
        previewKind: "straight-line",
        featured: false,
        ariaLabel: "进入经典直线机构工作台",
        previewAriaLabel: "经典直线机构与近似直线路径预览",
      },
      {
        id: "free-mechanism",
        number: "05",
        eyebrow: "FREE MECHANISM",
        title: "自由机构设计器",
        description: "像搭积木一样添加铰点与杆件，指定主动杆，并实时观察任意平面机构的运动与轨迹。",
        href: "/designer",
        action: "开始自由搭建",
        status: "N 杆 · 自由拓扑",
        capabilities: ["自由拓扑", "实时运动"],
        previewKind: "free-mechanism",
        featured: false,
        ariaLabel: "进入自由机构设计器",
        previewAriaLabel: "自由拓扑平面机构运动预览",
      },
    ],
    openSource: {
      eyebrow: "OPEN ENGINEERING",
      title: "把机构设计留在可复现、可继续的工作流里。",
      description: "OpenLinkage 以 Apache-2.0 开源。查看源码、复现实验，或基于现有工作台继续构建。",
      cta: "在 GitHub 上查看 OpenLinkage",
      href: GITHUB_HREF,
      ariaLabel: "在 GitHub 查看 OpenLinkage 源码（新窗口）",
    },
    footer: {
      tagline: "面向学生与创客的平面机构设计工具。",
      licenseLabel: "Apache-2.0 许可证",
      githubLabel: "GitHub",
      githubAriaLabel: "在 GitHub 打开 OpenLinkage（新窗口）",
      githubHref: GITHUB_HREF,
    },
    aria: {
      mainLabel: "OpenLinkage 主页",
      chaptersLabel: "从目标到验证的设计流程",
      factRailLabel: "OpenLinkage 产品信息",
      workbenchesLabel: "选择设计工作台",
      openSourceLabel: "OpenLinkage 开源项目",
      footerLabel: "网站页脚",
    },
  },
  en: {
    locale: "en",
    skipLabel: "Skip to main content",
    nav: {
      ariaLabel: "Home navigation",
      homeLabel: "OpenLinkage home",
      workbenchesLabel: "Workbenches",
      workbenchesAriaLabel: "Jump to design workbenches",
      githubLabel: "GitHub",
      githubAriaLabel: "Open OpenLinkage on GitHub (new window)",
      githubHref: GITHUB_HREF,
      languageLabel: "Language selection",
    },
    hero: {
      eyebrow: "PLANAR MECHANISM DESIGN, IN THE BROWSER",
      headline: "From one trajectory to a mechanism in motion.",
      intro: "OpenLinkage brings target trajectories, mechanism synthesis, and performance checks into one browser workflow. Choose the right workbench and turn the motion you want into a mechanism you can verify and keep editing.",
      primaryCta: "Choose a workbench",
      secondaryCta: "Try the variable-geometry leg",
      sceneLabels: {
        sceneAriaLabel: "Variable-geometry walking leg motion and foot-path preview",
        playAriaLabel: "Play mechanism motion",
        pauseAriaLabel: "Pause mechanism motion",
        phaseLabel: "Crank phase",
        solverLabel: "Solver status",
        solverReadyLabel: "Full cycle solved",
        trajectoryLabel: "Foot path",
      },
    },
    chapters: [
      {
        id: "target",
        number: "01",
        title: "Define the motion target",
        description: "Turn a target foot path, step length, clearance, and speed into clear design inputs.",
      },
      {
        id: "generate",
        number: "02",
        title: "Generate mechanism designs",
        description: "Search mechanism dimensions and adjustment methods in the browser, then compare candidates that can meet the target.",
      },
      {
        id: "verify",
        number: "03",
        title: "Verify performance and keep designing",
        description: "Inspect the foot path, crank phase, and full-cycle solver status, then refine the design or redefine the target in a workbench.",
      },
    ],
    facts: [
      { id: "workbenches", label: "5 workbenches", detail: "Analysis, synthesis, and free-form building" },
      { id: "runtime", label: "In the browser", detail: "No local installation" },
      { id: "license", label: "Open source", detail: "Apache-2.0" },
      { id: "synthesis", label: "Multi-condition synthesis", detail: "Compare several motion targets together" },
    ],
    workbenchSection: {
      eyebrow: "DESIGN WORKBENCHES",
      title: "Choose the right workbench for this task",
      intro: "From standard mechanism analysis and target-path synthesis to free-form topology building, each workbench starts with a focused design task.",
      featuredLabel: "Featured",
      ariaLabel: "Mechanism design workbenches",
    },
    workbenches: [
      {
        id: "four-bar",
        number: "01",
        eyebrow: "FOUR-BAR DESIGN",
        title: "Four-bar Mechanism Design",
        description: "Analyze crank-rocker, double-crank, and double-rocker mechanisms, draw a target path, and fit four-bar dimensions automatically.",
        href: "/lab",
        action: "Open the four-bar workbench",
        status: "Analysis · Path fitting",
        capabilities: ["Motion analysis", "Path fitting"],
        previewKind: "four-bar",
        featured: false,
        ariaLabel: "Open the Four-bar Mechanism Design workbench",
        previewAriaLabel: "Four-bar mechanism and coupler-path preview",
      },
      {
        id: "six-bar-leg",
        number: "02",
        eyebrow: "SIX-BAR SYNTHESIS",
        title: "Six-bar Leg Synthesis",
        description: "Draw a foot path for walking or running, then generate and compare six-bar designs for accuracy, assembly continuity, and transmission quality.",
        href: "/leg",
        action: "Open the six-bar leg workbench",
        status: "Walking legs · Multi-design synthesis",
        capabilities: ["Foot paths", "Multi-design synthesis"],
        previewKind: "six-bar",
        featured: false,
        ariaLabel: "Open the Six-bar Leg Synthesis workbench",
        previewAriaLabel: "Six-bar leg mechanism and foot-path preview",
      },
      {
        id: "variable-leg",
        number: "03",
        eyebrow: "VARIABLE GEOMETRY LEG",
        title: "Variable-geometry Walking Leg",
        description: "Adapt one Klann or Jansen mechanism to cruise, high-speed, and obstacle paths using a movable ground pivot or lockable telescopic link.",
        href: "/variable-leg",
        action: "Try the variable-geometry leg",
        status: "Multiple conditions · Path-family synthesis",
        capabilities: ["Multiple conditions", "Geometry adjustment", "Full-cycle checks"],
        previewKind: "variable-leg",
        featured: true,
        ariaLabel: "Open the Variable-geometry Walking Leg workbench (featured)",
        previewAriaLabel: "Variable-geometry walking leg and multi-condition foot-path preview",
      },
      {
        id: "straight-line",
        number: "04",
        eyebrow: "STRAIGHT-LINE MECHANISMS",
        title: "Classic Straight-line Mechanisms",
        description: "Compare Watt, Chebyshev, Hoekens, and Peaucellier mechanisms, identify the best straight segment, and evaluate stroke, deviation, and speed uniformity.",
        href: "/straight-line",
        action: "Open the straight-line workbench",
        status: "Classic mechanisms · Straightness",
        capabilities: ["Mechanism comparison", "Straight-line performance"],
        previewKind: "straight-line",
        featured: false,
        ariaLabel: "Open the Classic Straight-line Mechanisms workbench",
        previewAriaLabel: "Classic straight-line mechanism and approximate straight path preview",
      },
      {
        id: "free-mechanism",
        number: "05",
        eyebrow: "FREE MECHANISM",
        title: "Free Mechanism Designer",
        description: "Add joints and links like building blocks, choose an input link, and inspect the motion and paths of any planar mechanism in real time.",
        href: "/designer",
        action: "Start building freely",
        status: "N-link · Free topology",
        capabilities: ["Free topology", "Live motion"],
        previewKind: "free-mechanism",
        featured: false,
        ariaLabel: "Open the Free Mechanism Designer",
        previewAriaLabel: "Free-topology planar mechanism motion preview",
      },
    ],
    openSource: {
      eyebrow: "OPEN ENGINEERING",
      title: "Keep mechanism design reproducible and ready to continue.",
      description: "OpenLinkage is available under Apache-2.0. Read the source, reproduce an experiment, or build on the existing workbenches.",
      cta: "View OpenLinkage on GitHub",
      href: GITHUB_HREF,
      ariaLabel: "View the OpenLinkage source on GitHub (new window)",
    },
    footer: {
      tagline: "Planar mechanism design tools for students and makers.",
      licenseLabel: "Apache-2.0 license",
      githubLabel: "GitHub",
      githubAriaLabel: "Open OpenLinkage on GitHub (new window)",
      githubHref: GITHUB_HREF,
    },
    aria: {
      mainLabel: "OpenLinkage home",
      chaptersLabel: "Design workflow from target to verification",
      factRailLabel: "OpenLinkage product facts",
      workbenchesLabel: "Choose a design workbench",
      openSourceLabel: "OpenLinkage open-source project",
      footerLabel: "Site footer",
    },
  },
} as const satisfies Record<Language, HomeContent>;

export function getHomeContent(language: Language): HomeContent {
  return HOME_CONTENT[language];
}
