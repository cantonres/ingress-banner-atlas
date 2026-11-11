import { formatLocalizedNumber } from "../../i18n/formatters.js";
import { objectiveLabel } from "../../utils/bannerMeta.js";

// portal 操作类型分布（拼图级口径）。
//
// 图形刻意沿用「拼图规模分布」那一套横向柱状图（.data-tier-chart / .data-tier-row / .data-track），
// 不另起一套样式：这两张图回答的是同一类问题（「有多少个拼图属于某一类」），
// 视觉上应当同构，用户不用重新学怎么读。
//
// 口径提醒：一根柱子 = **含有该操作的拼图数量**，不是该操作出现的次数，也不是含该操作的任务数。
// 所以各柱之和会远大于拼图总数（一个拼图通常同时含多种操作）。
export function ObjectivePanel({ stats, language, t }) {
  const rows = stats.objectives ?? [];
  if (!rows.length) return null;

  const max = Math.max(1, ...rows.map((row) => row.events));
  const total = stats.eventCount || 0;

  return (
    <section className="data-panel data-objective-panel">
      <header>
        <div>
          <span>{t("byObjective")}</span>
          <h2>{t("objectiveDistribution")}</h2>
        </div>
        <small>{t("objectiveDistributionHint")}</small>
      </header>
      <div className="data-tier-chart">
        {rows.map((row) => (
          <div
            className={`data-tier-row data-objective-row data-objective-row--${row.objective}`}
            key={row.objective}
          >
            <b>{objectiveLabel(row.objective, t)}</b>
            <div className="data-track">
              <i style={{ width: `${(row.events / max) * 100}%` }} />
            </div>
            <strong>{formatLocalizedNumber(row.events, language)}</strong>
            <span>{total ? `${((row.events / total) * 100).toFixed(1)}%` : "—"}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
