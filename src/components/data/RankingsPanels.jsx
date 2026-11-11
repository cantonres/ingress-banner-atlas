import { MissionImage } from "../MissionImage";
import { formatLocalizedNumber } from "../../i18n/formatters.js";
import { displayCityName, displayCountryName } from "../../utils/locations.js";

// 「拼图完成人数」与「任务完成人数」是两个不同的量，因此拆成两个面板：
//   - 拼图排名：按完整走完整个拼图的人数排（archive 的 event.completions）
//   - 任务排名：按单个任务的完成人数排
// 混在一起排会得到「任务完成人次最多的拼图」，语义不对。
//
// 封面缩略图只给拼图排名，任务排名刻意不加，依据是数据而不是省事：
//   1. 拼图封面是自包含的多图拼贴（604px 宽、每行 6 格），缩略后仍能看出整体图案；
//      任务图是单张 100px 图标，缩到行内尺寸只剩色块。
//   2. 任务排名 top10 实测全部来自同一个拼图（五城数据下 10/10 是 md-guangzhou-ed45），
//      给「所属拼图封面」会得到 10 行同一张图；给「任务图标」又与点击跳转目标
//      （onSelect(mission.eventId) 打开的是拼图详情）不一致。
//
// 单元格一律用显式类名定位。加封面列后，原先的 nth-child / first-of-type 规则会整体
// 错位（窄屏靠它们隐藏「位置」列），因此这些规则同步改成了类名选择器。

function locationText(row, language) {
  return `${displayCityName(row.countryCode, row.city, language)}, ${displayCountryName(row.countryCode, row.country, language)}`;
}

function RankingHead({ nameLabel, metricLabel, completionsLabel, withImage, t }) {
  return (
    <div className={`data-rank-head ${withImage ? "data-rank-head--image" : ""}`}>
      <span className="data-rank-head__rank">{t("rank")}</span>
      {withImage ? <span className="data-rank-head__image">{t("image")}</span> : null}
      <span className="data-rank-head__name">{nameLabel}</span>
      <span className="data-rank-head__place">{t("location")}</span>
      <span className="data-rank-head__metric">{metricLabel}</span>
      <span className="data-rank-head__completions">{completionsLabel}</span>
    </div>
  );
}

function RankingRow({ id, rank, name, location, metric, completions, imageRow, onSelect }) {
  return (
    <button
      className={`data-rank-row ${imageRow ? "data-rank-row--image" : ""}`}
      type="button"
      onClick={() => onSelect(id)}
    >
      <b className="data-rank-row__rank">{String(rank + 1).padStart(2, "0")}</b>
      {imageRow ? <MissionImage event={imageRow} className="data-rank-row__image" /> : null}
      <strong className="data-rank-row__name" title={name}>{name}</strong>
      <span className="data-rank-row__place" title={location}>{location}</span>
      <span className="data-rank-row__metric">{metric}</span>
      <em className="data-rank-row__completions">{completions}</em>
    </button>
  );
}

export function TopBannersPanel({ banners, language, onSelect, t }) {
  return (
    <section className="data-panel data-rank-panel">
      <header>
        <div>
          <span>{t("bannerRanking")}</span>
          <h2>{t("mostCompletedBanners")}</h2>
        </div>
        <small>{t("recordedCompletions")}</small>
      </header>
      <RankingHead
        nameLabel={t("banners")}
        metricLabel={t("missionCount")}
        completionsLabel={t("bannerCompletions")}
        withImage
        t={t}
      />
      {banners.map((banner, index) => (
        <RankingRow
          key={banner.id}
          id={banner.id}
          rank={index}
          name={banner.title || banner.id}
          location={locationText(banner, language)}
          metric={formatLocalizedNumber(banner.missionCount, language)}
          completions={
            banner.completions == null
              ? t("unknown")
              : formatLocalizedNumber(banner.completions, language)
          }
          imageRow={banner}
          onSelect={onSelect}
        />
      ))}
    </section>
  );
}

export function TopMissionsPanel({ missions, language, onSelect, t }) {
  return (
    <section className="data-panel data-rank-panel">
      <header>
        <div>
          <span>{t("missionRanking")}</span>
          <h2>{t("mostCompletedMissions")}</h2>
        </div>
        <small>{t("recordedCompletions")}</small>
      </header>
      <RankingHead
        nameLabel={t("mission")}
        metricLabel={t("rating")}
        completionsLabel={t("missionCompletions")}
        t={t}
      />
      {missions.map((mission, index) => (
        <RankingRow
          key={mission.id}
          id={mission.eventId}
          rank={index}
          name={mission.title}
          location={locationText(mission, language)}
          metric={
            typeof mission.rating === "number"
              ? `${mission.rating.toFixed(1)}%`
              : t("noRating")
          }
          completions={formatLocalizedNumber(mission.completions, language)}
          onSelect={onSelect}
        />
      ))}
    </section>
  );
}
