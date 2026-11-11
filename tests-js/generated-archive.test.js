import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { expandAnalytics } from "../src/utils/archive.js";
import { CATEGORIES, PORTAL_OBJECTIVES, SIZE_TIERS, sizeTierOf } from "../src/utils/bannerMeta.js";

const publicRoot = new URL("../public/", import.meta.url);
const archive = JSON.parse(await readFile(new URL("data/archive.json", publicRoot), "utf8"));
const analyticsPayload = JSON.parse(
  await readFile(new URL("data/analytics.json", publicRoot), "utf8"),
);
const searchIndex = JSON.parse(
  await readFile(new URL("data/search-index.json", publicRoot), "utf8"),
);

test("generated archive metadata matches event summaries", () => {
  assert.equal(archive.meta.eventCount, archive.events.length);
  assert.ok(archive.meta.missionCount > archive.meta.eventCount);
  assert.equal(archive.meta.cityCount, archive.meta.cities.length);
  assert.equal(archive.meta.countryCount, new Set(archive.events.map((e) => e.countryCode)).size);
});

test("size tier metadata covers every tier and matches the summaries", () => {
  assert.deepEqual(archive.meta.sizeTiers.map(({ tier }) => tier), SIZE_TIERS);
  const total = archive.meta.sizeTiers.reduce((sum, { count }) => sum + count, 0);
  assert.equal(total, archive.meta.eventCount);
  for (const event of archive.events) {
    const bucket = archive.meta.sizeTiers.find(({ tier }) => tier === event.sizeTier);
    assert.ok(bucket, `${event.id} uses an undefined size tier ${event.sizeTier}`);
    assert.ok(bucket.count > 0, `${event.id} sits in an empty size tier`);
  }
});

test("banner category is the Mission Day / player-made split, not the mission order", () => {
  const counts = { player: 0, "mission-day": 0 };
  for (const event of archive.events) {
    assert.equal(CATEGORIES.includes(event.category), true, `${event.id}: ${event.category}`);
    counts[event.category] += 1;
    // 有 eventStartDate 才是 MD 拼图；type（sequential / anyOrder）只描述顺序约束。
    assert.equal(event.category === "mission-day", Boolean(event.date), `${event.id}`);
    assert.equal(event.sizeTier, sizeTierOf(event.missionCount), `${event.id}`);
  }
  assert.deepEqual(archive.meta.categoryCounts, counts);
});

test("event summaries follow the completion > mission count > rating main axis", () => {
  const axis = (event) => [event.completions ?? -1, event.missionCount ?? -1, event.averageRating ?? -1];
  for (let index = 1; index < archive.events.length; index += 1) {
    const previous = axis(archive.events[index - 1]);
    const current = axis(archive.events[index]);
    const ordered =
      previous[0] > current[0] ||
      (previous[0] === current[0] && previous[1] > current[1]) ||
      (previous[0] === current[0] && previous[1] === current[1] && previous[2] >= current[2]);
    assert.ok(ordered, `${archive.events[index - 1].id} must sort before ${archive.events[index].id}`);
  }
});

test("every banner carries an author list, a collection date and a width", () => {
  for (const event of archive.events) {
    assert.ok(Array.isArray(event.authors), `${event.id} authors`);
    for (const author of event.authors) {
      assert.equal(typeof author.name, "string");
      assert.ok(author.name.length > 0);
    }
    assert.match(event.dataAsOf, /^\d{4}-\d{2}-\d{2}$/, `${event.id} dataAsOf`);
    if (event.width != null) {
      assert.ok(Number.isInteger(event.width) && event.width >= 1 && event.width <= 6, `${event.id} width`);
    }
  }
});

test("compact analytics expands to the advertised mission count", () => {
  const analytics = expandAnalytics(analyticsPayload);
  assert.equal(analytics.events.length, archive.meta.eventCount);
  assert.equal(
    analytics.events.reduce((total, event) => total + event.missions.length, 0),
    archive.meta.missionCount,
  );
  const firstMissionEvent = analytics.events.find((event) => event.missions.length);
  assert.ok(firstMissionEvent);
  assert.equal(typeof firstMissionEvent.missions[0].title, "string");
  assert.equal("authorFaction" in firstMissionEvent.missions[0], true);
});

test("every event has its published detail file without depending on maintenance tools", async () => {
  let missionCount = 0;
  for (const event of archive.events) {
    const filename = `${Buffer.from(event.id, "utf8").toString("base64url")}.json`;
    assert.equal(event.detailPath, `data/events/${filename}`);
    const detail = JSON.parse(await readFile(new URL(event.detailPath, publicRoot), "utf8"));
    assert.equal(detail.id, event.id);
    assert.equal(event.address, detail.address);
    assert.equal(detail.missionCount, event.missionCount);
    // 拼图说明只随详情下发（摘要保持精简），但内容必须与详情一致。
    assert.equal(typeof detail.description, "string");
    assert.equal("description" in event, false);
    assert.equal(detail.category, event.category);
    assert.equal(detail.sizeTier, event.sizeTier);
    assert.ok(Array.isArray(detail.missions));
    // 原仓库曾为 scheduled（公开预定）活动开过豁免——那些活动没有任务。
    // Banner Atlas 不收未来活动，所有拼图的任务条数必须与 missionCount 一致。
    assert.equal(detail.missions.length, event.missionCount);
    missionCount += detail.missions.length;
  }
  assert.equal(missionCount, archive.meta.missionCount);
});

test("event summaries expose normalized known statuses", () => {
  // 这也是「未知状态」的绊线：若哪天数据里出现集合外的值（例如被删掉的 scheduled
  // 又回来了），这里会立刻失败，而不是静默退化成「未知」。
  const allowedStatuses = new Set(["online", "offline", "partially_offline", "pending_slots"]);
  for (const event of archive.events) {
    assert.equal(
      allowedStatuses.has(event.status),
      true,
      `${event.id} has unexpected status ${event.status}`,
    );
  }
});

test("pending_slots means missing mission slots, not offline missions", () => {
  // 「待补齐」的判据必须有事实支撑：详情里存在没有 id 的槽位。
  // 否则它就会退化成一个无从解释的标签——那正是这个状态存在的意义所在。
  let pendingCount = 0;
  for (const event of archive.events) {
    const detail = JSON.parse(readFileSync(new URL(event.detailPath, publicRoot), "utf8"));
    const emptySlots = detail.missions.filter((mission) => !mission.id);
    if (event.status === "pending_slots") {
      pendingCount += 1;
      assert.ok(
        emptySlots.length > 0,
        `${event.id} is pending_slots but has no empty mission slot`,
      );
      // 待补齐的槽位必须保留在任务列表里（占一个槽位），
      // 否则序号会整体前移，与标题里自带的序号对不上。
      assert.equal(detail.missions.length, event.missionCount);
      for (const slot of emptySlots) {
        assert.equal(slot.title, null);
        assert.equal(slot.intelUrl, null);
        assert.equal(slot.status, "pending");
      }
    } else if (event.status === "offline") {
      // 「整条不可玩」优先于「待补齐」——见 01-fetch-public.mjs 的判定顺序：
      // 一条都没上线时，offline 比 pending_slots 更该优先告知用户。
      // 广州数据首次出现这种组合（例如 廣州鳥瞰圖 66 槽里 24 条已下线、42 个没补，
      // 0 条可玩），所以 offline 带空槽是合法的；但 offline 这个标签本身仍要有事实支撑：
      // 上线数必须是 0，否则它该是 partially_offline 或 pending_slots。
      assert.equal(
        event.onlineMissionCount,
        0,
        `${event.id} is offline with ${emptySlots.length} empty slot(s) but reports ${event.onlineMissionCount} online mission(s)`,
      );
      assert.equal(
        event.offlineMissionCount,
        event.missionCount,
        `${event.id} is offline but only ${event.offlineMissionCount}/${event.missionCount} mission(s) counted as unplayable`,
      );
    } else {
      assert.equal(
        emptySlots.length,
        0,
        `${event.id} has ${emptySlots.length} empty slot(s) but is ${event.status}`,
      );
    }
  }
  // 完整档案应当确实包含这个状态，否则上面的循环形同空转。
  // 开源仓库只带单城市样本，样本不保证覆盖每一种状态，故仅对完整档案要求总量。
  if (archive.events.length >= 100) {
    assert.ok(pendingCount > 0, "expected at least one pending_slots banner in the archive");
  }
});

test("mission search text is deferred to a complete standalone index", () => {
  assert.deepEqual(Object.keys(searchIndex).sort(), archive.events.map(({ id }) => id).sort());
  for (const event of archive.events) {
    assert.equal("searchText" in event, false);
    assert.equal(typeof searchIndex[event.id], "string");
  }
});

test("event summaries are unique, valid, and do not embed mission details", () => {
  const ids = new Set();
  for (const event of archive.events) {
    assert.ok(event.id);
    assert.equal(ids.has(event.id), false, `duplicate event ${event.id}`);
    ids.add(event.id);
    assert.equal(Array.isArray(event.missions), false);
    assert.match(event.detailPath, /^data\/events\/.+\.json$/);
    assert.ok(Number.isFinite(event.lat) && Math.abs(event.lat) <= 90);
    assert.ok(Number.isFinite(event.lng) && Math.abs(event.lng) <= 180);
  }
});

test("banner objectives are a deduplicated presence set in canonical order", () => {
  // 口径：只记「有没有」，不记次数；且**不含 viewWaypoint**（它的步骤全是 Field Trip
  // 路径点，从不是 portal 操作）。
  const counts = Object.fromEntries(PORTAL_OBJECTIVES.map((key) => [key, 0]));
  let covered = 0;
  for (const event of archive.events) {
    // null = 没抓到该拼图的操作数据，
    // 与「空数组 = 一个操作都没有」语义不同，不能混为一谈。
    if (event.objectives == null) continue;
    covered += 1;
    assert.ok(Array.isArray(event.objectives), `${event.id} objectives 必须是数组或 null`);
    assert.equal(
      new Set(event.objectives).size,
      event.objectives.length,
      `${event.id} objectives 有重复项`,
    );
    for (const key of event.objectives) {
      assert.ok(PORTAL_OBJECTIVES.includes(key), `${event.id} 出现未知操作 ${key}`);
      counts[key] += 1;
    }
    // 数据侧与前端共用同一份顺序定义；顺序错了标签会在行内漂移。
    assert.deepEqual(
      event.objectives,
      PORTAL_OBJECTIVES.filter((key) => event.objectives.includes(key)),
      `${event.id} objectives 顺序与 PORTAL_OBJECTIVES 不一致`,
    );
  }
  // 不是空转：这套数据确实带上了操作类型。
  assert.ok(covered > 0, "expected at least one banner with objective data");
  assert.equal(archive.meta.dataQuality.eventsWithoutObjectives, archive.events.length - covered);
  assert.deepEqual(archive.meta.objectiveCounts, counts);
});

test("compact analytics carries the same objectives as the archive summaries", () => {
  // analytics 是元组数组（列位置解码），加列时最容易只改一边。
  const byId = new Map(archive.events.map((event) => [event.id, event]));
  const analytics = expandAnalytics(analyticsPayload);
  for (const event of analytics.events) {
    assert.deepEqual(event.objectives, byId.get(event.id).objectives, `${event.id} objectives`);
  }
});
