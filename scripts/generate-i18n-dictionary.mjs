import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ts from "typescript";

const sourceRoot = path.resolve("src");
const outputFile = path.join(sourceRoot, "lib", "i18n.generated.ts");
const separator = "\n<<<OPENLINKAGE_I18N_SEPARATOR>>>\n";
const hanPattern = /\p{Script=Han}/u;

const manualTranslations = {
  "四杆设计": "Four-bar Design",
  "四杆机构设计": "Four-bar Mechanism Design",
  "六杆腿": "Six-bar Leg",
  "六杆腿设计": "Six-bar Leg Design",
  "六杆腿机构综合": "Six-bar Leg Synthesis",
  "可变步行腿": "Variable-geometry Leg",
  "可变几何步行腿": "Variable-geometry Walking Leg",
  "直线机构": "Straight-line Mechanisms",
  "经典直线机构": "Classic Straight-line Mechanisms",
  "自由设计": "Free Design",
  "自由机构设计器": "Free Mechanism Designer",
  "克兰六杆腿": "Klann Six-bar Leg",
  "简森多杆腿": "Jansen Multi-link Leg",
  "瓦特连杆": "Watt Linkage",
  "彻比雪夫连杆": "Chebyshev Linkage",
  "霍肯连杆": "Hoekens Linkage",
  "波塞利耶–利普金": "Peaucellier–Lipkin",
  "巡航": "Cruise",
  "高速": "High Speed",
  "越障": "Obstacle",
  "机架": "Ground",
  "主动杆": "Input Link",
  "连杆": "Coupler",
  "从动杆": "Output Link",
  "转动副": "Revolute Joint",
  "移动副": "Prismatic Joint",
  "整周连续": "Full-cycle Continuous",
  "不可达相位": "Unreachable Phases",
  "分支变化": "Branch Changes",
  "闭环误差": "Closure Error",
  "奇异裕度": "Singularity Margin",
  "传动角": "Transmission Angle",
  "步长": "Step Length",
  "抬脚": "Foot Clearance",
  "支撑相": "Stance Phase",
  "落地速度": "Landing Speed",
  "可应用": "Applicable",
  "硬约束": "Hard Constraint",
  "软目标": "Soft Target",
  "恢复默认": "Restore Defaults",
  "导出 JSON": "Export JSON",
  "导入 JSON": "Import JSON",
  "导入项目": "Import Project",
  "播放动画": "Play Animation",
  "暂停动画": "Pause Animation",
  "滚轮缩放": "Wheel to zoom",
  "自由度估算": "Estimated DOF",
};

function walkFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return walkFiles(absolute);
    return [absolute];
  });
}

function normalize(value) {
  return value.trim().replace(/\s+/g, " ");
}

function collectSourceText() {
  const exact = new Set();
  const fragments = new Set();
  const files = walkFiles(sourceRoot).filter((file) => (
    /\.(?:ts|tsx|js|jsx)$/.test(file)
    && !/\.test\.[^.]+$/.test(file)
    && !file.endsWith("i18n.generated.ts")
    && !file.endsWith(`${path.sep}i18n.tsx`)
  ));

  for (const file of files) {
    const source = ts.createSourceFile(
      file,
      fs.readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const visit = (node) => {
      if (
        (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isJsxText(node))
        && hanPattern.test(node.text)
      ) {
        const value = normalize(node.text);
        if (value) exact.add(value);
      }
      if (ts.isTemplateExpression(node)) {
        const values = [node.head.text, ...node.templateSpans.map((span) => span.literal.text)];
        for (const rawValue of values) {
          const value = normalize(rawValue);
          if (value && hanPattern.test(value)) fragments.add(value);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return { exact: [...exact], fragments: [...fragments] };
}

function createBatches(values, maximumCharacters = 2800) {
  const batches = [];
  let current = [];
  let length = 0;
  for (const value of values) {
    const additional = value.length + (current.length ? separator.length : 0);
    if (current.length && length + additional > maximumCharacters) {
      batches.push(current);
      current = [];
      length = 0;
    }
    current.push(value);
    length += additional;
  }
  if (current.length) batches.push(current);
  return batches;
}

async function translateBatch(values) {
  const query = encodeURIComponent(values.join(separator));
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&tl=en&dt=t&q=${query}`;
  const payload = JSON.parse(execFileSync(
    process.platform === "win32" ? "curl.exe" : "curl",
    ["-sS", "--max-time", "30", url],
    { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
  ));
  const translated = payload[0].map((item) => item[0]).join("");
  const parts = translated.split(separator.trim()).map((value) => normalize(value));
  if (parts.length !== values.length) {
    if (values.length === 1) return parts;
    const nested = [];
    for (const value of values) nested.push(...await translateBatch([value]));
    return nested;
  }
  return parts;
}

async function translateValues(values) {
  const result = new Map();
  const pending = values.filter((value) => {
    const manual = manualTranslations[value];
    if (manual) result.set(value, manual);
    return !manual;
  });
  const batches = createBatches(pending);
  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index];
    let translated;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        translated = await translateBatch(batch);
        break;
      } catch (error) {
        if (attempt === 2) throw error;
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
    batch.forEach((source, itemIndex) => result.set(source, translated[itemIndex]));
    process.stdout.write(`Translated ${Math.min(pending.length, (index + 1) * batch.length)}/${pending.length}\r`);
  }
  process.stdout.write("\n");
  return result;
}

function sortedObject(map) {
  return Object.fromEntries([...map.entries()].sort(([first], [second]) => first.localeCompare(second, "zh-CN")));
}

const sourceText = collectSourceText();
const allValues = [...new Set([...sourceText.exact, ...sourceText.fragments])];
const translations = await translateValues(allValues);
const exact = new Map(sourceText.exact.map((value) => [value, translations.get(value)]));
const fragments = new Map(sourceText.fragments.map((value) => [value, translations.get(value)]));
const output = `// Generated by scripts/generate-i18n-dictionary.mjs. Do not edit by hand.\n`
  + `export const EXACT_EN_TRANSLATIONS: Record<string, string> = ${JSON.stringify(sortedObject(exact), null, 2)};\n\n`
  + `export const FRAGMENT_EN_TRANSLATIONS: Record<string, string> = ${JSON.stringify(sortedObject(fragments), null, 2)};\n`;
fs.writeFileSync(outputFile, output, "utf8");
console.log(`Wrote ${exact.size} exact translations and ${fragments.size} template fragments to ${outputFile}`);
