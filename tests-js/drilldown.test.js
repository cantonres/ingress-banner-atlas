import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildDrilldownFacets,
  cityKeyOf,
  countryCodeOf,
  filterEvents,
  INITIAL_FILTERS,
} from "../src/utils/archive.js";

// 面板里的钻取链接把「拼图的某个属性」变成筛选条件。这里钉死两条契约：
// 1. 取值口径必须和 filterEvents 完全一致 —— 否则点了筛不出任何结果。
// 2. 被点的拼图必然属于它自己，所以钻取之后它一定还在结果集里，面板不需要跳走。

const events = [
  {
    id: "a",
    city: "Foshan",
    cityId: "foshan-1fb2",
    country: "China",
    countryCode: "CN",
    category: "player",
    authors: [{ name: "ann", faction: "ENLIGHTENED" }],
  },
  {
    id: "b",
    city: "Foshan",
    cityId: "foshan-1fb2",
    country: "China",
    countryCode: "CN",
    category: "mission-day",
    authors: [{ name: "bob", faction: "RESISTANCE" }],
  },
  {
    id: "c",
    city: "Oban",
    cityId: "oban-f520",
    country: "United Kingdom",
    countryCode: "GB",
    category: "player",
    authors: [{ name: "ann", faction: "ENLIGHTENED" }],
  },
];

test("drilling down always keeps the clicked banner in the result set", () => {
  const facets = buildDrilldownFacets(events);
  for (const event of events) {
    const targets = [
      ["city", cityKeyOf(event)],
      ["country", countryCodeOf(event)],
      ["category", event.category],
      ["author", event.authors[0].name],
    ];
    for (const [key, value] of targets) {
      const result = filterEvents(events, { ...INITIAL_FILTERS, [key]: value });
      assert.ok(
        result.some((item) => item.id === event.id),
        `drilling ${key}=${value} dropped ${event.id}`,
      );
      // 没有其它筛选时，钻取后的条数必须正好等于面板上显示的那个数。
      assert.equal(
        result.length,
        facets[key].get(value),
        `facet count for ${key}=${value} disagrees with filterEvents`,
      );
    }
  }
});

test("drill-down facets count the whole archive, not the filtered subset", () => {
  const facets = buildDrilldownFacets(events);
  assert.equal(facets.city.get("foshan-1fb2"), 2);
  assert.equal(facets.city.get("oban-f520"), 1);
  assert.equal(facets.country.get("CN"), 2);
  assert.equal(facets.country.get("GB"), 1);
  assert.equal(facets.category.get("player"), 2);
  assert.equal(facets.category.get("mission-day"), 1);
  assert.equal(facets.author.get("ann"), 2);
  assert.equal(facets.author.get("bob"), 1);
  // 不存在的取值返回 undefined，面板据此不渲染链接。
  assert.equal(facets.city.get("nowhere-0000"), undefined);
});

test("drill-down values are the same keys filterEvents compares against", () => {
  // 城市键优先 cityId，国家码走归一化 —— 这两条正是 filterEvents 内部的比较口径。
  assert.equal(cityKeyOf({ cityId: "foshan-1fb2", city: "Foshan" }), "foshan-1fb2");
  assert.equal(cityKeyOf({ city: "Foshan" }), "Foshan");
  assert.equal(countryCodeOf({ countryCode: "cn", country: "China" }), "CN");
});

test("the banner dossier wires the four drill-down dimensions", () => {
  const detail = readFileSync(
    new URL("../src/components/EventDetail.jsx", import.meta.url),
    "utf8",
  );
  for (const key of ["city", "country", "category", "author"]) {
    assert.match(
      detail,
      new RegExp(`drilldownProps\\("${key}"`),
      `missing drill-down link for ${key}`,
    );
  }
  assert.match(detail, /cityKeyOf\(event\)/);
  assert.match(detail, /countryCodeOf\(event\)/);
});

test("drilling down keeps the current selection instead of jumping to another banner", () => {
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  const block = app.match(/const drillDown = \(key, value\) => \{[\s\S]*?\n  \};/);
  assert.ok(block, "drillDown not found in App.jsx");
  // 与 updateFilter 的唯一区别：不清空选中。被点的要素属于当前拼图，它一定还在结果集里。
  assert.doesNotMatch(block[0], /setSelectedId\(null\)/);
  assert.match(block[0], /sanitizeLocationFilters\(archive\.events/);
});

test("drill-down links are buttons and say why they are already active", () => {
  const link = readFileSync(new URL("../src/components/FilterLink.jsx", import.meta.url), "utf8");
  // 用 button 而不是 a：它不导航，只改筛选状态，写进历史记录的是筛选参数而不是新页面。
  assert.match(link, /<button/);
  assert.doesNotMatch(link, /<a[\s>]/);
  // 已经是这个筛选值时点下去不会变，用 aria-current 说明，而不是让它看起来像坏链接。
  assert.match(link, /aria-current=\{active \? "true" : undefined\}/);
  // 没有回调时降级成纯文本，组件在别处也能安全使用。
  assert.match(link, /return children \?\? null;/);
});
