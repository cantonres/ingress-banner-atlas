import { citySearchAliases, countrySearchAliases, normalizeCountryCode } from "./locations.js";
import { COMPLETION_THRESHOLDS, SIZE_TIERS } from "./bannerMeta.js";

// 主轴：完成人次（min 定义）> 任务数 > 评分。
// sort 也放在 filters 里，这样排序状态自动进 URL、可分享。
export const INITIAL_FILTERS = {
  query: "",
  category: "all",
  sizeTier: "all",
  orderType: "all",
  author: "all",
  region: "all",
  // 值是 cityId（Bannergress 的 placeId，如 "taiyuan-5105"），不是城市显示名：
  // 城市名可能重名，且会随语言变化；cityId 唯一且稳定。
  city: "all",
  country: "all",
  status: "all",
  minCompletions: "all",
  // portal 操作类型：**多选**，值是 PORTAL_OBJECTIVES 的子集（空数组 = 不筛）。
  // 语义是 **AND**（「同时含全部选中操作」），不是 OR —— 多选在这里是**收窄**条件，
  // 和「含任一」的直觉相反，所以按钮上必须写明「同时含全部选中」。
  // 叠加的操作越多，结果收窄得越快。这是设计选择而非缺陷：
  // 只有 AND 才答得了「既解谜又占塔的有哪些」。
  objectives: [],
  sort: "completions",
  // 排序方向。默认降序（高值在前），点表头可切换。
  sortDir: "desc",
};

export function matchesQuery(event, query, indexedText = event.searchText) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return true;
  return [
    ...citySearchAliases(event.countryCode, event.city),
    ...countrySearchAliases(event.countryCode, event.country),
    event.title,
    indexedText,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase()
    .includes(normalized);
}

/** 归一化的国家码是筛选键；城市键优先用 cityId，缺失时才退回城市名。 */
// 筛选用的规范化键。导出给「面板里点击要素就地筛选」用：值必须和 filterEvents 的
// 比较口径完全一致，否则点了之后筛不出任何结果。
export const countryCodeOf = (event) => normalizeCountryCode(event.countryCode, event.country);
export const cityKeyOf = (event) => event.cityId ?? event.city;

export function filterEvents(
  events,
  filters,
  deferredQuery = filters.query,
  searchIndex = null,
) {
  const minCompletions =
    filters.minCompletions === "all" ? null : Number(filters.minCompletions);
  // 多选的操作类型：空数组 = 不筛。语义是 AND（选中的**全部**都要有）。
  // objectives 为 null（没抓到）或 []（抓到了但确实一个操作都没有）的拼图**不算命中** ——
  // 不知道就不该说它匹配；空数组则天然不可能包含任何选中项。
  const objectives = Array.isArray(filters.objectives) ? filters.objectives : [];
  return events.filter((event) => {
    if (filters.category !== "all" && event.category !== filters.category) return false;
    if (filters.sizeTier !== "all" && event.sizeTier !== filters.sizeTier) return false;
    if (filters.orderType !== "all" && event.orderType !== filters.orderType) return false;
    if (
      objectives.length &&
      !objectives.every((objective) => (event.objectives ?? []).includes(objective))
    ) {
      return false;
    }
    if (
      filters.author !== "all" &&
      !(event.authors ?? []).some((author) => author.name === filters.author)
    ) {
      return false;
    }
    if (filters.region !== "all" && event.region !== filters.region) return false;
    if (filters.city !== "all" && cityKeyOf(event) !== filters.city) return false;
    if (filters.country !== "all" && countryCodeOf(event) !== filters.country) return false;
    if (filters.status !== "all" && event.status !== filters.status) return false;
    if (Number.isFinite(minCompletions) && (event.completions ?? -1) < minCompletions) {
      return false;
    }
    return matchesQuery(event, deferredQuery, searchIndex?.[event.id] ?? event.searchText);
  });
}

// 当前排序主轴上的取值；取不到就是「未知」，恒排在最后（见 sortEvents 说明）。
const axisValue = (event, sort) =>
  sort === "missions"
    ? event.missionCount
    : sort === "rating"
      ? event.averageRating
      : event.completions;

/**
 * 按主轴排序，dir="asc" 时反转。
 *
 * 两个不变式：
 * 1. **未知值恒在最后**，与方向无关。升序时如果单纯 reverse，没有评分 / 没有完成人数
 *    的拼图会顶到最前面，那不是用户想看的（他们想看「最低的」而不是「没数据的」）。
 * 2. 完成人次是 min 定义，0 是有效值，排在正数之后、未知值之前。
 */
export function sortEvents(events, sort, dir = "desc") {
  const byCompletions = (a, b) =>
    (b.completions ?? -1) - (a.completions ?? -1) || (b.missionCount ?? -1) - (a.missionCount ?? -1);
  const compare =
    sort === "missions"
      ? (a, b) => (b.missionCount ?? -1) - (a.missionCount ?? -1) || byCompletions(a, b)
      : sort === "rating"
        ? (a, b) => (b.averageRating ?? -1) - (a.averageRating ?? -1) || byCompletions(a, b)
        : byCompletions;
  const known = [];
  const unknown = [];
  for (const event of events) {
    (typeof axisValue(event, sort) === "number" ? known : unknown).push(event);
  }
  known.sort(compare);
  if (dir === "asc") known.reverse();
  return [...known, ...unknown];
}

// 大区 → 国家 → 城市是三级从属关系。选定上级后，下级的候选列表只保留该上级下
// 辖的条目，否则列表里会混进「选了也筛不出结果」的选项。候选来源仍是整个档案，
// 只是被上级收窄，所以随时可以改回「全部」再换另一个上级。
export function scopeEventsByRegion(events, region) {
  if (!region || region === "all") return events;
  return events.filter((event) => event.region === region);
}

export function scopeEventsByCountry(events, country) {
  if (!country || country === "all") return events;
  return events.filter((event) => countryCodeOf(event) === country);
}

/**
 * 候选列表收窄后，已有的下级选择可能不再成立（例如大区从「全部」改成 APAC，而
 * 国家还停在 GB）。这种组合恒为空结果，所以在筛选变更时把失效的下级退回「全部」：
 * 国家失效则城市一并退回；国家仍成立、只是城市不属于该国时，只退回城市。
 * 无变化时原样返回，避免触发多余的重渲染。
 */
export function sanitizeLocationFilters(events, filters) {
  const country = filters.country ?? "all";
  const city = filters.city ?? "all";
  const regionScoped = scopeEventsByRegion(events, filters.region);
  let nextCountry = country;
  let nextCity = city;
  if (
    nextCountry !== "all" &&
    !regionScoped.some((event) => countryCodeOf(event) === nextCountry)
  ) {
    nextCountry = INITIAL_FILTERS.country;
    nextCity = INITIAL_FILTERS.city;
  }
  if (
    nextCity !== "all" &&
    !scopeEventsByCountry(regionScoped, nextCountry).some((event) => cityKeyOf(event) === nextCity)
  ) {
    nextCity = INITIAL_FILTERS.city;
  }
  if (nextCountry === country && nextCity === city) return filters;
  return { ...filters, country: nextCountry, city: nextCity };
}

/**
 * 面板钻取用的计数：key → 该取值在整个档案里的拼图数。
 *
 * 一律取整个档案，而不是「叠加当前筛选后的结果数」——理由和作者下拉一样：
 * 计数要稳定，不能随着用户在旁边调别的筛选器而跳变。代价是当前有其它筛选时，
 * 点击后的实际结果会少于显示值（与筛选控制台下拉的行为一致）。
 */
export function buildDrilldownFacets(events) {
  const categories = countEventsByCategory(events);
  return {
    city: new Map(countEventsByCity(events).map((item) => [item.id ?? item.city, item.count])),
    country: new Map(countEventsByCountry(events).map((item) => [item.code, item.count])),
    category: new Map([
      ["player", categories.player],
      ["mission-day", categories.missionDay],
    ]),
    author: new Map(countEventsByAuthor(events).map((item) => [item.name, item.count])),
  };
}

/** 拼图作者选项（含每人的拼图数），按拼图数降序。 */
export function countEventsByAuthor(events) {
  const counts = new Map();
  for (const event of events) {
    for (const author of event.authors ?? []) {
      if (!author?.name) continue;
      const entry = counts.get(author.name) ?? {
        name: author.name,
        faction: author.faction ?? null,
        count: 0,
      };
      entry.count += 1;
      counts.set(author.name, entry);
    }
  }
  return [...counts.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  );
}

/** 拼图规模档位选项（含每档的拼图数），保持档位定义顺序。 */
export function countEventsBySizeTier(events) {
  const counts = new Map(SIZE_TIERS.map((tier) => [tier, 0]));
  for (const event of events) {
    if (event.sizeTier && counts.has(event.sizeTier)) {
      counts.set(event.sizeTier, counts.get(event.sizeTier) + 1);
    }
  }
  return SIZE_TIERS.map((tier) => ({ tier, count: counts.get(tier) }));
}

export function countEventsByCategory(events) {
  return events.reduce(
    (counts, event) => {
      if (event.category === "mission-day") counts.missionDay += 1;
      else if (event.category === "player") counts.player += 1;
      return counts;
    },
    { player: 0, missionDay: 0 },
  );
}

/** Unique country filter options with event counts, most active first. */
export function countEventsByCountry(events) {
  const counts = new Map();
  for (const event of events) {
    const code = countryCodeOf(event);
    if (!code) continue;
    const entry = counts.get(code) ?? { code, country: event.country, count: 0 };
    entry.count += 1;
    counts.set(code, entry);
  }
  return [...counts.values()].sort(
    (a, b) => b.count - a.count || a.code.localeCompare(b.code),
  );
}

/** Unique city filter options with event counts, most active first. */
export function countEventsByCity(events) {
  const counts = new Map();
  for (const event of events) {
    const key = cityKeyOf(event);
    if (!key) continue;
    const entry = counts.get(key) ?? {
      id: event.cityId ?? null,
      city: event.city,
      countryCode: event.countryCode,
      country: event.country,
      count: 0,
    };
    entry.count += 1;
    counts.set(key, entry);
  }
  return [...counts.values()].sort(
    (a, b) => b.count - a.count || String(a.city).localeCompare(String(b.city)),
  );
}

export function expandAnalytics(data) {
  if (!Array.isArray(data?.events)) throw new TypeError("Invalid analytics payload");
  return {
    events: data.events.map(
      ([
        id,
        sizeTier,
        city,
        country,
        countryCode,
        region,
        category,
        missionCount,
        missions,
        objectives,
      ]) => ({
        id,
        sizeTier,
        city,
        country,
        countryCode,
        region,
        category,
        missionCount,
        // null = 没抓到该拼图的操作数据，与「空数组（一个操作都没有）」语义不同。
        objectives: objectives ?? null,
        missions: (missions ?? []).map(
          ([
            missionId,
            title,
            author,
            authorFaction,
            rating,
            completions,
            distanceMeters,
            timeMilliseconds,
            offline,
          ]) => ({
            id: missionId,
            title,
            author,
            authorFaction,
            rating,
            completions,
            distanceMeters,
            timeMilliseconds,
            offline,
          }),
        ),
      }),
    ),
  };
}

export function isFiniteCoordinate(value, limit) {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= limit;
}

export { COMPLETION_THRESHOLDS, SIZE_TIERS };
