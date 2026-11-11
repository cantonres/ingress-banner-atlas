import {
  formatLocalizedNumber,
  formatLocalizedUnit,
  localeForLanguage,
} from "../../i18n/formatters.js";
import {
  CATEGORIES,
  normalizeFaction,
  ORDER_TYPES,
  PORTAL_OBJECTIVES,
  SIZE_TIERS,
  sizeTierOf,
} from "../../utils/bannerMeta.js";

const REGIONS = ["APAC", "EMEA", "AMER"];

export const BREAKDOWN_COLORS = [
  "#42d6df",
  "#72a9df",
  "#f2c14e",
  "#63d98b",
  "#a78bfa",
  "#e8896f",
  "#5cc8a1",
  "#c08adf",
  "#d7a84b",
  "#4fa0b5",
  "#88b06a",
  "#cf7f9d",
  "#687a83",
];

export function compactNumber(value, language) {
  return new Intl.NumberFormat(localeForLanguage(language), {
    notation: value >= 10000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatDistance(meters, language) {
  return formatLocalizedUnit(Math.round((meters ?? 0) / 1000), language, "kilometer");
}

export function formatPublisherShare(value) {
  if (value > 0 && value < 0.1) return `${value.toFixed(2)}%`;
  return `${value.toFixed(1)}%`;
}

export function formatDuration(milliseconds, language) {
  const hours = Math.round((milliseconds ?? 0) / 3_600_000);
  if (hours < 1000) return formatLocalizedUnit(hours, language, "hour");
  return formatLocalizedUnit(hours / 24, language, "day", {
    maximumFractionDigits: 0,
  });
}

export function buildStatistics(events) {
  const sizeTiers = new Map(
    SIZE_TIERS.map((tier) => [
      tier,
      { tier, events: 0, missions: 0, completions: 0 },
    ]),
  );
  const categories = new Map(
    CATEGORIES.map((category) => [
      category,
      { category, events: 0, missions: 0, completions: 0 },
    ]),
  );
  const orderTypes = new Map(
    ORDER_TYPES.map((orderType) => [
      orderType,
      { orderType, events: 0, missions: 0 },
    ]),
  );
  // portal 操作类型：**拼图级**口径 —— 一个拼图里出现过该操作就记一次，
  // 与出现次数无关（用户口径），也与「多少个任务含该操作」无关。
  const objectives = new Map(
    PORTAL_OBJECTIVES.map((objective) => [objective, { objective, events: 0 }]),
  );
  const countries = new Map();
  const regions = new Map(
    REGIONS.map((region) => [
      region,
      {
        region,
        events: 0,
        missions: 0,
        ratings: 0,
        rated: 0,
        completions: 0,
      },
    ]),
  );
  const publishers = new Map();
  const missions = [];
  const ratingEvents = [];
  const bannerRows = [];
  let missionCount = 0;
  let activeMissions = 0;
  let ratingTotal = 0;
  let ratedMissions = 0;
  let totalCompletions = 0;
  let totalDistance = 0;
  let totalTime = 0;
  let unknownOrderEvents = 0;
  let unknownOrderMissions = 0;
  let objectiveMissing = 0;

  for (const event of events) {
    const tierKey = event.sizeTier ?? sizeTierOf(event.missionCount);
    const tier = sizeTiers.get(tierKey);
    if (tier) {
      tier.events += 1;
      tier.missions += event.missionCount ?? 0;
    }

    const category = categories.get(event.category);
    if (category) {
      category.events += 1;
      category.missions += event.missionCount ?? 0;
    }

    // 任务顺序约束（sequential / anyOrder）独立于「拼图类型」。
    // 两个档位即使为 0 也要出现在结果里，这样界面上能直接读出「18 顺序 / 0 任意顺序」。
    // 源站缺该字段的拼图单列一个「未知」桶，且不凭空推断。
    const order = orderTypes.get(event.orderType);
    if (order) {
      order.events += 1;
      order.missions += event.missionCount ?? 0;
    } else {
      unknownOrderEvents += 1;
      unknownOrderMissions += event.missionCount ?? 0;
    }

    // portal 操作：数据侧给的是 presence 数组（可能为 null = 没抓到）。
    // null 与「空数组」必须分开统计，否则「没抓到」会被当成「一个操作都没有」。
    if (event.objectives == null) objectiveMissing += 1;
    for (const key of event.objectives ?? []) {
      const row = objectives.get(key);
      if (row) row.events += 1;
    }

    const country = countries.get(event.country) ?? {
      country: event.country,
      code: event.countryCode,
      events: 0,
      missions: 0,
      completions: 0,
    };
    country.events += 1;
    country.missions += event.missionCount;
    countries.set(event.country, country);

    const region = regions.get(event.region);
    if (region) {
      region.events += 1;
      region.missions += event.missionCount;
    }

    let eventRatingTotal = 0;
    let eventRatedMissions = 0;
    let eventCompletions = 0;

    for (const mission of event.missions) {
      missionCount += 1;
      if (!mission.offline) activeMissions += 1;
      if (mission.author) {
        const publisher = publishers.get(mission.author) ?? {
          author: mission.author,
          missions: 0,
          eventIds: new Set(),
          factions: new Map(),
        };
        const faction = normalizeFaction(mission.authorFaction);
        publisher.missions += 1;
        publisher.eventIds.add(event.id);
        if (faction !== "unknown") {
          publisher.factions.set(faction, (publisher.factions.get(faction) ?? 0) + 1);
        }
        publishers.set(mission.author, publisher);
      }

      if (typeof mission.rating === "number" && mission.rating > 0) {
        ratingTotal += mission.rating;
        ratedMissions += 1;
        eventRatingTotal += mission.rating;
        eventRatedMissions += 1;
        if (region) {
          region.ratings += mission.rating;
          region.rated += 1;
        }
      }

      const completions = mission.completions ?? 0;
      totalCompletions += completions;
      eventCompletions += completions;
      totalDistance += mission.distanceMeters ?? 0;
      totalTime += mission.timeMilliseconds ?? 0;
      if (tier) tier.completions += completions;
      if (category) category.completions += completions;
      country.completions += completions;
      if (region) region.completions += completions;

      missions.push({
        ...mission,
        eventId: event.id,
        city: event.city,
        country: event.country,
        countryCode: event.countryCode,
      });
    }

    // 拼图完成人数与任务完成人数是两个不同的量：
    // event.completions 是「完整走完整个拼图」的人数（管道按下属任务完成人数取最小值估算），
    // eventCompletions 是本拼图所有任务完成人数之和（人次）。排名与展示必须区分，否则
    // 「拼图排名」会退化成「任务完成人次最多的拼图」。
    // picture 是给排名表的封面缩略图用的。这里必须显式带上：bannerRows / ratingEvents
    // 都是手挑字段的白名单，不像下面的 missions 那样整体展开，漏了就渲染不出图。
    bannerRows.push({
      id: event.id,
      title: event.title,
      picture: event.picture,
      city: event.city,
      country: event.country,
      countryCode: event.countryCode,
      missionCount: event.missionCount ?? event.missions.length,
      completions: typeof event.completions === "number" ? event.completions : null,
    });

    if (eventRatedMissions > 0) {
      ratingEvents.push({
        id: event.id,
        title: event.title,
        picture: event.picture,
        city: event.city,
        country: event.country,
        countryCode: event.countryCode,
        missionCount: event.missionCount,
        ratedMissions: eventRatedMissions,
        rating: eventRatingTotal / eventRatedMissions,
        bannerCompletions: typeof event.completions === "number" ? event.completions : null,
        completions: eventCompletions,
      });
    }
  }

  const publisherRows = [...publishers.values()]
    .map((publisher) => ({
      author: publisher.author,
      missions: publisher.missions,
      events: publisher.eventIds.size,
      faction:
        [...publisher.factions.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
        "unknown",
    }))
    .sort((a, b) => b.missions - a.missions || a.author.localeCompare(b.author));
  const factionMissions = publisherRows.reduce(
    (counts, publisher) => ({
      ...counts,
      [publisher.faction]: (counts[publisher.faction] ?? 0) + publisher.missions,
    }),
    { resistance: 0, enlightened: 0 },
  );
  const countryRows = [...countries.values()].sort(
    (a, b) => b.missions - a.missions || b.events - a.events,
  );
  const ratedMissionsList = missions.filter(
    (mission) => typeof mission.rating === "number" && mission.rating > 0,
  );
  // 评分并列时按「拼图完成人数」决胜 —— 即拼图排名表实际展示的那一列
  // （bannerCompletions = 完整走完该拼图的人数）。不能用任务完成人次之和 completions：
  // 那是各任务人次的加总，实测会把「走完拼图只有 10 人、人次和 481」的拼图排到
  // 「走完拼图 44 人、人次和 264」的拼图前面，排名与展示列自相矛盾。
  // topBanners 早已按同一原则修正（见 statistics.test.js 的
  // "banner ranking is ordered by banner completions…"），这里对齐。
  // 任务行没有 bannerCompletions 字段，?? 链自动回落到单任务完成人数。
  const ratingHigh = (a, b) =>
    b.rating - a.rating ||
    (b.bannerCompletions ?? b.completions ?? 0) - (a.bannerCompletions ?? a.completions ?? 0) ||
    String(a.title ?? a.city).localeCompare(String(b.title ?? b.city));
  const ratingLow = (a, b) =>
    a.rating - b.rating || (b.completions ?? 0) - (a.completions ?? 0) ||
    String(a.title ?? a.city).localeCompare(String(b.title ?? b.city));

  return {
    eventCount: events.length,
    missionCount,
    activeMissions,
    averageRating: ratedMissions ? ratingTotal / ratedMissions : 0,
    totalCompletions,
    totalDistance,
    totalTime,
    authorCount: publishers.size,
    publishers: publisherRows,
    factionMissions,
    publishedMissionCount: publisherRows.reduce(
      (total, publisher) => total + publisher.missions,
      0,
    ),
    // 规模档位按 SIZE_TIERS 的定义顺序返回，零档不显示（22 档里通常只有少数非零）。
    sizeTiers: [...sizeTiers.values()].filter((tier) => tier.events > 0),
    categories: [...categories.values()],
    orderTypes: [
      ...orderTypes.values(),
      ...(unknownOrderEvents
        ? [
            {
              orderType: null,
              events: unknownOrderEvents,
              missions: unknownOrderMissions,
            },
          ]
        : []),
    ],
    regions: [...regions.values()],
    // portal 操作类型分布：按命中拼图数降序（柱状图按量排序比按枚举顺序好读），
    // 并列时退回 PORTAL_OBJECTIVES 的定义顺序，保证结果稳定。
    // 0 命中的操作不显示。
    objectives: [...objectives.values()]
      .filter((row) => row.events > 0)
      .sort(
        (a, b) =>
          b.events - a.events ||
          PORTAL_OBJECTIVES.indexOf(a.objective) - PORTAL_OBJECTIVES.indexOf(b.objective),
      ),
    objectiveMissing,
    countries: countryRows.slice(0, 10),
    allCountries: countryRows,
    // 拼图排名：按「拼图完成人数」（完整走完该拼图的人数）排序，与下面的
    // topMissions（按单任务完成人数）刻意分开——两者语义不同，混在一起排会
    // 变成「任务完成人次最多的拼图」，这正是要避免的。
    topBanners: [...bannerRows]
      .sort(
        (a, b) =>
          (b.completions ?? -1) - (a.completions ?? -1) ||
          b.missionCount - a.missionCount,
      )
      .slice(0, 10),
    topMissions: missions
      .filter((mission) => mission.completions > 0)
      .sort(
        (a, b) =>
          b.completions - a.completions || (b.rating ?? 0) - (a.rating ?? 0),
      )
      .slice(0, 10),
    topRatedEvents: [...ratingEvents].sort(ratingHigh).slice(0, 10),
    lowestRatedEvents: [...ratingEvents].sort(ratingLow).slice(0, 10),
    topRatedMissions: [...ratedMissionsList].sort(ratingHigh).slice(0, 10),
    lowestRatedMissions: [...ratedMissionsList].sort(ratingLow).slice(0, 10),
  };
}
