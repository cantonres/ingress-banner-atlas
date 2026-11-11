import test from "node:test";
import assert from "node:assert/strict";
import {
  countEventsByAuthor,
  countEventsByCategory,
  countEventsByCity,
  countEventsBySizeTier,
  filterEvents,
  INITIAL_FILTERS,
  matchesQuery,
  sanitizeLocationFilters,
  scopeEventsByCountry,
  scopeEventsByRegion,
  sortEvents,
} from "../src/utils/archive.js";

const events = [
  {
    id: "a",
    title: "太原·轻云蔽月",
    city: "Taiyuan",
    cityId: "taiyuan-5105",
    country: "China",
    countryCode: "CN",
    region: "APAC",
    category: "player",
    sizeTier: "33-38",
    orderType: "sequential",
    missionCount: 36,
    completions: 30,
    averageRating: 97.3,
    status: "online",
    authors: [{ name: "Neoaves", faction: "ENLIGHTENED" }],
    searchText: "First mission Second mission",
  },
  {
    id: "b",
    title: "Berlin Mission Day",
    city: "Berlin",
    cityId: "berlin-1234",
    country: "Germany",
    countryCode: "DE",
    region: "EMEA",
    category: "mission-day",
    sizeTier: "7-12",
    orderType: "anyOrder",
    missionCount: 12,
    completions: 3,
    averageRating: 99,
    status: "offline",
    authors: [{ name: "NIAMission02", faction: "ENLIGHTENED" }],
    searchText: "Historic route",
  },
  {
    id: "c",
    title: "Untitled",
    city: "Unknown",
    country: "Japan",
    countryCode: "JP",
    region: "APAC",
    category: "player",
    sizeTier: "≤6",
    orderType: null,
    missionCount: 4,
    completions: null,
    averageRating: null,
    status: "online",
    authors: [],
    searchText: "",
  },
  {
    id: "d",
    title: "Taipei Mission Day",
    city: "Taipei",
    country: "Taiwan",
    countryCode: "TW",
    region: "APAC",
    category: "mission-day",
    sizeTier: "57-62",
    orderType: "sequential",
    missionCount: 60,
    completions: 12,
    averageRating: 88,
    status: "online",
    authors: [
      { name: "Neoaves", faction: "ENLIGHTENED" },
      { name: "Second Author", faction: "RESISTANCE" },
    ],
    searchText: "",
  },
];

const ids = (list) => list.map((event) => event.id);

test("search includes deferred mission title text", () => {
  assert.equal(matchesQuery(events[0], "second mission"), true);
  assert.equal(matchesQuery(events[1], "second mission"), false);
});

test("standalone search index restores mission-title search for compact summaries", () => {
  const compactEvents = events.map(({ searchText, ...event }) => event);
  const searchIndex = Object.fromEntries(events.map((event) => [event.id, event.searchText]));
  assert.deepEqual(
    ids(
      filterEvents(
        compactEvents,
        { ...INITIAL_FILTERS, query: "second mission" },
        "second mission",
        searchIndex,
      ),
    ),
    ["a"],
  );
});

test("sensitive region display aliases remain searchable", () => {
  assert.equal(matchesQuery(events[3], "台湾地区"), true);
  assert.equal(matchesQuery(events[3], "中國台灣"), true);
  assert.equal(matchesQuery(events[3], "Taiwan"), true);
});

test("filters combine banner category, size tier, order, region and status", () => {
  assert.deepEqual(ids(filterEvents(events, { ...INITIAL_FILTERS, category: "mission-day" })), ["b", "d"]);
  assert.deepEqual(
    ids(filterEvents(events, { ...INITIAL_FILTERS, category: "mission-day", region: "EMEA" })),
    ["b"],
  );
  assert.deepEqual(ids(filterEvents(events, { ...INITIAL_FILTERS, sizeTier: "≤6" })), ["c"]);
  assert.deepEqual(ids(filterEvents(events, { ...INITIAL_FILTERS, orderType: "anyOrder" })), ["b"]);
  assert.deepEqual(
    ids(filterEvents(events, { ...INITIAL_FILTERS, region: "APAC", status: "online" })),
    ["a", "c", "d"],
  );
});

test("city filter matches on cityId and falls back to the city name", () => {
  // cityId 是 Bannergress 的 placeId，唯一且不随语言变化，是首选的筛选键。
  assert.deepEqual(ids(filterEvents(events, { ...INITIAL_FILTERS, city: "taiyuan-5105" })), ["a"]);
  assert.deepEqual(ids(filterEvents(events, { ...INITIAL_FILTERS, city: "berlin-1234" })), ["b"]);
  // 没有 cityId 的拼图退回用城市名当键（countEventsByCity 用的是同一个键）。
  assert.deepEqual(ids(filterEvents(events, { ...INITIAL_FILTERS, city: "Unknown" })), ["c"]);
  assert.deepEqual(ids(filterEvents(events, { ...INITIAL_FILTERS, city: "Taiyuan" })), []);
  // 与其它筛选条件叠加。
  assert.deepEqual(
    ids(filterEvents(events, { ...INITIAL_FILTERS, city: "taiyuan-5105", status: "offline" })),
    [],
  );
});

test("countEventsByCity keys on cityId and reports country for localized labels", () => {
  // 行序按拼图数降序（并列时按城市名），这里只关心键与随行字段，故转成对象比较。
  const rows = countEventsByCity(events);
  const byKey = Object.fromEntries(
    rows.map((row) => [row.id ?? row.city, [row.countryCode, row.count]]),
  );
  assert.deepEqual(byKey, {
    "taiyuan-5105": ["CN", 1],
    "berlin-1234": ["DE", 1],
    Unknown: ["JP", 1],
    Taipei: ["TW", 1],
  });
});

test("region and country narrowing keep only the options that can return results", () => {
  assert.equal(scopeEventsByRegion(events, "all"), events);
  assert.equal(scopeEventsByRegion(events, undefined), events);
  assert.deepEqual(ids(scopeEventsByRegion(events, "APAC")), ["a", "c", "d"]);
  assert.equal(scopeEventsByCountry(events, "all"), events);
  assert.deepEqual(ids(scopeEventsByCountry(events, "JP")), ["c"]);
  // 叠加使用时，收窄是逐级的：APAC 里没有德国。
  assert.deepEqual(ids(scopeEventsByCountry(scopeEventsByRegion(events, "APAC"), "DE")), []);
  // 国家码要归一化后再比，小写和靠 country 名推断出来的码都要认。
  assert.deepEqual(ids(scopeEventsByCountry([{ id: "x", countryCode: "jp" }], "JP")), ["x"]);
  assert.deepEqual(ids(scopeEventsByCountry([{ id: "y", country: "Macao" }], "MO")), ["y"]);
});

test("stale child selections fall back to all instead of an always-empty combination", () => {
  // 大区改成 APAC 后，GB 不再存在 → 国家与城市一起退回「全部」。
  const stale = { ...INITIAL_FILTERS, region: "APAC", country: "GB", city: "oban-f520" };
  assert.deepEqual(sanitizeLocationFilters(events, stale), {
    ...stale,
    country: "all",
    city: "all",
  });
  // 国家仍成立、只是城市不属于该国 → 只退回城市。
  const mixed = { ...INITIAL_FILTERS, country: "CN", city: "berlin-1234" };
  assert.deepEqual(sanitizeLocationFilters(events, mixed), { ...mixed, city: "all" });
  // 三级都成立时原样返回同一个对象，避免无意义的重渲染。
  const consistent = { ...INITIAL_FILTERS, region: "APAC", country: "CN", city: "taiyuan-5105" };
  assert.equal(sanitizeLocationFilters(events, consistent), consistent);
  assert.equal(sanitizeLocationFilters(events, INITIAL_FILTERS), INITIAL_FILTERS);
  // 缺字段的 filters 不做推断：没有 country/city 就没有失效的选择，原样返回。
  assert.deepEqual(sanitizeLocationFilters(events, { region: "APAC" }), { region: "APAC" });
});

test("author filter matches any listed banner author", () => {
  assert.deepEqual(ids(filterEvents(events, { ...INITIAL_FILTERS, author: "Neoaves" })), ["a", "d"]);
  assert.deepEqual(
    ids(filterEvents(events, { ...INITIAL_FILTERS, author: "Second Author" })),
    ["d"],
  );
  assert.deepEqual(ids(filterEvents(events, { ...INITIAL_FILTERS, author: "Nobody" })), []);
});

test("portal objective filter is a multi-select AND and never guesses for unknown data", () => {
  const objectiveEvents = [
    { id: "hackOnly", objectives: ["hack"] },
    { id: "hackPass", objectives: ["hack", "enterPassphrase"] },
    { id: "passOnly", objectives: ["enterPassphrase"] },
    { id: "modOnly", objectives: ["installMod"] },
    // 三项齐全：用来验证 AND 的「全部都要」，OR 下它会和 passOnly 一起被选中而区分不出来。
    { id: "passMod", objectives: ["hack", "enterPassphrase", "installMod"] },
    { id: "empty", objectives: [] },
    // objectives 为 null = 没抓到该拼图的操作数据，与「一个操作都没有」不同。
    { id: "unknown", objectives: null },
  ];
  const withObjectives = (objectives) => filterEvents(objectiveEvents, { ...INITIAL_FILTERS, objectives });

  // 空数组 = 不筛，全部保留。
  assert.equal(withObjectives([]).length, objectiveEvents.length);
  // 单选：只有含该操作的命中。
  assert.deepEqual(ids(withObjectives(["installMod"])), ["modOnly", "passMod"]);
  // 多选是 AND（选中的**全部**都要有），不是 OR。所以 passOnly 不命中 —— 它没有 installMod。
  assert.deepEqual(ids(withObjectives(["enterPassphrase", "installMod"])), ["passMod"]);
  // AND 的收窄性质：A∧B 的结果 = A 的结果 ∩ B 的结果，且必然 ⊆ 任一单选结果。
  assert.deepEqual(
    ids(withObjectives(["enterPassphrase", "installMod"])),
    ids(withObjectives(["enterPassphrase"])).filter((id) =>
      ids(withObjectives(["installMod"])).includes(id),
    ),
  );
  for (const selection of [["hack"], ["enterPassphrase", "installMod"], ["hack", "installMod"]]) {
    const hit = ids(withObjectives(selection));
    for (const single of selection) {
      const singleHit = ids(withObjectives([single]));
      assert.ok(
        hit.every((id) => singleHit.includes(id)),
        `${selection.join("+")} 必须整体落在 ${single} 之内`,
      );
    }
  }
  // 选得越多命中越少（不会变多）——AND 的核心不变量，与具体数据无关。
  assert.ok(
    withObjectives(["enterPassphrase", "installMod"]).length <=
      withObjectives(["enterPassphrase"]).length,
  );
  // 没抓到数据的拼图不算命中（不知道就不该说它匹配），
  // 「确实一个操作都没有」的同样不命中（空数组不可能含任何选中项）。
  assert.deepEqual(ids(withObjectives(["hack"])), ["hackOnly", "hackPass", "passMod"]);
  assert.equal(withObjectives(["hack"]).some((event) => event.objectives === null), false);
  assert.equal(withObjectives(["hack"]).some((event) => event.id === "empty"), false);
  // 与其它筛选条件叠加时 AND 仍然成立（这里加一个会清空结果的条件做对照）。
  assert.deepEqual(
    ids(filterEvents(objectiveEvents, { ...INITIAL_FILTERS, objectives: ["hack"], status: "online" })),
    [],
  );
});

test("completion floor drops lower counts and keeps unknown counts out", () => {
  assert.deepEqual(
    ids(filterEvents(events, { ...INITIAL_FILTERS, minCompletions: "10" })),
    ["a", "d"],
  );
  assert.deepEqual(
    ids(filterEvents(events, { ...INITIAL_FILTERS, minCompletions: "30" })),
    ["a"],
  );
  // minCompletions 是 min 定义；未知完成数的拼图不满足任何下限。
  assert.equal(filterEvents(events, { ...INITIAL_FILTERS, minCompletions: "0" }).length, 3);
});

test("sortEvents orders by the completion > mission count > rating main axis", () => {
  assert.deepEqual(ids(sortEvents(events, "completions")), ["a", "d", "b", "c"]);
  assert.deepEqual(ids(sortEvents(events, "missions")), ["d", "a", "b", "c"]);
  assert.deepEqual(ids(sortEvents(events, "rating")), ["b", "a", "d", "c"]);
  // 未知值永远排在已知值之后，而不是当成 0 混进结果里。
  assert.equal(sortEvents(events, "completions").at(-1).id, "c");
});

test("ascending order mirrors descending but keeps unknown values last", () => {
  // 升序是降序的反转，但未知值（无评分 / 无完成人数）不会被反转到最前面——
  // 想看「最低的」不等于想看「没数据的」。
  assert.deepEqual(ids(sortEvents(events, "completions", "asc")), ["b", "d", "a", "c"]);
  assert.deepEqual(ids(sortEvents(events, "rating", "asc")), ["d", "a", "b", "c"]);
  assert.deepEqual(ids(sortEvents(events, "missions", "asc")), ["c", "b", "a", "d"]);
  assert.equal(sortEvents(events, "rating", "asc").at(-1).id, "c");
  assert.equal(sortEvents(events, "completions", "asc").at(-1).id, "c");
  // 方向与维度正交：反转只发生在已知值之间。
  assert.deepEqual(
    ids(sortEvents(events, "completions", "asc")),
    ids(sortEvents(events, "completions", "desc")).slice(0, 3).reverse().concat("c"),
  );
  // 未传方向时保持降序，老调用点不受影响。
  assert.deepEqual(ids(sortEvents(events, "rating")), ids(sortEvents(events, "rating", "desc")));
});

test("countEventsBySizeTier keeps tier definition order and counts empty tiers", () => {
  const counts = countEventsBySizeTier(events);
  assert.equal(counts.length, 22);
  assert.deepEqual(
    counts.filter(({ count }) => count > 0),
    [
      { tier: "≤6", count: 1 },
      { tier: "7-12", count: 1 },
      { tier: "33-38", count: 1 },
      { tier: "57-62", count: 1 },
    ],
  );
});

test("countEventsByCategory splits player-made and Mission Day banners", () => {
  assert.deepEqual(countEventsByCategory(events), { player: 2, missionDay: 2 });
});

test("countEventsByAuthor lists every co-author once with its banner count", () => {
  const rows = countEventsByAuthor(events);
  // 拼图数降序；并列时的名称次序依赖运行环境的 locale，因此这里只比较集合。
  assert.equal(rows[0].name, "Neoaves");
  assert.equal(rows[0].count, 2);
  assert.deepEqual(
    rows.map(({ name, faction, count }) => `${name}:${count}:${faction}`).sort(),
    ["NIAMission02:1:ENLIGHTENED", "Neoaves:2:ENLIGHTENED", "Second Author:1:RESISTANCE"],
  );
});
