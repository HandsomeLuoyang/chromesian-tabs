// usage.js — 使用频率评分 + 排序(近因衰减,避免历史高频永远霸榜)
const Usage = (() => {
  const HALF_LIFE_DAYS = 14;          // 半衰期:14 天
  const MS_PER_DAY = 86400000;
  const DECAY = Math.LN2 / HALF_LIFE_DAYS;

  // 单个书签的得分:count 经近因衰减
  function scoreFor(url, now = Date.now()) {
    const { count, lastUsed } = Store.getUsage(url);
    if (!count) return 0;
    const ageDays = lastUsed ? (now - lastUsed) / MS_PER_DAY : 9999;
    const recency = Math.exp(-DECAY * ageDays);
    return count * (0.3 + 0.7 * recency); // 保留基础权重,叠加近因
  }

  // 对书签数组排序(不改原数组)。星标置顶,其余按使用频率或原始顺序。
  function sortBookmarks(list) {
    const pinned = list.filter(b => Store.isPinned(b.url));
    const rest = list.filter(b => !Store.isPinned(b.url));
    const ordered = !Store.getSetting('autoSort')
      ? rest.slice()
      : (() => {
          const now = Date.now();
          return rest
            .map((b, i) => ({ b, i, s: scoreFor(b.url, now) }))
            .sort((a, z) => (z.s - a.s) || (a.i - z.i))
            .map(x => x.b);
        })();
    return [...pinned, ...ordered];
  }

  // tab 的聚合得分:其下所有书签得分之和
  function tabScore(bookmarks, now = Date.now()) {
    let s = 0;
    for (const b of bookmarks) s += scoreFor(b.url, now);
    return s;
  }

  // 对 tab 列表排序(不改原数组)。每个 tab 形如 { id, title, bookmarks, ... }
  // isAll(「全部」总览)始终固定在最前,不参与使用频率重排。
  function sortTabs(tabs) {
    const pinned = tabs.filter(t => t.isAll);
    const rest = tabs.filter(t => !t.isAll);
    const ordered = !Store.getSetting('autoSort')
      ? rest.slice()
      : (() => {
          const now = Date.now();
          return rest
            .map((t, i) => ({ t, i, s: tabScore(t.bookmarks, now) }))
            .sort((a, z) => (z.s - a.s) || (a.i - z.i))
            .map(x => x.t);
        })();
    return [...pinned, ...ordered];
  }

  // 最近使用:N 个 lastUsed 最大的书签(仅当有点击记录)
  function getRecent(n = 8) {
    const entries = [];
    for (const [url, u] of Object.entries(Store.get().usage)) {
      if (u.lastUsed) entries.push({ url, lastUsed: u.lastUsed });
    }
    return entries
      .sort((a, z) => z.lastUsed - a.lastUsed)
      .slice(0, n)
      .map(e => ({ url: e.url, lastUsed: e.lastUsed }));
  }

  return { scoreFor, sortBookmarks, sortTabs, getRecent };
})();
