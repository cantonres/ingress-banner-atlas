import { MissionImage } from "../MissionImage";
import { formatLocalizedNumber } from "../../i18n/formatters.js";
import { displayCityName, displayCountryName } from "../../utils/locations.js";

// 封面缩略图只给 type="event" 的两张拼图表，理由同 RankingsPanels：
// 拼图封面缩略后可辨，任务图（单张 100px 图标）不可辨，且任务行的点击目标是拼图详情。
// 注意 `--event` 修饰符现在同时承担两件事：多一列「已评分任务」和多一列封面。
function ratingText(value, t) {
  return typeof value === "number" ? `${value.toFixed(1)}%` : t("noRating");
}

function locationText(row, language) {
  return `${displayCityName(row.countryCode, row.city, language)}, ${displayCountryName(row.countryCode, row.country, language)}`;
}

function RankingTable({ title, subtitle, rows, type, language, onSelect, t }) {
  const isEvent = type === "event";
  return (
    <section className="data-panel data-rating-panel">
      <header>
        <div>
          <span>{t("ratingRanking")}</span>
          <h2>{title}</h2>
        </div>
        <small>{subtitle}</small>
      </header>
      <div className={`data-rating-head ${isEvent ? "data-rating-head--event" : ""}`}>
        <span className="data-rating-head__rank">{t("rank")}</span>
        {isEvent ? <span className="data-rating-head__image">{t("image")}</span> : null}
        <span className="data-rating-head__name">{isEvent ? t("banners") : t("mission")}</span>
        <span className="data-rating-head__place">{t("location")}</span>
        {isEvent ? <span className="data-rating-head__rated">{t("ratedMissions")}</span> : null}
        <span className="data-rating-head__rating">{t("rating")}</span>
        <span className="data-rating-head__completions">
          {isEvent ? t("bannerCompletions") : t("missionCompletions")}
        </span>
      </div>
      {rows.map((row, index) => (
        <button
          className={`data-rating-row ${isEvent ? "data-rating-row--event" : ""}`}
          type="button"
          key={row.id}
          onClick={() => onSelect(isEvent ? row.id : row.eventId)}
        >
          <b className="data-rating-row__rank">{String(index + 1).padStart(2, "0")}</b>
          {isEvent ? <MissionImage event={row} className="data-rating-row__image" /> : null}
          <strong className="data-rating-row__name">
            {isEvent ? row.title || row.city : row.title}
          </strong>
          <span className="data-rating-row__place" title={locationText(row, language)}>
            {locationText(row, language)}
          </span>
          {isEvent ? (
            <span className="data-rating-row__rated">
              {formatLocalizedNumber(row.ratedMissions, language)}
            </span>
          ) : null}
          <span className="data-rating-row__rating">{ratingText(row.rating, t)}</span>
          <em className="data-rating-row__completions">
            {formatLocalizedNumber((isEvent ? row.bannerCompletions : row.completions) ?? 0, language)}
          </em>
        </button>
      ))}
    </section>
  );
}

export function RatingRankingsPanel({ stats, language, onSelect, t }) {
  return (
    <div className="data-rating-grid">
      <RankingTable
        title={t("topRatedBanners")}
        subtitle={t("averageMissionRating")}
        rows={stats.topRatedEvents}
        type="event"
        language={language}
        onSelect={onSelect}
        t={t}
      />
      <RankingTable
        title={t("lowestRatedBanners")}
        subtitle={t("averageMissionRating")}
        rows={stats.lowestRatedEvents}
        type="event"
        language={language}
        onSelect={onSelect}
        t={t}
      />
      <RankingTable
        title={t("topRatedMissions")}
        subtitle={t("singleMissionRating")}
        rows={stats.topRatedMissions}
        type="mission"
        language={language}
        onSelect={onSelect}
        t={t}
      />
      <RankingTable
        title={t("lowestRatedMissions")}
        subtitle={t("singleMissionRating")}
        rows={stats.lowestRatedMissions}
        type="mission"
        language={language}
        onSelect={onSelect}
        t={t}
      />
    </div>
  );
}
