import test from "node:test";
import assert from "node:assert/strict";
import { buildStatistics } from "../src/components/data/statistics.js";

// 拼图完成人数（走完整个拼图）与任务完成人数（单个任务）是两个不同的量。
// 这两个测试把「拼图排名必须按前者排」这条规则钉死，防止以后又退化成按任务人次排。

function mission(id, completions, rating = 4.5) {
  return { id, title: id, author: "Agent", completions, rating, offline: false };
}

function banner(id, completions, missions) {
  return {
    id,
    title: id,
    city: "City",
    country: "Country",
    countryCode: "CN",
    region: "APAC",
    category: "player",
    orderType: "sequential",
    missionCount: missions.length,
    completions,
    missions,
  };
}

const events = [
  // 任务人次之和最大（1800），但真正走完拼图的只有 5 人。
  banner("few-finishers-huge-traffic", 5, [mission("m1", 900), mission("m2", 900)]),
  // 任务人次之和很小（81），但走完拼图的有 40 人。
  banner("many-finishers-small-traffic", 40, [mission("m3", 40), mission("m4", 41)]),
  banner("middle", 12, [mission("m5", 12), mission("m6", 13), mission("m7", 14)]),
];

test("banner ranking is ordered by banner completions, not by summed mission completions", () => {
  const stats = buildStatistics(events);
  assert.deepEqual(
    stats.topBanners.map((row) => row.id),
    ["many-finishers-small-traffic", "middle", "few-finishers-huge-traffic"],
  );
  assert.deepEqual(
    stats.topBanners.map((row) => row.completions),
    [40, 12, 5],
  );
  // 若按任务人次排，第一名会变成 few-finishers-huge-traffic（1800 人次）。
  assert.notEqual(stats.topBanners[0].id, "few-finishers-huge-traffic");
});

test("banner ranking rows carry the banner mission count for display", () => {
  const stats = buildStatistics(events);
  const middle = stats.topBanners.find((row) => row.id === "middle");
  assert.equal(middle.missionCount, 3);
});

test("mission ranking stays ordered by each mission's own completion count", () => {
  const stats = buildStatistics(events);
  assert.deepEqual(
    stats.topMissions.slice(0, 3).map((row) => row.id),
    ["m1", "m2", "m4"],
  );
  // 任务排名里必须带得上所属拼图，点击后才能打开对应拼图。
  assert.equal(stats.topMissions[0].eventId, "few-finishers-huge-traffic");
});

test("order type breakdown reports both buckets even when one is empty", () => {
  const stats = buildStatistics(events);
  // 三个合成拼图都是 sequential，anyOrder 必须仍然出现在结果里（读数为 0），
  // 否则界面上读不出「有多少拼图是任意顺序」。
  assert.deepEqual(
    stats.orderTypes.map((row) => [row.orderType, row.events]),
    [["sequential", 3], ["anyOrder", 0]],
  );
  assert.equal(stats.orderTypes[0].missions, 7);
});

test("banners without an order type land in an explicit unknown bucket", () => {
  const stats = buildStatistics([
    ...events,
    { ...banner("no-order", 1, [mission("m8", 2)]), orderType: null },
  ]);
  assert.equal(stats.orderTypes.find((row) => row.orderType === null).events, 1);
  assert.equal(stats.orderTypes.find((row) => row.orderType === "sequential").events, 3);
});

test("rating rows expose banner completions separately from summed mission completions", () => {
  const stats = buildStatistics(events);
  const row = stats.topRatedEvents.find((item) => item.id === "few-finishers-huge-traffic");
  assert.equal(row.bannerCompletions, 5);
  assert.equal(row.completions, 1800);
});

test("equal-rating banners are ordered by banner completions, not by summed mission completions", () => {
  const stats = buildStatistics(events);
  // 三个合成拼图的评分完全相同（都是 4.5），胜负只能看并列决胜键。
  // 旧决胜键是任务人次之和：few-finishers-huge-traffic 会凭 1800 人次排第一，
  // 尽管真正走完那张拼图的只有 5 人 —— 排名与「拼图完成人数」展示列自相矛盾。
  // 改用 bannerCompletions 决胜后，顺序必须与 topBanners 一致（拼图排名表的同一原则）。
  assert.deepEqual(
    stats.topRatedEvents.map((row) => row.id),
    ["many-finishers-small-traffic", "middle", "few-finishers-huge-traffic"],
  );
  // 任务评分榜没有 bannerCompletions 字段，仍按单任务完成人数决胜，行为不变。
  assert.deepEqual(
    stats.topRatedMissions.slice(0, 3).map((row) => row.id),
    ["m1", "m2", "m4"],
  );
});
