import { INITIAL_FILTERS } from "./archive.js";

// 排序方向不是筛选条件：它不改变「哪些拼图被选中」，只改变已选维度的展示次序。
// 单独出一个 chip 会让人误以为它在过滤数据，所以它的状态并入 sort 的 chip 文案。
const NOT_A_CRITERION = new Set(["sortDir"]);

export function activeFilterEntries(filters) {
  return Object.entries(filters).filter(
    ([key, value]) =>
      !NOT_A_CRITERION.has(key) &&
      value !== INITIAL_FILTERS[key] &&
      String(value).trim() !== "",
  );
}
