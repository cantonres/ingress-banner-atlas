import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// 2026-10-02 的四处界面约定。都是「用户报了 bug 之后定下来的形状」，
// 单测跑不到真实布局，所以这里钉住源码里的结构，防止以后改样式时又改回去。
const read = (relative) => readFileSync(new URL(`../src/${relative}`, import.meta.url), "utf8");
const table = read("components/EventTable.jsx");
const detail = read("components/EventDetail.jsx");
const console_ = read("components/FilterConsole.jsx");
const css = read("styles/views/archive.css");
const archive = read("utils/archive.js");
const messages = read("i18n/messages.js");

test("archive table has no objectives column; labels live in the detail drawer", () => {
  // 第 4 列曾经是「拼图操作」，把城市列挤到 100px、类型徽章被裁没，已撤掉。
  assert.doesNotMatch(table, /ObjectiveBadges/);
  assert.doesNotMatch(table, /event-row__objectives/);
  // 抽屉才是标签的落点。
  assert.match(detail, /ObjectiveBadges/);
  assert.match(detail, /event-facts__objectives/);
});

test("archive table keeps the geography in one element so the category badge cannot be clipped", () => {
  // 「国家」和「· 大区」是两个相邻文本节点：散在 flex 容器里会各自成为匿名 item，
  // 窄列下折成三行；包成一个整体后徽章稳定落到第二行。
  assert.match(table, /event-row__place-geo/);
  assert.match(table, /event-row__place-region/);
  const small = css.match(/\.event-row__place small \{[^}]*\}/)?.[0] ?? "";
  assert.match(small, /display: flex/);
  assert.match(small, /flex-wrap: wrap/);
  assert.match(small, /overflow: hidden/);
  // 曾经用 nowrap 顶住，结果徽章被 overflow: hidden 静默裁掉（用户报的「标签看不到」）。
  assert.doesNotMatch(small, /white-space: nowrap/);
  assert.match(css, /\.event-row__place-geo \{[^}]*white-space: nowrap/);
  // 城市列必须 ≥136px（内容区 112px）：地理信息实测 110px，132px 会把大区尾巴裁掉。
  // 2026-10-17 最前面加了 44px 的「序号」列（.event-row__seq），城市列及其余列宽不变。
  const base = css.match(/\.event-table__header, \.event-row \{ display: grid; grid-template-columns: ([^;]+);/)?.[1];
  assert.equal(base?.trim(), "44px 72px minmax(180px, 1.4fr) 136px 76px 104px 88px 100px");
});

test("narrow archive tiers drop the region suffix instead of clipping it", () => {
  // 5 列（918~1095px）与 4 列（812~917px）档里城市列只剩 108/104px，
  // 按「放不下就收掉」的既有做法隐藏大区后缀，而不是让它被裁。
  const regionHides = [...css.matchAll(/[^{}]*\.event-row__place-region \{ display: none; \}/g)].length;
  assert.equal(regionHides, 2, "只有 5 列 / 4 列两档该隐藏大区后缀");
});

test("detail drawer renders portal objectives with a fallback for missing data", () => {
  // null（没抓到）与 []（确实一个操作都没有）都要退化成文案，不能渲染成空行。
  assert.match(detail, /objectiveEntries\(event\.objectives\)/);
  assert.match(detail, /event\.objectives == null \? "unknown" : "objectiveNone"/);
  assert.match(detail, /t\("bannerObjectives"\)/);
});

test("filter console exposes portal objectives as a multi-select fieldset", () => {
  assert.match(console_, /PORTAL_OBJECTIVES\.map/);
  assert.match(console_, /aria-pressed=\{active\}/);
  assert.match(console_, /type="button"/);
  assert.match(console_, /objectiveFilterHint/);
  assert.match(console_, /objectiveCounts/);
  // 切换必须走函数式更新：同一帧内连点两个徽章时，闭包里的旧值会让后一次覆盖前一次。
  assert.match(console_, /onFilterChange\("objectives", \(current\) =>/);
});

test("portal objective filter is AND, and the copy says so in all three languages", () => {
  // 语义是「同时含全部选中」。多选在这里是**收窄**，与「含任一」的直觉相反，
  // 所以实现用 every（不是 some），且三语文案都必须把「全部 / all / すべて」写出来，
  // 否则用户会以为多选是在放宽条件。
  assert.match(archive, /objectives\.every\(\(objective\) => \(event\.objectives \?\? \[\]\)\.includes\(objective\)\)/);
  assert.doesNotMatch(archive, /objectives\.some\(/);

  const hints = [...messages.matchAll(/objectiveFilterHint: "([^"]+)"/g)].map((m) => m[1]);
  assert.equal(hints.length, 3, "三语都要有 objectiveFilterHint");
  const [zh, en, ja] = hints;
  assert.match(zh, /全部/);
  assert.match(en, /All/);
  assert.match(ja, /すべて/);
  // 反向：任何一语的旧 OR 文案都不该残留。
  for (const hint of hints) {
    assert.doesNotMatch(hint, /任一|Any selected|いずれか/);
  }
});
