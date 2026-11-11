import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  authorEntries,
  authorSeparator,
  formatAuthors,
  normalizeFaction,
  objectiveEntries,
  objectiveLabel,
  PORTAL_OBJECTIVES,
} from "../src/utils/bannerMeta.js";

// 数据侧（Bannergress）写的是 ENLIGHTENED / RESISTANCE，而样式类名与 i18n 键用的是小写
// resistance / enlightened。这层映射一旦错位，作者名会静默掉成 unknown 灰，所以在这里钉死。

test("faction values from the data layer normalize to the keys styles and copy use", () => {
  assert.equal(normalizeFaction("ENLIGHTENED"), "enlightened");
  assert.equal(normalizeFaction("RESISTANCE"), "resistance");
  assert.equal(normalizeFaction("  enlightened  "), "enlightened");
  assert.equal(normalizeFaction("E"), "enlightened");
  assert.equal(normalizeFaction("ENL"), "enlightened");
  assert.equal(normalizeFaction("R"), "resistance");
  assert.equal(normalizeFaction("RES"), "resistance");
  assert.equal(normalizeFaction("MACHINA"), "machina");
  assert.equal(normalizeFaction("NEUTRAL"), "neutral");
});

test("unrecognised or missing factions fall back to unknown instead of throwing", () => {
  assert.equal(normalizeFaction(undefined), "unknown");
  assert.equal(normalizeFaction(null), "unknown");
  assert.equal(normalizeFaction(""), "unknown");
  assert.equal(normalizeFaction("SHAPERS"), "unknown");
});

test("author entries drop nameless records and keep the data order", () => {
  assert.deepEqual(
    authorEntries([
      { name: "stOstarOrz", faction: "RESISTANCE" },
      { name: "", faction: "RESISTANCE" },
      { faction: "ENLIGHTENED" },
      { name: "unclezura", faction: "ENLIGHTENED" },
    ]),
    [
      { name: "stOstarOrz", faction: "resistance" },
      { name: "unclezura", faction: "enlightened" },
    ],
  );
  assert.deepEqual(authorEntries(undefined), []);
});

test("author names join with a locale separator and collapse to null when empty", () => {
  const authors = [
    { name: "asajyan", faction: "RESISTANCE" },
    { name: "rikajyan", faction: "RESISTANCE" },
  ];
  assert.equal(authorSeparator("zh"), "、");
  assert.equal(authorSeparator("en"), ", ");
  assert.equal(authorSeparator("ja"), ", ");
  assert.equal(formatAuthors(authors, "zh"), "asajyan、rikajyan");
  assert.equal(formatAuthors(authors, "en"), "asajyan, rikajyan");
  assert.equal(formatAuthors([], "zh"), null);
  assert.equal(formatAuthors(undefined, "zh"), null);
});

test("the banner dossier colours each author by faction and keeps a non-colour fallback", () => {
  const detail = readFileSync(new URL("../src/components/EventDetail.jsx", import.meta.url), "utf8");
  // 逐作者渲染并套阵营类名，颜色才可能按人变化。
  assert.match(detail, /faction-text--\$\{author\.faction\}/);
  // 只靠颜色区分阵营，色觉障碍用户与读屏都读不出阵营，所以必须有仅读屏可见的阵营名。
  assert.match(detail, /className="sr-only">[\s\S]{0,160}?factionUnknown/);
});

test("the author dropdown colours every option and the closed control", () => {
  const source = readFileSync(
    new URL("../src/components/FilterConsole.jsx", import.meta.url),
    "utf8",
  );
  // 作者选项带的是数据侧的原始值（ENLIGHTENED / RESISTANCE），不归一化类名永远对不上。
  assert.match(source, /normalizeFaction\(author\.faction\)/);
  // 选项本身着上色。
  assert.match(source, /faction-text--\$\{faction\}/);
  // 闭合态显示的文本来自 select 自己的颜色，而 <option> 的着色在部分浏览器里会被忽略，
  // 所以 select 也必须带类名，否则那部分浏览器上颜色会整个丢掉。
  assert.match(source, /faction-text--\$\{selectedFaction\}/);
});

// portal 操作类型：数据侧只给 presence（有没有），前端要按固定顺序渲染。
// 顺序一旦两边不一致，标签会在行内漂移，所以顺序本身也要钉住。
test("portal objectives keep the canonical order and drop unknown values", () => {
  // 数据侧顺序乱序到达时，渲染顺序仍由 PORTAL_OBJECTIVES 决定。
  assert.deepEqual(objectiveEntries(["enterPassphrase", "hack"]), ["hack", "enterPassphrase"]);
  // 未知值、viewWaypoint（不是 portal 操作）、以及非数组输入都不该漏进渲染。
  assert.deepEqual(objectiveEntries(["hack", "viewWaypoint", "nonsense"]), ["hack"]);
  assert.deepEqual(objectiveEntries(null), []);
  assert.deepEqual(objectiveEntries(undefined), []);
  assert.deepEqual(objectiveEntries("hack"), []);
  // null 是「没抓到」，不是「没有操作」——两者在调用方要分开处理。
  assert.equal(PORTAL_OBJECTIVES.includes("viewWaypoint"), false);
  assert.equal(PORTAL_OBJECTIVES.includes("takePhoto"), true);
});

test("every portal objective has an i18n label in all three languages", () => {
  const messages = readFileSync(new URL("../src/i18n/messages.js", import.meta.url), "utf8");
  // 语言块里的键都缩进 4 格；嵌套对象是 6 格，不会被这条匹配到。
  const keys = [...messages.matchAll(/^ {4}(\w+):/gm)].map((match) => match[1]);
  for (const objective of PORTAL_OBJECTIVES) {
    const key = objectiveLabel(objective, (name) => name);
    assert.equal(key, `objective${objective[0].toUpperCase()}${objective.slice(1)}`);
    assert.equal(
      keys.filter((value) => value === key).length,
      3,
      `${key} 必须在 zh / en / ja 各出现一次`,
    );
  }
  // 枚举外的值没有文案，调用方据此回退。
  assert.equal(objectiveLabel("viewWaypoint", (name) => name), null);
  assert.equal(objectiveLabel("nonsense", (name) => name), null);
});
