import { formatLocalizedNumber } from "../../i18n/formatters.js";
import { orderTypeLabel } from "../../utils/bannerMeta.js";

// 任务顺序（顺序拼图 / 任意顺序拼图）独立于「拼图类型」——Bannergress 的 type 字段
// 只描述「任务是否必须按编号顺序完成」，与是不是 MD 拼图无关。
// 两档即使为 0 也照样渲染，界面上要能直接读出「18 顺序 / 0 任意顺序」这类真实分布。
export function OrderTypePanel({ stats, language, t }) {
  const total = stats.orderTypes.reduce((sum, row) => sum + row.events, 0);
  const share = (events) => (total ? (events / total) * 100 : 0);

  return (
    <section className="data-panel data-order-panel">
      <header>
        <div>
          <span>{t("byOrderType")}</span>
          <h2>{t("orderTypeDistribution")}</h2>
        </div>
        <small>{t("currentFilterScope")}</small>
      </header>
      <div className="data-order-grid">
        {stats.orderTypes.map((row) => {
          const key = row.orderType ?? "unknown";
          const label = orderTypeLabel(row.orderType, t) ?? t("unknown");
          return (
            <div className={`data-order-tile data-order-tile--${key}`} key={key}>
              <strong>{label}</strong>
              <b>{formatLocalizedNumber(row.events, language)}</b>
              <small>
                {t("banners")} · {share(row.events).toFixed(1)}%
              </small>
              <div className="data-track">
                <i style={{ width: `${share(row.events)}%` }} />
              </div>
              <span>
                {formatLocalizedNumber(row.missions, language)} {t("missions")}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
