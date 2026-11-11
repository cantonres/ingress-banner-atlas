import { Fragment, useEffect, useRef } from "react";
import {
  Clock3,
  LoaderCircle,
  MapPin,
  Route,
  Star,
  Users,
  X,
} from "lucide-react";
import { CategoryBadge } from "./CategoryBadge";
import { FilterLink } from "./FilterLink";
import { MissionImage } from "./MissionImage";
import { ObjectiveBadges } from "./ObjectiveBadges";
import { StatusBadge } from "./StatusBadge";
import { useLanguage } from "../i18n.jsx";
import { cityKeyOf, countryCodeOf } from "../utils/archive.js";
import {
  authorEntries,
  authorSeparator,
  formatAuthors,
  objectiveEntries,
  orderTypeLabel,
} from "../utils/bannerMeta.js";
import { eventMapLocation, eventMapTitle } from "../utils/eventMapLabel";
import { displayCityName, displayCountryName } from "../utils/locations";

const formatCoordinate = (value, positive, negative, fallback) => {
  if (typeof value !== "number") return fallback;
  return `${Math.abs(value).toFixed(4)}° ${value >= 0 ? positive : negative}`;
};

const hasCoordinates = (event) =>
  typeof event.lat === "number" &&
  Number.isFinite(event.lat) &&
  Math.abs(event.lat) <= 90 &&
  typeof event.lng === "number" &&
  Number.isFinite(event.lng) &&
  Math.abs(event.lng) <= 180;

export function EventDetail({
  event,
  open,
  onClose,
  compact = false,
  loading = false,
  loadError = false,
  onRetryDetail,
  filters = null,
  facets = null,
  onDrillDown,
}) {
  const { formatNumber, language, t } = useLanguage();
  const panelRef = useRef(null);
  const previousOpenRef = useRef(false);
  const restoreFocusRef = useRef(null);

  useEffect(() => {
    if (open && !previousOpenRef.current) {
      restoreFocusRef.current = document.activeElement;
      panelRef.current?.focus();
    } else if (!open && previousOpenRef.current) {
      const trigger = restoreFocusRef.current;
      if (trigger?.isConnected) trigger.focus();
      restoreFocusRef.current = null;
    }
    previousOpenRef.current = open;
  }, [open]);

  useEffect(
    () => () => {
      const trigger = restoreFocusRef.current;
      if (trigger?.isConnected) trigger.focus();
    },
    [],
  );

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (keyboardEvent) => {
      if (keyboardEvent.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  if (!event) return null;
  const missions = event.missions ?? [];
  const coordinatesAvailable = hasCoordinates(event);
  const mapTitle = eventMapTitle(event);
  const mixedTitle = /\p{Script=Han}/u.test(mapTitle) && /[A-Za-z]/.test(mapTitle);
  const authorLine = formatAuthors(event.authors, language) ?? t("authorUnknown");
  // 作者逐个渲染，才能按阵营分别着色（色板见 styles/views/data.css 的 .faction-text--*）。
  const authors = authorEntries(event.authors);
  const authorSeparatorText = authorSeparator(language);
  const orderLabel = orderTypeLabel(event.orderType, t);
  // portal 操作类型：只显示「有没有」，不显示次数（与数据页柱状图同口径）。
  // objectives 为 null = 没抓到（objectives.json 缺该拼图），[] = 抓到了但一个操作都没有 ——
  // 两者分开显示，别把「未知」说成「没有」。
  const objectiveKeys = objectiveEntries(event.objectives);
  // 面板里的城市 / 国家 / 分类 / 作者可以就地变成筛选条件。取值必须用和 filterEvents
  // 完全相同的口径（cityKeyOf / countryCodeOf），否则点了筛不出结果。
  const cityKey = cityKeyOf(event);
  const countryKey = countryCodeOf(event);
  const facetCount = (key, value) =>
    value == null || value === "" ? undefined : facets?.[key]?.get(value);
  const isActiveFilter = (key, value) =>
    Boolean(filters) && value != null && value !== "" && filters[key] === value;
  const drilldownProps = (key, value, variant) => ({
    filterKey: key,
    value,
    count: facetCount(key, value),
    active: isActiveFilter(key, value),
    variant,
    onDrillDown,
  });

  return (
    <aside
      ref={panelRef}
      tabIndex={-1}
      className={`detail-panel ${open ? "is-open" : ""}`}
      aria-label={t("bannerDossier")}
      aria-labelledby="event-detail-title"
      aria-hidden={!open}
      inert={!open}
    >
      <div className="detail-panel__heading">
        <div className="detail-panel__identity">
          <span className="section-code">{compact ? t("selectedBanner") : t("bannerDossier")}</span>
          <h2 id="event-detail-title" title={mapTitle}>
            {mixedTitle ? mapTitle.split(/(\p{Script=Han}+)/u).map((part, index) =>
              /\p{Script=Han}/u.test(part)
                ? <span className="detail-panel__han" key={index}>{part}</span>
                : part,
            ) : mapTitle}
          </h2>
          <p title={eventMapLocation(event, language)}>{eventMapLocation(event, language)}</p>
        </div>
        <div className="detail-actions">
          {event.url ? (
            <a
              className="icon-button detail-actions__banner"
              href={event.url}
              target="_blank"
              rel="noreferrer"
              aria-label={t("viewBanner")}
              title={t("viewBanner")}
            >
              <img src={`${import.meta.env.BASE_URL}bannergress-logo.png`} alt="" aria-hidden="true" />
            </a>
          ) : (
            <span className="icon-button detail-actions__banner is-disabled" role="img" aria-label={t("bannerUnavailable")} title={t("bannerUnavailable")}>
              <img src={`${import.meta.env.BASE_URL}bannergress-logo.png`} alt="" aria-hidden="true" />
            </span>
          )}
          {coordinatesAvailable ? (
            <a
              className="icon-button detail-actions__map"
              href={`https://www.google.com/maps?q=${event.lat},${event.lng}`}
              target="_blank"
              rel="noreferrer"
              aria-label={t("openInMap")}
              title={t("openInMap")}
            >
              <MapPin size={18} strokeWidth={1.45} />
            </a>
          ) : null}
        </div>
        <button
          className="icon-button icon-button--quiet"
          type="button"
          aria-label={t("closeDetails")}
          title={t("closeDetails")}
          onClick={onClose}
        >
          <X size={19} strokeWidth={1.3} />
        </button>
      </div>

      <div className="detail-panel__body" key={event.id}>
      <div className="detail-art">
        <span className="detail-art__axis detail-art__axis--x" />
        <span className="detail-art__axis detail-art__axis--y" />
        <MissionImage event={event} eager={open} retryable />
        {event.picture ? (
          <a
            className="detail-art__open"
            href={event.picture}
            target="_blank"
            rel="noreferrer"
          >
            {t("viewOriginalImage")}
          </a>
        ) : null}
        <span className="detail-art__coordinate">SIG // {event.countryCode ?? "XX"}</span>
      </div>

      <dl className="event-facts">
        <div>
          <dt>{t("category")}</dt>
          <dd>
            <FilterLink {...drilldownProps("category", event.category, "badge")}>
              <CategoryBadge category={event.category} />
            </FilterLink>
          </dd>
        </div>
        <div className="event-facts__wide">
          <dt>{t("bannerObjectives")}</dt>
          <dd className="event-facts__objectives">
            {objectiveKeys.length ? (
              <ObjectiveBadges objectives={event.objectives} />
            ) : (
              t(event.objectives == null ? "unknown" : "objectiveNone")
            )}
          </dd>
        </div>
        <div>
          <dt>{t("missionCount")}</dt>
          <dd>
            {event.missionCount != null
              ? formatNumber(event.missionCount)
              : t("unknownMissionCount")}
          </dd>
        </div>
        <div>
          <dt>{t("bannerCompletions")}</dt>
          <dd title={t("completionsHint")}>
            {event.completions != null ? formatNumber(event.completions) : t("unknown")}
          </dd>
        </div>
        <div>
          <dt>{t("averageRating")}</dt>
          <dd className="fact-rating">
            <Star size={13} fill="currentColor" />
            {typeof event.averageRating === "number"
              ? `${event.averageRating.toFixed(1)}%`
              : t("noRating")}
          </dd>
        </div>
        <div>
          <dt>{t("orderType")}</dt>
          <dd>{orderLabel ?? t("unknown")}</dd>
        </div>
        <div>
          <dt>{t("city")}</dt>
          <dd>
            <FilterLink {...drilldownProps("city", cityKey)}>
              {displayCityName(event.countryCode, event.city, language)}
            </FilterLink>
          </dd>
        </div>
        <div>
          <dt>{t("country")}</dt>
          <dd>
            <FilterLink {...drilldownProps("country", countryKey)}>
              {displayCountryName(event.countryCode, event.country, language)}
            </FilterLink>
          </dd>
        </div>
        <div>
          <dt>{t("region")}</dt>
          <dd>{event.region ?? t("unknown")}</dd>
        </div>
        <div>
          <dt>{t("status")}</dt>
          <dd>
            <StatusBadge status={event.status} />
          </dd>
        </div>
        <div>
          <dt>{t("bannerWidth")}</dt>
          <dd>{typeof event.width === "number" ? formatNumber(event.width) : t("unknown")}</dd>
        </div>
        <div className="event-facts__wide">
          <dt>{t("bannerAuthor")}</dt>
          <dd className="event-facts__authors" title={authorLine}>
            {authors.length
              ? authors.map((author, index) => (
                  <Fragment key={`${author.name}-${index}`}>
                    {index > 0 ? authorSeparatorText : null}
                    <FilterLink {...drilldownProps("author", author.name)}>
                      {/* 只靠颜色区分阵营对色觉障碍与读屏都不可靠，所以再补一个仅读屏可见的阵营名。 */}
                      <span className={`author-tag faction-text faction-text--${author.faction}`}>
                        {author.name}
                        <span className="sr-only">
                          {` ${t(author.faction === "unknown" ? "factionUnknown" : author.faction)}`}
                        </span>
                      </span>
                    </FilterLink>
                  </Fragment>
                ))
              : t("authorUnknown")}
          </dd>
        </div>
        <div className="event-facts__wide">
          <dt>{t("coordinates")}</dt>
          <dd>
            {formatCoordinate(event.lat, "N", "S", t("noRating"))}, {formatCoordinate(event.lng, "E", "W", t("noRating"))}
          </dd>
        </div>
      </dl>

      {event.description || !compact ? (
        <section className="detail-description">
          <h3>{t("bannerDescription")}</h3>
          <p>{event.description?.trim() || t("bannerDescriptionEmpty")}</p>
        </section>
      ) : null}

      {!compact ? (
        <div className="mission-list" aria-busy={loading}>
          <div className="mission-list__header">
            <span>
              {t("missionListHeading", {
                count:
                  event.missionCount != null
                    ? formatNumber(event.missionCount)
                    : t("unknownMissionCount"),
              })}
            </span>
            <span>{t("rating")}</span>
          </div>          {loading ? (
            <div className="detail-loading" role="status">
              <LoaderCircle size={18} /> {t("loadingMissions")}
            </div>
          ) : null}
          {loadError ? (
            <div className="detail-loading detail-loading--error" role="alert">
              <span>{t("missionDetailsLoadFailed")}</span>
              {onRetryDetail ? (
                <button className="command-button" type="button" onClick={onRetryDetail}>
                  {t("retry")}
                </button>
              ) : null}
            </div>
          ) : null}
          {!loading && !loadError && !missions.length ? (
            <div className="detail-loading">{t("missionDetailsPending")}</div>
          ) : null}
          {!loading && !loadError
            ? missions.map((mission) => {
                const slot = String(mission.index).padStart(2, "0");
                // 待补齐的槽位：Bannergress 给的原始条目是空对象（无 id / 无标题 / 无链接）。
                // 渲染成一行说明而不是留空——读者才看得出缺的是哪一格。
                if (!mission.id) {
                  return (
                    <div
                      className="mission-row mission-row--pending"
                      key={`slot-${mission.index}`}
                    >
                      <span className="mission-row__index">{slot}</span>
                      <span className="mission-row__main">
                        <strong className="mission-row__pending-label">
                          {t("missionSlotPending")}
                        </strong>
                      </span>
                      <span className="mission-row__rating">—</span>
                    </div>
                  );
                }
                const MissionRow = mission.intelUrl ? "a" : "div";
                const linkProps = mission.intelUrl
                  ? { href: mission.intelUrl, target: "_blank", rel: "noreferrer" }
                  : {};
                return (
                  <MissionRow className="mission-row" {...linkProps} key={mission.id}>
                    <span className="mission-row__index">{slot}</span>
                    <span className="mission-row__main">
                      <strong title={mission.title}>{mission.title}</strong>
                      <small>
                        {mission.distanceText ? (
                          <>
                            <Route size={11} /> {mission.distanceText}
                          </>
                        ) : null}
                        {mission.timeText ? (
                          <>
                            <Clock3 size={11} /> {mission.timeText}
                          </>
                        ) : null}
                        {mission.completions != null ? (
                          <span title={t("missionCompletions")}>
                            <Users size={11} /> {formatNumber(mission.completions)}
                          </span>
                        ) : null}
                      </small>
                    </span>
                    <span className="mission-row__rating">
                      <Star size={11} fill="currentColor" />
                      {typeof mission.rating === "number" ? mission.rating.toFixed(1) : "—"}
                    </span>
                  </MissionRow>
                );
              })
            : null}
        </div>
      ) : null}
      </div>
    </aside>
  );
}
