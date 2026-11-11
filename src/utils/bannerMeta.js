// Banner Atlas 的拼图元数据定义。前端唯一来源。
//
// 注意：SIZE_TIERS 与数据侧生成脚本使用的同名常量必须保持一致，
// 改动其中一处时必须同步另一处（数据侧写 label，前端负责排序与下拉选项）。

// 拼图规模档位：≤6 / 7-12 / 13-20，此后每 6 个一档递增，末档 123-128，最后一档 >128。
// 共 22 档。前三档宽度不规则（6、6、8），从 20 起每档 +6，正好落在 128。
export const SIZE_TIERS = (() => {
  const tiers = ["≤6", "7-12", "13-20"];
  for (let start = 21; start <= 123; start += 6) tiers.push(`${start}-${start + 5}`);
  tiers.push(">128");
  return tiers;
})();

// 拼图类型（一级）：有 eventStartDate 的是 MD 拼图，否则是玩家自制拼图。
export const CATEGORIES = ["player", "mission-day"];

// 任务顺序约束（Bannergress 的 type）。注意它**不是**拼图类型的判据。
export const ORDER_TYPES = ["sequential", "anyOrder"];

// ---------------------------------------------------------------------------
// 拼图的「portal 操作类型」（Bannergress 的 steps[].objective）。
//
// 与数据侧的 PORTAL_OBJECTIVES 必须一致：数据侧按这个顺序写数组，
// 前端按同一个顺序渲染，两边错位会让标签顺序漂移。
//
// 两条口径：
//   1. **只记 presence，不记次数** —— 一个拼图里出现过就算，出现几次不影响标签。
//   2. **不含 `viewWaypoint`** —— 实测它的步骤全部是 `fieldTripWaypoint`、从不是 portal，
//      所以不属于「portal 操作」。
//   `takePhoto` 官方枚举里有但实际数据中可能没有，保留在常量里以便出现时自动生效，
//      UI 侧按「0 行不显示」处理（和 sizeTiers 的做法一致）。
// ---------------------------------------------------------------------------
export const PORTAL_OBJECTIVES = [
  "hack",
  "enterPassphrase",
  "captureOrUpgrade",
  "createLink",
  "createField",
  "installMod",
  "takePhoto",
];

const OBJECTIVE_LABELS = {
  hack: "objectiveHack",
  enterPassphrase: "objectiveEnterPassphrase",
  captureOrUpgrade: "objectiveCaptureOrUpgrade",
  createLink: "objectiveCreateLink",
  createField: "objectiveCreateField",
  installMod: "objectiveInstallMod",
  takePhoto: "objectiveTakePhoto",
};

/** 操作类型的可读文案；未知值返回 null，由调用方决定回退。 */
export function objectiveLabel(objective, t) {
  const key = OBJECTIVE_LABELS[objective];
  return key ? t(key) : null;
}

/** 把数据侧的 objectives 数组规整成「已知操作、按 PORTAL_OBJECTIVES 顺序」的列表。 */
export function objectiveEntries(objectives) {
  if (!Array.isArray(objectives)) return [];
  return PORTAL_OBJECTIVES.filter((key) => objectives.includes(key));
}

// 完成人次下限筛选。
export const COMPLETION_THRESHOLDS = [10, 30, 100, 300];

// 排序主轴：完成人次（min）> 任务数 > 评分。
export const SORT_OPTIONS = ["completions", "missions", "rating"];
// 排序方向：desc = 高值在前（默认），asc = 低值在前。
export const SORT_DIRECTIONS = ["desc", "asc"];

export const sizeTierOf = (count) => {
  if (!Number.isFinite(count)) return null;
  if (count <= 6) return SIZE_TIERS[0];
  if (count <= 12) return SIZE_TIERS[1];
  if (count <= 20) return SIZE_TIERS[2];
  if (count > 128) return SIZE_TIERS[SIZE_TIERS.length - 1];
  return SIZE_TIERS[3 + Math.floor((count - 21) / 6)];
};

export const categoryOf = (date) => (date ? "mission-day" : "player");

// 阵营键。小写，直接用作 CSS 类后缀（faction-text--<key>）与 i18n 键名。
export const FACTION_KEYS = ["resistance", "enlightened", "machina", "neutral", "unknown"];

/**
 * 阵营归一化。数据侧（Bannergress）写的是 ENLIGHTENED / RESISTANCE，
 * 这里统一成样式与文案用的小写键；无法识别的一律落到 "unknown"。
 */
export function normalizeFaction(value) {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (["R", "RES", "RESISTANCE"].includes(normalized)) return "resistance";
  if (["E", "ENL", "ENLIGHTENED"].includes(normalized)) return "enlightened";
  if (["M", "MACHINA"].includes(normalized)) return "machina";
  if (["N", "NEUTRAL", "NONE"].includes(normalized)) return "neutral";
  return "unknown";
}

/** 作者分隔符：中文用顿号，其它语言用半角逗号。 */
export const authorSeparator = (language) => (language === "zh" ? "、" : ", ");

/** 拼图作者列表（含归一化阵营），供逐人渲染时使用；无名条目直接丢弃。 */
export function authorEntries(authors) {
  return (authors ?? [])
    .filter((author) => author?.name)
    .map((author) => ({ name: author.name, faction: normalizeFaction(author.faction) }));
}

/** 拼图作者显示名，多个作者用顿号连接。 */
export function formatAuthors(authors, language = "zh") {
  const names = authorEntries(authors).map((author) => author.name);
  if (!names.length) return null;
  return names.join(authorSeparator(language));
}

/** 任务顺序的可读文案；未知值返回 null，由调用方决定回退显示。 */
export function orderTypeLabel(orderType, t) {
  if (orderType === "sequential") return t("orderSequential");
  if (orderType === "anyOrder") return t("orderAnyOrder");
  return null;
}
