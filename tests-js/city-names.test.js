import test from "node:test";
import assert from "node:assert/strict";
import { citySearchAliases, displayCityName } from "../src/utils/locations.js";
import { filterEvents, INITIAL_FILTERS } from "../src/utils/archive.js";

test("city display names localize while English preserves original labels", () => {
  for (const [code, original, chinese] of [
    ["JP", "Asahikawa", "旭川市"], ["GB", "Oban", "奥本"],
    ["FR", "Paris", "巴黎"], ["CN", "Beijing", "北京市"],
    ["CN", "Taiyuan", "太原市"],
    ["JP", "Kure", "吴市"], ["TW", "桃園市", "桃园市"],
    ["TW", "澎湖縣", "澎湖县"],
    // 词典键必须使用数据源的 place 原名，不能自行简写或改写。
    ["KH", "Krong Siem Reap", "暹粒"],
    ["GB", "Keswick", "凯西克"],
    ["GB", "Kendal", "肯德尔"],
    ["GB", "Windermere", "温德米尔"],
    ["CN", "Harbin", "哈尔滨市"],
    ["CN", "Xiangyang", "襄阳市"],
    ["CN", "Sanya", "三亚市"],
    ["GB", "Norwich", "诺里奇"],
    ["GB", "Nottingham", "诺丁汉"],
    ["CN", "Zhanjiang", "湛江市"],
    ["GB", "Ipswich", "伊普斯威奇"],
    ["GB", "Lowestoft", "洛斯托夫特"],
    ["CN", "Tianjin", "天津市"],
    ["CN", "Qingdao", "青岛市"],
    ["CN", "Zhuhai", "珠海市"],
    ["CN", "Dongguan", "东莞市"],
    ["CN", "Huizhou", "惠州市"],
    ["CN", "Hong Kong", "香港"],
  ]) {
    assert.equal(displayCityName(code, original, "zh"), chinese);
    assert.equal(displayCityName(code, original, "en"), original);
  }
  // 简称必须也能命中：拼图标题里写的是「太原」，筛选器显示的是「太原市」。
  assert.ok(citySearchAliases("CN", "Taiyuan").includes("太原"));
});

test("unknown cities and mismatched country codes never borrow another city's name", () => {
  assert.equal(displayCityName("US", "Paris"), "Paris");
  assert.equal(displayCityName(null, "Paris"), "Paris");
  assert.equal(displayCityName("FR", "Unmapped town"), "Unmapped town");
  assert.equal(displayCityName("CA", "Detroit"), "Detroit");
  assert.equal(displayCityName("BN", "City Centre"), "City Centre");
  assert.equal(displayCityName("KZ", "Nur-Sultan 020000"), "Nur-Sultan 020000");
  assert.equal(displayCityName("FR", "__proto__"), "__proto__");
  assert.equal(displayCityName("FR", null), "—");
  assert.equal(displayCityName("FR", "  "), "—");
  assert.equal(displayCityName(" fr ", " paris "), "巴黎");
  assert.deepEqual(citySearchAliases(null, null), []);
});

test("Chinese aliases and source names find the same events without mutating them", () => {
  // Isolate the location fields: a mission title can also contain "Paris"
  // (or "Parish"), and that broader existing search behavior must remain.
  const cities = [
    { id: "jp-asahikawa", countryCode: "JP", city: "Asahikawa" },
    { id: "fr-paris", countryCode: "FR", city: "Paris" },
    { id: "jp-kure", countryCode: "JP", city: "Kure" },
  ];
  const before = JSON.stringify(cities);
  for (const [chinese, english] of [["旭川", "Asahikawa"], ["巴黎", "Paris"], ["吴市", "Kure"]]) {
    const ids = (query) => filterEvents(cities, { ...INITIAL_FILTERS, query }).map((event) => event.id);
    assert.ok(ids(chinese).length);
    assert.deepEqual(ids(chinese), ids(english));
  }
  assert.equal(JSON.stringify(cities), before);
  const aliases = citySearchAliases("FR", "Paris");
  aliases.push("fake");
  assert.equal(citySearchAliases("FR", "Paris").includes("fake"), false);
});
