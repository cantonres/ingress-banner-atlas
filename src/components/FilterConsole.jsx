import { Filter, X } from "lucide-react";
import { useLanguage } from "../i18n.jsx";
import {
  SIZE_TIERS,
  CATEGORIES,
  ORDER_TYPES,
  COMPLETION_THRESHOLDS,
  PORTAL_OBJECTIVES,
  SORT_OPTIONS,
  normalizeFaction,
  objectiveLabel,
} from "../utils/bannerMeta.js";
import { displayCityName, displayCountryName } from "../utils/locations";

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

export function FilterConsole({
  filters,
  sizeTiers = [],
  countries = [],
  cities = [],
  authors = [],
  objectiveCounts = null,
  onFilterChange,
  onReset,
  onClose,
}) {
  const { language, formatNumber, t } = useLanguage();
  // Present countries by their localized display name instead of archive order.
  const sortedCountries = [...countries].sort((a, b) =>
    displayCountryName(a.code, a.country, language)
      .localeCompare(
        displayCountryName(b.code, b.country, language),
        language === "zh" ? "zh-Hans-CN" : language,
      ),
  );
  // 城市按本地化显示名排序（与 country 一致），不按档案顺序。
  const sortedCities = [...cities].sort((a, b) =>
    displayCityName(a.countryCode, a.city, language)
      .localeCompare(
        displayCityName(b.countryCode, b.city, language),
        language === "zh" ? "zh-Hans-CN" : language,
      ),
  );
  // meta.sizeTiers 来自数据管道，带每档拼图数；缺失时退回前端档位定义。
  const tiers = sizeTiers?.length
    ? sizeTiers
    : SIZE_TIERS.map((tier) => ({ tier, count: null }));
  // 作者按阵营上色（抵抗军=蓝、启蒙军=绿）。数据侧写的是 ENLIGHTENED / RESISTANCE，
  // 归一化成小写键后才能直接当 CSS 类后缀用。
  const factionByName = new Map(
    authors.map((author) => [author.name, normalizeFaction(author.faction)]),
  );
  const selectedFaction = filters.author === "all" ? null : factionByName.get(filters.author);
  // portal 操作类型是多选：点一下切换该项。数组交给 onFilterChange 整体替换，
  // 所以这里不原地改 filters.objectives。
  const selectedObjectives = Array.isArray(filters.objectives) ? filters.objectives : [];
  // 用**函数式**更新而不是在闭包里读 filters.objectives：同一帧内连点两个徽章时
  // React 会把两次 setState 批到一起，闭包里的旧值会让后一次点击覆盖掉前一次（少选一个）。
  const toggleObjective = (objective) => {
    onFilterChange("objectives", (current) => {
      const selected = Array.isArray(current) ? current : [];
      return selected.includes(objective)
        ? selected.filter((key) => key !== objective)
        : [...selected, objective];
    });
  };

  return (
    <section className="filter-console" id="filter-console" aria-label={t("filters")}>
      <header>
        <span>
          <Filter size={14} />
          {t("filterConsole")}
        </span>
        <div>
          <button type="button" onClick={onReset}>
            {t("resetAll")}
          </button>
          <button type="button" aria-label={t("closeFilters")} onClick={onClose}>
            <X size={15} />
          </button>
        </div>
      </header>
      <label>
        {t("category")}
        <select
          value={filters.category}
          onChange={(event) => onFilterChange("category", event.target.value)}
        >
          <option value="all">{t("allCategories")}</option>
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {t(categoryLabels[category])}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("sizeTier")}
        <select
          value={filters.sizeTier}
          onChange={(event) => onFilterChange("sizeTier", event.target.value)}
        >
          <option value="all">{t("allSizeTiers")}</option>
          {tiers.map(({ tier, count }) => (
            <option key={tier} value={tier}>
              {t("sizeTierTasks", { tier })}
              {count == null ? "" : ` (${formatNumber(count)})`}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("orderType")}
        <select
          value={filters.orderType}
          onChange={(event) => onFilterChange("orderType", event.target.value)}
        >
          <option value="all">{t("allOrderTypes")}</option>
          {ORDER_TYPES.map((orderType) => (
            <option key={orderType} value={orderType}>
              {t(orderLabels[orderType])}
            </option>
          ))}
        </select>
      </label>
      {/* portal 操作类型：多选。用一组可切换的徽章而不是 <select multiple> ——
          多选下拉在触屏上几乎没法用，而且徽章能直接沿用数据页柱状图的配色，
          一眼就能对上「哪个颜色是哪个操作」。 */}
      <fieldset className="filter-objectives">
        <legend>
          {t("bannerObjectives")}
          <span className="filter-objectives__hint">{t("objectiveFilterHint")}</span>
        </legend>
        <div className="filter-objectives__options">
          {PORTAL_OBJECTIVES.map((objective) => {
            const active = selectedObjectives.includes(objective);
            const count = objectiveCounts?.[objective];
            return (
              <button
                key={objective}
                type="button"
                className={`objective-toggle objective-toggle--${objective} ${active ? "is-active" : ""}`.trim()}
                aria-pressed={active}
                onClick={() => toggleObjective(objective)}
              >
                {objectiveLabel(objective, t)}
                {count == null ? null : (
                  <span className="objective-toggle__count">{formatNumber(count)}</span>
                )}
              </button>
            );
          })}
        </div>
      </fieldset>
      <label title={t("completionsHint")}>
        {t("minCompletions")}
        <select
          value={filters.minCompletions}
          onChange={(event) => onFilterChange("minCompletions", event.target.value)}
        >
          <option value="all">{t("allCompletions")}</option>
          {COMPLETION_THRESHOLDS.map((threshold) => (
            <option key={threshold} value={String(threshold)}>
              {t("minCompletionsOption", { count: formatNumber(threshold) })}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("bannerAuthor")}
        <select
          // 闭合态的着色只能靠 select 自己带类名：<option> 的颜色在部分浏览器里不生效。
          className={selectedFaction ? `faction-text--${selectedFaction}` : undefined}
          title={selectedFaction ? t(selectedFaction) : undefined}
          value={filters.author}
          onChange={(event) => onFilterChange("author", event.target.value)}
        >
          <option value="all">{t("allAuthors")}</option>
          {authors.map(({ name, count }) => {
            const faction = factionByName.get(name);
            return (
              <option
                key={name}
                value={name}
                className={faction ? `faction-text--${faction}` : undefined}
              >
                {name} ({formatNumber(count)})
              </option>
            );
          })}
        </select>
      </label>
      <label>
        {t("region")}
        <select
          value={filters.region}
          onChange={(event) => onFilterChange("region", event.target.value)}
        >
          <option value="all">{t("allRegions")}</option>
          <option value="APAC">APAC</option>
          <option value="EMEA">EMEA</option>
          <option value="AMER">AMER</option>
        </select>
      </label>
      <label>
        {t("country")}
        <select
          value={filters.country}
          onChange={(event) => onFilterChange("country", event.target.value)}
        >
          <option value="all">{t("allCountries")}</option>
          {sortedCountries.map(({ code, country, count }) => (
            <option key={code} value={code}>
              {displayCountryName(code, country, language)} ({formatNumber(count)})
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("city")}
        <select
          value={filters.city}
          onChange={(event) => onFilterChange("city", event.target.value)}
        >
          <option value="all">{t("allCities")}</option>
          {sortedCities.map(({ id, city, countryCode, count }) => (
            <option key={id ?? city} value={id ?? city}>
              {displayCityName(countryCode, city, language)} ({formatNumber(count)})
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("status")}
        <select
          value={filters.status}
          onChange={(event) => onFilterChange("status", event.target.value)}
        >
          <option value="all">{t("allStatus")}</option>
          <option value="online">{t("online")}</option>
          <option value="pending_slots">{t("pendingSlots")}</option>
          <option value="partially_offline">{t("partiallyOffline")}</option>
          <option value="offline">{t("offline")}</option>
        </select>
      </label>
      <label>
        {t("sortBy")}
        <select
          value={filters.sort}
          onChange={(event) => onFilterChange("sort", event.target.value)}
        >
          {SORT_OPTIONS.map((sort) => (
            <option key={sort} value={sort}>
              {t(sortLabels[sort])}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
