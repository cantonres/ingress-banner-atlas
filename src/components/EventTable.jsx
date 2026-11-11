import { ChevronDown, MapPin, Star, Users } from "lucide-react";
import { CategoryBadge } from "./CategoryBadge";
import { MissionImage } from "./MissionImage";
import { StatusBadge } from "./StatusBadge";
import { useLanguage } from "../i18n.jsx";
import { displayCityName, displayCountryName } from "../utils/locations";

// 可排序的数值列。主轴是「拼图完成人数 > 任务数 > 评分」，与筛选器里的排序选项同源。
const sortableColumns = [
  { key: "missions", sort: "missions", label: "missionCount", hint: "sortMissions" },
  { key: "completions", sort: "completions", label: "bannerCompletions", hint: "sortCompletions" },
  { key: "rating", sort: "rating", label: "averageRating", hint: "sortRating" },
];

export function EventTable({
  events,
  selectedId,
  onSelect,
  visibleCount,
  onLoadMore,
  onResetFilters,
  sort = "completions",
  sortDir = "desc",
  onSortChange,
}) {
  const { formatNumber, language, t } = useLanguage();
  const visibleEvents = events.slice(0, visibleCount);
  // 点当前排序列 → 切换升降；点别的列 → 先降序（高值在前，通常才是想看的）。
  const toggleSort = (column) => {
    const nextDir = sort === column.sort && sortDir === "desc" ? "asc" : "desc";
    onSortChange?.(column.sort, nextDir);
  };

  if (!events.length) {
    return (
      <div className="empty-state">
        <span className="empty-state__target" />
        <strong>{t("noSignal")}</strong>
        <p>{t("noSignalDescription")}</p>
        {onResetFilters ? (
          <button className="command-button" type="button" onClick={onResetFilters}>
            {t("clearAllFilters")}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="event-table">
      <div className="event-table__header">
        <span>{t("sequenceNumber")}</span>
        <span>{t("image")}</span>
        <span>{t("bannerName")}</span>
        <span>{t("cityCountry")}</span>
        {sortableColumns.map((column) => {
          const active = sort === column.sort;
          const ascending = active && sortDir === "asc";
          return (
            <span key={column.key}>
              <button
                className={`event-table__sort ${active ? "is-active" : ""} ${
                  ascending ? "is-asc" : ""
                }`}
                type="button"
                aria-pressed={active}
                // 非当前列：说明可以排序；当前列：说明再点会变成什么。
                title={
                  active
                    ? t(ascending ? "sortHintAscending" : "sortHintDescending")
                    : t("sortHintInactive")
                }
                onClick={() => toggleSort(column)}
              >
                {t(column.label)}
                <ChevronDown size={12} aria-hidden="true" />
              </button>
            </span>
          );
        })}
        <span>{t("status")}</span>
      </div>

      <div className="event-table__body">
        {visibleEvents.map((event, index) => (
          <button
            type="button"
            className={`event-row ${event.id === selectedId ? "is-selected" : ""}`}
            key={event.id}
            aria-pressed={event.id === selectedId}
            onClick={() => onSelect(event.id)}
          >
            {/* 序号 = 当前结果集里的行位（筛选/排序后、含已加载部分）。
                不可排序：它是行号，不是数据；可排序列见 sortableColumns。 */}
            <span className="event-row__seq">{index + 1}</span>
            <MissionImage event={event} className="event-row__image" eager={index < 8} />
            <span className="event-row__title" title={event.title}>
              {event.title?.trim() || event.id}
            </span>
            <span className="event-row__place">
              <strong title={event.city}>{displayCityName(event.countryCode, event.city, language)}</strong>
              <small>
                {/* 地理信息必须包成一个整体：JSX 的 `{country}{region && …}` 是两个相邻文本节点，
                    直接放进 flex 容器会各自成为匿名 flex item，窄列下会折成三行。 */}
                <span className="event-row__place-geo">
                  <MapPin size={11} aria-hidden="true" />
                  {displayCountryName(event.countryCode, event.country, language)}
                  {event.region ? (
                    <span className="event-row__place-region">{` · ${event.region}`}</span>
                  ) : null}
                </span>
                <CategoryBadge category={event.category} />
              </small>
            </span>
            <span className="event-row__count" data-label={t("missionCount")}>
              {event.missionCount != null ? formatNumber(event.missionCount) : "—"}
            </span>
            <span
              className="event-row__completions"
              data-label={t("bannerCompletions")}
              title={t("completionsHint")}
            >
              <Users size={13} aria-hidden="true" />
              {event.completions != null ? formatNumber(event.completions) : "—"}
            </span>
            <span className="event-row__rating" data-label={t("averageRating")}>
              <Star size={13} fill="currentColor" />
              {typeof event.averageRating === "number"
                ? `${event.averageRating.toFixed(1)}%`
                : t("noRating")}
            </span>
            <StatusBadge status={event.status} />
          </button>
        ))}
      </div>

      {visibleEvents.length < events.length ? (
        <button className="load-more" type="button" onClick={onLoadMore}>
          {t("loadNext")}
          <span>
            {formatNumber(visibleEvents.length)} / {formatNumber(events.length)}
          </span>
        </button>
      ) : null}
    </div>
  );
}
