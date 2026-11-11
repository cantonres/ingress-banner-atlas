import { INITIAL_FILTERS } from "./archive.js";
import {
  CATEGORIES,
  ORDER_TYPES,
  PORTAL_OBJECTIVES,
  SIZE_TIERS,
  SORT_OPTIONS,
  SORT_DIRECTIONS,
} from "./bannerMeta.js";
import { COMPLETION_THRESHOLDS } from "./bannerMeta.js";

/** Views and filter enums mirrored from the UI so links can be validated lazily. */
export const URL_VIEWS = ["map", "archive", "data"];
export const URL_REGIONS = ["APAC", "EMEA", "AMER"];
// 原仓库的 "scheduled"（公开预定）是给 Mission Day 活动用的：Banner Atlas 只收已发布的
// 拼图，不展示未来活动，且该值从未被任何数据产出过（原仓库 778 条数据里 0 条），已移除。
export const URL_STATUSES = ["online", "pending_slots", "partially_offline", "offline"];
export const URL_CATEGORIES = CATEGORIES;
export const URL_ORDER_TYPES = ORDER_TYPES;
export const URL_SIZE_TIERS = SIZE_TIERS;
export const URL_SORTS = SORT_OPTIONS;
export const URL_SORT_DIRECTIONS = SORT_DIRECTIONS;
export const URL_MIN_COMPLETIONS = COMPLETION_THRESHOLDS.map(String);
export const URL_OBJECTIVES = PORTAL_OBJECTIVES;

/**
 * `obj=hack,enterPassphrase` → ["hack","enterPassphrase"]。
 * 未知值直接丢弃，并按 PORTAL_OBJECTIVES 的固定顺序输出 ——
 * 同一组选择只有一种写法，分享链接才能稳定 round-trip。
 */
function parseObjectives(raw) {
  if (!raw) return [];
  const wanted = new Set(
    raw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  return URL_OBJECTIVES.filter((objective) => wanted.has(objective));
}

const COUNTRY_PATTERN = /^[A-Za-z]{2}$/;
// 作者名与 cityId 都是自由文本，只做长度约束：
// 匹配不到任何拼图只是空结果，仍可通过筛选 UI 正常清除。
const MAX_AUTHOR_LENGTH = 64;
const MAX_CITY_LENGTH = 64;

/**
 * Decode shareable query state. Invalid or unknown values fall back to their
 * defaults instead of breaking first paint; defaults are never emitted by
 * serializeUrlState, so decoded state round-trips to the same query string.
 */
export function parseUrlState(search = window.location.search) {
  const params = new URLSearchParams(search);
  const viewParam = params.get("view");
  const categoryParam = params.get("category");
  const sizeParam = params.get("size");
  const orderParam = params.get("order");
  const authorParam = params.get("author");
  const regionParam = params.get("region");
  const cityParam = params.get("city");
  const countryParam = params.get("country");
  const statusParam = params.get("status");
  const minCompletionsParam = params.get("minc");
  const sortParam = params.get("sort");
  const dirParam = params.get("dir");
  return {
    view: URL_VIEWS.includes(viewParam) ? viewParam : "map",
    filters: {
      query: params.get("q") ?? "",
      category: URL_CATEGORIES.includes(categoryParam) ? categoryParam : "all",
      // 档位标签本身是合法值（"≤6" / "7-12" / … / ">128"），非法值回落默认。
      sizeTier: URL_SIZE_TIERS.includes(sizeParam) ? sizeParam : "all",
      orderType: URL_ORDER_TYPES.includes(orderParam) ? orderParam : "all",
      // 作者名是自由文本（Bannergress / Intel 昵称），只做长度约束；
      // 不存在的作者只是匹配不到任何拼图，可通过正常筛选 UI 清除。
      author:
        authorParam && authorParam.length <= MAX_AUTHOR_LENGTH ? authorParam : "all",
      region: URL_REGIONS.includes(regionParam) ? regionParam : "all",
      city: cityParam && cityParam.length <= MAX_CITY_LENGTH ? cityParam : "all",
      // ISO alpha-2 codes are validated by shape; unknown codes merely match
      // no events and stay clearable.
      country:
        countryParam && COUNTRY_PATTERN.test(countryParam)
          ? countryParam.toUpperCase()
          : "all",
      status: URL_STATUSES.includes(statusParam) ? statusParam : "all",
      minCompletions: URL_MIN_COMPLETIONS.includes(minCompletionsParam)
        ? minCompletionsParam
        : "all",
      objectives: parseObjectives(params.get("obj")),
      sort: URL_SORTS.includes(sortParam) ? sortParam : INITIAL_FILTERS.sort,
      sortDir: URL_SORT_DIRECTIONS.includes(dirParam)
        ? dirParam
        : INITIAL_FILTERS.sortDir,
    },
    event: params.get("event") || null,
  };
}

/**
 * Encode app state into a query string, omitting defaults so everyday browsing
 * keeps short URLs. Returns "" (not "?") when nothing differs from the default.
 */
export function serializeUrlState({ view = "map", filters = INITIAL_FILTERS, event = null } = {}) {
  const params = new URLSearchParams();
  if (URL_VIEWS.includes(view) && view !== "map") params.set("view", view);
  const {
    query,
    category,
    sizeTier,
    orderType,
    author,
    region,
    city,
    country,
    status,
    minCompletions,
    objectives,
    sort,
    sortDir,
  } = filters;
  if (query && query.trim()) params.set("q", query);
  if (category && category !== "all" && URL_CATEGORIES.includes(category)) {
    params.set("category", category);
  }
  if (sizeTier && sizeTier !== "all" && URL_SIZE_TIERS.includes(sizeTier)) {
    params.set("size", sizeTier);
  }
  if (orderType && orderType !== "all" && URL_ORDER_TYPES.includes(orderType)) {
    params.set("order", orderType);
  }
  if (author && author !== "all" && author.length <= MAX_AUTHOR_LENGTH) {
    params.set("author", author);
  }
  if (region && region !== "all" && URL_REGIONS.includes(region)) params.set("region", region);
  if (city && city !== "all" && city.length <= MAX_CITY_LENGTH) params.set("city", city);
  if (country && country !== "all" && /^[A-Z]{2}$/.test(country)) params.set("country", country);
  if (status && status !== "all" && URL_STATUSES.includes(status)) params.set("status", status);
  if (
    minCompletions &&
    minCompletions !== "all" &&
    URL_MIN_COMPLETIONS.includes(String(minCompletions))
  ) {
    params.set("minc", String(minCompletions));
  }
  if (Array.isArray(objectives) && objectives.length) {
    const known = URL_OBJECTIVES.filter((objective) => objectives.includes(objective));
    if (known.length) params.set("obj", known.join(","));
  }
  if (sort && sort !== INITIAL_FILTERS.sort && URL_SORTS.includes(sort)) {
    params.set("sort", sort);
  }
  if (
    sortDir &&
    sortDir !== INITIAL_FILTERS.sortDir &&
    URL_SORT_DIRECTIONS.includes(sortDir)
  ) {
    params.set("dir", sortDir);
  }
  if (event) params.set("event", event);
  const querystring = params.toString();
  return querystring ? `?${querystring}` : "";
}
