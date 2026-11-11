import { useLanguage } from "../i18n.jsx";
import { objectiveEntries, objectiveLabel } from "../utils/bannerMeta.js";

// 拼图的 portal 操作标签。
//
// 口径（与 PORTAL_OBJECTIVES 一致）：
//   - **只标「有没有」，不标次数** —— 拼图里出现过该操作就贴标签。
//   - `hack` 用弱化配色：绝大多数拼图都含入侵，
//     给它上色等于整列都在高亮；弱化的 hack + 有色的其它操作，读起来就是「这一行特别在哪」。
//   - `objectives` 为 null = 该拼图没抓到操作数据（不是「没有操作」），此时不渲染任何标签。
export function ObjectiveBadges({ objectives, className = "" }) {
  const { t } = useLanguage();
  const entries = objectiveEntries(objectives);
  if (!entries.length) return null;

  return (
    <span className={`objective-badges ${className}`.trim()}>
      {entries.map((objective) => (
        <span className={`banner-badge banner-badge--objective-${objective}`} key={objective}>
          {objectiveLabel(objective, t)}
        </span>
      ))}
    </span>
  );
}
