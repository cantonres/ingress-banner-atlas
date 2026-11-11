import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { INITIAL_FILTERS } from "../src/utils/archive.js";
import { parseUrlState, serializeUrlState } from "../src/utils/urlState.js";

const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

test("empty or default state serializes to a parameterless URL", () => {
  assert.equal(serializeUrlState({ view: "map", filters: INITIAL_FILTERS, event: null }), "");
  assert.equal(serializeUrlState({}), "");
});

test("parse without parameters yields defaults", () => {
  assert.deepEqual(parseUrlState(""), {
    view: "map",
    filters: {
      query: "",
      category: "all",
      sizeTier: "all",
      orderType: "all",
      author: "all",
      region: "all",
      city: "all",
      country: "all",
      status: "all",
      minCompletions: "all",
      // 多选筛选器，默认是空数组（= 不筛），不是 "all"。
      objectives: [],
      sort: "completions",
      sortDir: "desc",
    },
    event: null,
  });
});

test("non-default state round-trips through serialize and parse", () => {
  const state = {
    view: "data",
    filters: {
      query: "太原",
      category: "player",
      sizeTier: "33-38",
      orderType: "sequential",
      author: "Neoaves",
      region: "APAC",
      city: "taiyuan-5105",
      country: "CN",
      status: "online",
      minCompletions: "10",
      // 规范化顺序（PORTAL_OBJECTIVES 里的次序），round-trip 才能逐字段相等。
      objectives: ["enterPassphrase", "captureOrUpgrade"],
      sort: "missions",
      sortDir: "asc",
    },
    event: "轻云蔽月-流风回雪-e012",
  };
  const search = serializeUrlState(state);
  assert.equal(
    search,
    "?view=data&q=%E5%A4%AA%E5%8E%9F&category=player&size=33-38&order=sequential&author=Neoaves&region=APAC&city=taiyuan-5105&country=CN&status=online&minc=10&obj=enterPassphrase%2CcaptureOrUpgrade&sort=missions&dir=asc&event=%E8%BD%BB%E4%BA%91%E8%94%BD%E6%9C%88-%E6%B5%81%E9%A3%8E%E5%9B%9E%E9%9B%AA-e012",
  );
  assert.deepEqual(parseUrlState(search), state);
});

test("size tier labels survive URL encoding, including the unicode boundaries", () => {
  for (const tier of ["≤6", ">128", "123-128"]) {
    const search = serializeUrlState({ filters: { ...INITIAL_FILTERS, sizeTier: tier } });
    assert.equal(new URLSearchParams(search).get("size"), tier);
    assert.equal(parseUrlState(search).filters.sizeTier, tier);
  }
});

test("invalid values fall back to defaults instead of breaking the link", () => {
  const parsed = parseUrlState(
    "?view=explorer&q=&category=nope&size=99-100&order=random&region=MARS&country=JPN&status=hidden&minc=7&sort=chaos&dir=sideways&event=",
  );
  assert.equal(parsed.view, "map");
  assert.equal(parsed.filters.category, "all");
  assert.equal(parsed.filters.sizeTier, "all");
  assert.equal(parsed.filters.orderType, "all");
  assert.equal(parsed.filters.region, "all");
  assert.equal(parsed.filters.country, "all");
  assert.equal(parsed.filters.status, "all");
  assert.equal(parsed.filters.minCompletions, "all");
  assert.equal(parsed.filters.sort, "completions");
  assert.equal(parsed.filters.sortDir, "desc");
  assert.deepEqual(parsed.filters.objectives, []);
  assert.equal(parsed.event, null);
});

test("portal objectives are a multi-select list that canonicalizes to one spelling", () => {
  // 默认（不筛）不写进 URL。
  assert.equal(serializeUrlState({ filters: { ...INITIAL_FILTERS, objectives: [] } }), "");
  // 选中顺序不影响输出：一律按 PORTAL_OBJECTIVES 的固定次序排列，
  // 否则同一种选择会有多种写法，分享链接无法稳定 round-trip。
  assert.equal(
    parseUrlState("?obj=captureOrUpgrade,hack").filters.objectives.join(","),
    "hack,captureOrUpgrade",
  );
  assert.equal(
    parseUrlState("?obj=hack,captureOrUpgrade").filters.objectives.join(","),
    "hack,captureOrUpgrade",
  );
  assert.equal(
    serializeUrlState({
      filters: { ...INITIAL_FILTERS, objectives: ["captureOrUpgrade", "hack"] },
    }),
    "?obj=hack%2CcaptureOrUpgrade",
  );
  // 空白、重复、未知值都被清掉；全部非法时退化成「不筛」而不是留下半截链接。
  assert.equal(parseUrlState("?obj=hack,%20hack").filters.objectives.join(","), "hack");
  assert.equal(parseUrlState("?obj=nope,alsoNope").filters.objectives.length, 0);
  assert.equal(serializeUrlState({ filters: { ...INITIAL_FILTERS, objectives: ["nope"] } }), "");
  // 多个值可以同时存在（多选的核心诉求）。
  assert.equal(parseUrlState("?obj=hack,enterPassphrase,installMod").filters.objectives.length, 3);
});

test("sort direction is shareable and falls back to descending", () => {
  assert.equal(parseUrlState("?dir=asc").filters.sortDir, "asc");
  assert.equal(parseUrlState("?dir=desc").filters.sortDir, "desc");
  assert.equal(parseUrlState("?dir=sideways").filters.sortDir, "desc");
  // 降序是默认值，不写进 URL，免得日常浏览的链接变长。
  assert.equal(serializeUrlState({ filters: { ...INITIAL_FILTERS, sortDir: "desc" } }), "");
  assert.equal(serializeUrlState({ filters: { ...INITIAL_FILTERS, sortDir: "asc" } }), "?dir=asc");
  // 只翻方向、不换维度也要能分享出去。
  assert.equal(
    serializeUrlState({ filters: { ...INITIAL_FILTERS, sort: "rating", sortDir: "asc" } }),
    "?sort=rating&dir=asc",
  );
});

test("banner author is free text but bounded in length", () => {
  assert.equal(parseUrlState("?author=Neoaves").filters.author, "Neoaves");
  assert.equal(parseUrlState(`?author=${"a".repeat(65)}`).filters.author, "all");
  assert.equal(
    serializeUrlState({ filters: { ...INITIAL_FILTERS, author: "a".repeat(65) } }),
    "",
  );
});

test("city is free text (a Bannergress placeId) but bounded in length", () => {
  assert.equal(parseUrlState("?city=oban-f520").filters.city, "oban-f520");
  assert.equal(parseUrlState("?city=taiyuan-5105").filters.city, "taiyuan-5105");
  assert.equal(parseUrlState(`?city=${"a".repeat(65)}`).filters.city, "all");
  assert.equal(serializeUrlState({ filters: { ...INITIAL_FILTERS, city: "a".repeat(65) } }), "");
  // 不存在的 cityId 只是匹配不到任何拼图，不会被当成非法值丢掉。
  assert.equal(parseUrlState("?city=nowhere-0000").filters.city, "nowhere-0000");
});

test("country codes are two-letter and normalize to uppercase", () => {
  assert.equal(parseUrlState("?country=jp").filters.country, "JP");
  assert.equal(parseUrlState("?country=JP").filters.country, "JP");
  assert.equal(parseUrlState("?country=j").filters.country, "all");
  assert.equal(serializeUrlState({ filters: { ...INITIAL_FILTERS, country: "jp" } }), "");
});

test("unknown tracking parameters are ignored", () => {
  const parsed = parseUrlState("?utm_source=telegram&view=archive");
  assert.equal(parsed.view, "archive");
  assert.equal(parsed.filters.query, "");
});

test("whitespace-only search is treated as inactive and omitted", () => {
  const search = serializeUrlState({ filters: { ...INITIAL_FILTERS, query: "   " } });
  assert.equal(search, "");
  assert.equal(parseUrlState("?q=%20%20").filters.query, "  ");
});

test("duplicate parameters resolve to the first value", () => {
  assert.equal(parseUrlState("?view=archive&view=data").view, "archive");
});

test("App restores shareable state from the URL without overriding deep links", () => {
  assert.match(appSource, /parseUrlState\(window\.location\.search\)/);
  assert.match(appSource, /serializeUrlState\(/);
  assert.match(appSource, /requestedValid/);
  assert.match(appSource, /window\.history\.pushState/);
  assert.match(appSource, /window\.history\.replaceState/);
  assert.match(appSource, /addEventListener\("popstate"/);
  // Search typing must not grow history; only the query key replaces in place.
  assert.match(appSource, /key === "query" \? "replace" : "push"/);
});
