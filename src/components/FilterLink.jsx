import { useLanguage } from "../i18n.jsx";

/**
 * 拼图档案面板里的站内钻取链接：点击把该要素变成筛选条件，就地换结果集，不离开当前视图。
 *
 * 视觉上必须和外链区分开。面板右上角的 Bannergress / 地图 / 原图是图标按钮、任务行是整行链接，
 * 它们都是「出去」；这里是「就地换筛选」。约定：**虚线底边 = 站内钻取，没有底边 = 外链**。
 * 所以这里刻意不加实线下划线，也不加外跳图标。
 *
 * count 取整个档案的拼图数（见 buildDrilldownFacets），用于让用户在点击之前就知道值不值得点 ——
 * 作者维度尤其需要：档案里过半作者只有 1 个拼图，不带数量点下去常常「看起来没反应」。
 */
export function FilterLink({
  filterKey,
  value,
  count,
  active = false,
  variant,
  onDrillDown,
  children,
}) {
  const { formatNumber, t } = useLanguage();
  if (!onDrillDown || value == null || value === "") return children ?? null;

  return (
    <button
      type="button"
      className={`filter-link ${variant ? `filter-link--${variant}` : ""} ${
        active ? "is-active" : ""
      }`}
      // 已经是这个筛选值时点下去不会改变任何东西，用 aria-current 说明，
      // 而不是让它看起来像一个坏掉的链接。
      aria-current={active ? "true" : undefined}
      title={t(active ? "filterApplied" : "filterByThis")}
      onClick={() => onDrillDown(filterKey, value)}
    >
      {children}
      {typeof count === "number" ? (
        // 计数取整个档案，所以它可能大于「叠加当前其它筛选后的实际结果数」。
        // 把这一点挂在数字本身上说明，避免被读成「点下去就能看到这么多条」。
        <span className="filter-link__count" title={t("drilldownCountHint")}>
          {formatNumber(count)}
        </span>
      ) : null}
    </button>
  );
}
