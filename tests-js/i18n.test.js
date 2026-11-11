import test from "node:test";
import assert from "node:assert/strict";
import { formatLocalizedNumber, localeForLanguage } from "../src/i18n/formatters.js";
import { messages, translate } from "../src/i18n/messages.js";

test("all message catalogs expose the same keys", () => {
  for (const language of ["en", "ja"]) {
    assert.deepEqual(Object.keys(messages.zh).sort(), Object.keys(messages[language]).sort());
  }
});

test("translations preserve all interpolation placeholders", () => {
  const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
  for (const language of ["en", "ja"]) {
    for (const key of Object.keys(messages.zh)) {
      assert.deepEqual(placeholders(messages[language][key]), placeholders(messages.zh[key]), `${language}.${key}`);
    }
  }
});

test("Japanese banner wording works with size tiers and categories", () => {
  assert.equal(translate("ja", "sizeTierTasks", { tier: "33-38" }), "33-38 ミッション");
  assert.equal(translate("ja", "banners"), "バナー");
  assert.equal(translate("ja", "categoryMissionDay"), "Mission Day バナー");
  assert.equal(translate("ja", "categoryPlayer"), "プレイヤー制作バナー");
});

test("translations interpolate named values and fall back safely", () => {
  assert.equal(translate("en", "filteredResults", { count: 12 }), "12 results");
  assert.equal(translate("zh", "missionImageAlt", { city: "佛山" }), "佛山 拼图任务图像");
  assert.equal(translate("ja", "minCompletionsOption", { count: 30 }), "≥ 30 人");
  assert.equal(translate("en", "missingMessage"), "missingMessage");
});

test("Japanese messages preserve UI meaning and count suffixes", () => {
  assert.equal(translate("ja", "pendingSlots"), "ミッション追加待ち");
  assert.equal(translate("ja", "bannerRanking"), "バナーランキング");
  assert.equal(translate("ja", "missionRanking"), "ミッションランキング");
  assert.equal(translate("ja", "sizeDistribution"), "バナーの規模分布");
  assert.equal(`24 / 24 ${translate("ja", "publisherIdentified")}`, "24 / 24 件のミッションで公開者を確認済み");
  assert.equal(translate("ja", "orderSequential"), "順序あり");
  assert.equal(translate("ja", "clearFilter", { label: "33-38" }), "絞り込みを解除：33-38");
});

test("banner and mission completion counts stay distinct in every language", () => {
  // 这两个量语义不同，任何语言里都不能共用同一句文案，否则界面上无法区分。
  for (const language of ["zh", "en", "ja"]) {
    const banner = translate(language, "bannerCompletions");
    const mission = translate(language, "missionCompletions");
    assert.notEqual(banner, "bannerCompletions", `${language}.bannerCompletions is missing`);
    assert.notEqual(mission, "missionCompletions", `${language}.missionCompletions is missing`);
    assert.notEqual(banner, mission, `${language} reuses one label for two different counts`);
  }
  assert.equal(translate("zh", "bannerCompletions"), "拼图完成人数");
  assert.equal(translate("zh", "missionCompletions"), "任务完成人数");
});

test("locale helpers normalize supported and unsupported languages", () => {
  assert.equal(localeForLanguage("en"), "en-US");
  assert.equal(localeForLanguage("zh"), "zh-CN");
  assert.equal(localeForLanguage("ja"), "ja-JP");
  assert.equal(localeForLanguage("unknown"), "zh-CN");
  assert.equal(formatLocalizedNumber(12345, "en"), "12,345");
  assert.equal(formatLocalizedNumber(12345, "ja"), "12,345");
});
