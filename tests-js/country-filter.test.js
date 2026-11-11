import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  countEventsByCountry,
  filterEvents,
  INITIAL_FILTERS,
} from "../src/utils/archive.js";
import { translate } from "../src/i18n/messages.js";

const events = [
  { id: "jp-1", sizeTier: "7-12", region: "APAC", countryCode: "JP", country: "Japan", status: "online" },
  { id: "jp-2", sizeTier: "≤6", region: "APAC", countryCode: "JP", country: "Japan", status: "offline" },
  { id: "tw-1", sizeTier: "13-20", region: "APAC", countryCode: "TW", country: "Taiwan", status: "online" },
  { id: "fr-1", sizeTier: "21-26", region: "EMEA", countryCode: "FR", country: "France", status: "online" },
];

test("country filter selects events by countryCode", () => {
  assert.deepEqual(
    filterEvents(events, { ...INITIAL_FILTERS, country: "JP" }).map((event) => event.id),
    ["jp-1", "jp-2"],
  );
  assert.deepEqual(
    filterEvents(events, { ...INITIAL_FILTERS, country: "FR" }).map((event) => event.id),
    ["fr-1"],
  );
  assert.equal(filterEvents(events, INITIAL_FILTERS).length, 4);
});

test("country filter combines with region, size tier and status", () => {
  const filters = { ...INITIAL_FILTERS, country: "JP", region: "EMEA" };
  assert.deepEqual(filterEvents(events, filters), []);
  const narrowed = {
    ...INITIAL_FILTERS,
    country: "JP",
    sizeTier: "≤6",
    status: "offline",
  };
  assert.deepEqual(filterEvents(events, narrowed).map((event) => event.id), ["jp-2"]);
});

test("country options aggregate counts and skip invalid codes", () => {
  const options = countEventsByCountry([
    ...events,
    { id: "bad-1", countryCode: "jpn", country: "Not a code" },
    { id: "bad-2", country: "Macao" }, // derivable through the override table
  ]);
  assert.deepEqual(
    options.map(({ code, count }) => ({ code, count })),
    [
      { code: "JP", count: 2 },
      { code: "FR", count: 1 },
      { code: "MO", count: 1 },
      { code: "TW", count: 1 },
    ],
  );
  // Macao keeps its source label for display fallback.
  assert.equal(options.find(({ code }) => code === "MO").country, "Macao");
  assert.deepEqual(
    filterEvents([{ id: "lower", countryCode: "jp", country: "Japan" }], {
      ...INITIAL_FILTERS,
      country: "JP",
    }).map(({ id }) => id),
    ["lower"],
  );
  assert.deepEqual(
    filterEvents([{ id: "fallback", country: "Macao" }], {
      ...INITIAL_FILTERS,
      country: "MO",
    }).map(({ id }) => id),
    ["fallback"],
  );
});

test("countries sort by count first, then code", () => {
  const options = countEventsByCountry(events);
  assert.deepEqual(options.map(({ code }) => code), ["JP", "FR", "TW"]);
});

test("country filter is exposed in the filter console and active chips", () => {
  const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  const consoleSource = readFileSync(new URL("../src/components/FilterConsole.jsx", import.meta.url), "utf8");
  const chipsSource = readFileSync(new URL("../src/components/ActiveFilters.jsx", import.meta.url), "utf8");
  assert.match(consoleSource, /onFilterChange\("country", event\.target\.value\)/);
  assert.match(consoleSource, /displayCountryName\(code, country, language\)/);
  assert.match(chipsSource, /country: \(value, \{ language \}\) => displayCountryName\(value, undefined, language\)/);
  assert.match(
    appSource,
    /const updateFilter = [\s\S]*?urlSelectionIsExplicitRef\.current = false;[\s\S]*?setSelectedId\(null\);/,
  );
});

test("filter console options narrow with the selected parent", () => {
  const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  // 国家候选按已选大区收窄，城市候选再按已选国家收窄。
  assert.match(appSource, /scopeEventsByRegion\(archive\.events, filters\.region\)/);
  assert.match(
    appSource,
    /countEventsByCity\(scopeEventsByCountry\(regionScopedEvents, filters\.country\)\)/,
  );
  // 收窄后失效的下级选择必须被退回「全部」，否则会留下恒为空结果的组合。
  assert.match(appSource, /sanitizeLocationFilters\(archive\.events, next\)/);
  // 深链接带来的矛盾组合也要在档案到位后清理一次。
  assert.match(appSource, /sanitizeLocationFilters\(data\.events, current\)/);
});

test("the macro-region filter is labelled distinctly from country or region", () => {
  // APAC/EMEA/AMER 是跨国大区，不能与「国家或地区」共用「地区」二字。
  assert.equal(translate("zh", "region"), "大区");
  assert.equal(translate("zh", "allRegions"), "全部大区");
  assert.notEqual(translate("zh", "region"), translate("zh", "country"));
  assert.notEqual(translate("ja", "region"), translate("ja", "country"));
});

test("country filter labels are localized in both languages", () => {
  for (const language of ["zh", "en", "ja"]) {
    assert.notEqual(translate(language, "country"), "country");
    assert.notEqual(translate(language, "allCountries"), "allCountries");
  }
  assert.equal(translate("zh", "country"), "国家或地区");
  assert.equal(translate("en", "country"), "Country or region");
  assert.equal(translate("ja", "country"), "国・地域");
});
