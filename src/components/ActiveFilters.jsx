import { useRef } from "react";
import { X } from "lucide-react";
import { useLanguage } from "../i18n.jsx";
import { objectiveLabel } from "../utils/bannerMeta.js";
import { displayCityName, displayCountryName } from "../utils/locations";
import { activeFilterEntries } from "../utils/filters";

const categoryLabels = {
  player: "categoryPlayer",
  "mission-day": "categoryMissionDay",
};

const orderLabels = {
  sequential: "orderSequential",
  anyOrder: "orderAnyOrder",
};

const sortLabels = {
  completions: "sortCompletions",
  missions: "sortMissions",
  rating: "sortRating",
};

const statusLabels = {
  online: "online",
  offline: "offline",
  partially_offline: "partiallyOffline",
  pending_slots: "pendingSlots",
};

// 每个筛选键的 chip 文案。取不到专用文案时回退到「键名：值」或原值。
const filterLabels = {
  query: (value, { t }) => t("searchFilterLabel", { value }),
  category: (value, { t }) => t(categoryLabels[value] ?? "category"),
  sizeTier: (value, { t }) => t("sizeTierTasks", { tier: value }),
  orderType: (value, { t }) => t(orderLabels[value] ?? "orderType"),
  author: (value, { t }) => `${t("bannerAuthor")}${t("labelSeparator")}${value}`,
  minCompletions: (value, { t, formatNumber }) =>
    t("minCompletionsOption", { count: formatNumber(Number(value)) }),
  region: (value) => value,
  // 多选：把选中的操作名用「/」连起来，chip 一次清空整组（和别的 chip 一样）。
  objectives: (value, { t }) => {
    const keys = Array.isArray(value) ? value : [];
    const names = keys.map((key) => objectiveLabel(key, t) ?? key).join("/");
    return `${t("bannerObjectives")}${t("labelSeparator")}${names}`;
  },
  // filters.city 存的是 cityId，chip 上要显示本地化城市名，故需回查城市清单。
  city: (value, { language, cities }) => {
    const hit = cities.find((entry) => (entry.id ?? entry.city) === value);
    return hit ? displayCityName(hit.countryCode, hit.city, language) : value;
  },
  country: (value, { language }) => displayCountryName(value, undefined, language),
  status: (value, { t }) => t(statusLabels[value] ?? "status"),
  // 方向并进这个 chip：否则「按评分」和「按评分（升序）」看起来会一模一样。
  sort: (value, { t, sortDir }) => {
    const direction = sortDir === "asc" ? `（${t("sortAscending")}）` : "";
    return `${t("sortBy")}${t("labelSeparator")}${t(sortLabels[value] ?? "sortBy")}${direction}`;
  },
};

const labelFor = (key, value, context) =>
  filterLabels[key]?.(value, context) ?? String(value);

export function ActiveFilters({
  filters,
  cities = [],
  resultCount,
  searchState = "ready",
  pending = false,
  onClear,
  onReset,
}) {
  const { formatNumber, language, t } = useLanguage();
  const chipsRef = useRef(null);
  const entries = activeFilterEntries(filters);
  if (!entries.length) return null;
  const context = { t, language, formatNumber, cities, sortDir: filters.sortDir };

  return (
    <section className="active-filters" aria-label={t("activeFilters")}>
      <div className="active-filters__chips" ref={chipsRef}>
        {entries.map(([key, value]) => (
          <button
            className="filter-chip"
            type="button"
            key={key}
            onClick={(event) => {
              const remaining = [...chipsRef.current.querySelectorAll("button")]
                .filter((button) => button !== event.currentTarget);
              remaining[0]?.focus();
              onClear(key);
            }}
            title={labelFor(key, value, context)}
            aria-label={t("clearFilter", { label: labelFor(key, value, context) })}
          >
            <span>{labelFor(key, value, context)}</span>
            <X size={13} aria-hidden="true" />
          </button>
        ))}
      </div>
      <strong role="status" aria-live="polite" aria-atomic="true" aria-busy={pending || searchState === "loading"}>
        {searchState === "ready"
          ? t("filteredResults", { count: formatNumber(resultCount) })
          : t(searchState === "error" ? "searchResultsUnavailable" : "searchResultsPending")}
      </strong>
      <button className="active-filters__reset" type="button" onClick={onReset}>
        {t("clearAllFilters")}
      </button>
    </section>
  );
}
