import { useLanguage } from "../i18n.jsx";
import { CATEGORIES } from "../utils/bannerMeta.js";

// 拼图类型徽章。判据只有一条：Bannergress 的 eventStartDate 有值 = MD 拼图，
// 否则 = 玩家自制拼图。只有这两个值，没有下级。
//
// 注意：**不要**在这里再挂「拼图规模」档位。规模是按任务数分桶的派生维度，
// 每个拼图身上已经有任务数了，再贴一个档位标签等于把类型按任务数二次细分，
// 语义重复且层级混乱。规模只以三种形式存在：筛选器、按任务数排序、规模分布图。
export function CategoryBadge({ category }) {
  const { t } = useLanguage();
  if (!CATEGORIES.includes(category)) return null;

  return (
    <span className={`banner-badge banner-badge--${category}`}>
      {t(category === "mission-day" ? "categoryMissionDay" : "categoryPlayer")}
    </span>
  );
}
