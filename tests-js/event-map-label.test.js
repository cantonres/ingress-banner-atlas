import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { eventMapTitle, eventMapLocation } from "../src/utils/eventMapLabel.js";

const { events } = JSON.parse(readFileSync(new URL("../public/data/archive.json", import.meta.url), "utf8"));

test("map titles use banner titles rather than city or a mission prefix", () => {
  assert.equal(eventMapTitle({ title: "轻云蔽月，流风回雪", city: "Taiyuan" }), "轻云蔽月，流风回雪");
  assert.equal(eventMapTitle({ title: "  " , city: "Fallback" }), "Fallback");
  assert.equal(eventMapTitle({ city: "Fallback" }), "Fallback");
});

test("source addresses remain available for ordinary events", () => {
  const event = { id: "synthetic", address: "Taiyuan, Shanxi, China", countryCode: "CN", city: "Taiyuan" };
  assert.equal(eventMapLocation(event), event.address);
  assert.equal(eventMapLocation({ countryCode: "JP", city: "Tokyo", country: "Japan" }), "Tokyo, 日本");
});

test("regional events do not mistake a pin's address for their entire range", () => {
  // 这些拼图覆盖多个市/县/国家，区域标签由 id 决定，不能被单个坐标的地址覆盖。
  const scope = [
    ["md-2024-恆春-efd9", { zh: "恒春半岛", en: "Hengchun", ja: "恒春半島" }, "恆春鎮鵝鑾里"],
    ["mdsss-mission-day-埼玉六宿-f249", { zh: "埼玉县", en: "Saitama", ja: "埼玉県" }, "草加"],
    ["md-2023-kanmon-kaikyo-ab81", { zh: "关门海峡", en: "Kanmon", ja: "関門海峡" }, "下关市"],
    ["mdas-missionday-at-sea-f883", { zh: "开曼群岛", en: "Cayman", ja: "ケイマン" }, "劳德代尔堡"],
  ];
  for (const [id, expected, excluded] of scope) {
    const event = { id, address: `1-1 ${excluded}`, countryCode: "XX", city: "Pin", country: "Pin" };
    for (const language of ["zh", "en", "ja"]) {
      const label = eventMapLocation(event, language);
      assert.ok(label.includes(expected[language]), `${id}/${language}: ${label}`);
      assert.ok(!label.includes(excluded), `${id}/${language}: ${label}`);
    }
  }
});

test("all published events have map titles and location text", () => {
  for (const event of events) {
    assert.ok(eventMapTitle(event));
    assert.ok(eventMapLocation(event));
  }
});
