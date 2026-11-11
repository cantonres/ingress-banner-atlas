import { Shield } from "lucide-react";
import { formatLocalizedNumber } from "../../i18n/formatters.js";
import { formatPublisherShare } from "./statistics";

export function PublisherPanel({ stats, language, t }) {
  const twoFactionMissionCount =
    stats.factionMissions.resistance + stats.factionMissions.enlightened;
  const resistanceShare = twoFactionMissionCount
    ? (stats.factionMissions.resistance / twoFactionMissionCount) * 100
    : 0;
  const enlightenedShare = twoFactionMissionCount ? 100 - resistanceShare : 0;
  // 任务占比：该作者的任务数占「已识别发布者的任务总数」的比例。
  // 列表里的占比数字与占比条共用这一个口径，改一处即可同步。
  const missionShare = (missions) =>
    stats.publishedMissionCount
      ? (missions / stats.publishedMissionCount) * 100
      : 0;

  return (
    <section className="data-panel data-publishers">
      <header>
        <div>
          <span>{t("publisherAccounts")}</span>
          <h2>{t("missionsByPublisher")}</h2>
        </div>
        <span className="data-publisher-summary">
          <Shield size={16} strokeWidth={1.2} />
          {formatLocalizedNumber(stats.publishedMissionCount, language)} / {formatLocalizedNumber(stats.missionCount, language)} {t("publisherIdentified")}
        </span>
      </header>
      <div className="data-publisher-charts">
        <section className="data-chart-group">
          <h3>{t("factionDistribution")}</h3>
          <div className="data-chart-layout">
            <div
              className="data-faction-chart"
              role="img"
              aria-label={`${t("resistance")} ${resistanceShare.toFixed(1)}%, ${t("enlightened")} ${enlightenedShare.toFixed(1)}%`}
              style={{ "--resistance-share": `${resistanceShare}%` }}
            >
              <div>
                <strong>{formatLocalizedNumber(twoFactionMissionCount, language)}</strong>
                <small>{t("missions")}</small>
              </div>
            </div>
            <div className="data-faction-breakdown" aria-label={t("factionLegend")}>
              {[
                ["resistance", stats.factionMissions.resistance, resistanceShare],
                ["enlightened", stats.factionMissions.enlightened, enlightenedShare],
              ].map(([faction, count, percentage]) => (
                <div key={faction}>
                  <span className={`faction faction--${faction}`}>
                    <i /> {t(faction)}
                  </span>
                  <strong>{formatLocalizedNumber(count, language)}</strong>
                  <small>{percentage.toFixed(1)}%</small>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
      <div className="data-publisher-head">
        <span>{t("rank")}</span>
        <span>{t("publisherAccount")}</span>
        <span>{t("missionShare")}</span>
        <span>{t("missions")}</span>
        <span>{t("banners")}</span>
      </div>
      {stats.publishers.map((publisher, index) => (
        <div className="data-publisher-row" key={publisher.author}>
          <b>{String(index + 1).padStart(2, "0")}</b>
          <span className="data-publisher-account">
            {/* 阵营信息现在只靠颜色表达（名字与占比条），这里补一段仅供读屏的
                阵营文字，避免色觉障碍用户失去这条信息。 */}
            <strong className={`faction-text faction-text--${publisher.faction}`}>
              {publisher.author}
              <span className="sr-only">
                {` ${t(
                  publisher.faction === "unknown"
                    ? "factionUnknown"
                    : publisher.faction,
                )}`}
              </span>
            </strong>
            <span className="data-track">
              <i
                className={`faction-bar faction-bar--${publisher.faction}`}
                style={{ width: `${missionShare(publisher.missions)}%` }}
              />
            </span>
          </span>
          <em>{formatPublisherShare(missionShare(publisher.missions))}</em>
          <em>{formatLocalizedNumber(publisher.missions, language)}</em>
          <em>{formatLocalizedNumber(publisher.events, language)}</em>
        </div>
      ))}
    </section>
  );
}
