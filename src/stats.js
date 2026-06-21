// stats.js — 使用统计面板:总览、点击 Top 10、最近活跃
const Stats = (() => {
  // 调用方在打开面板时传入 tabs 数据(来自 Render.getTabs())
  let tabsProvider = () => [];
  function init(getTabsFn) { tabsProvider = getTabsFn; }

  function open() {
    const panel = document.getElementById('stats-panel');
    render(panel);
    panel.hidden = false;
  }

  function close() {
    document.getElementById('stats-panel').hidden = true;
  }

  function render(panel) {
    const usage = Store.get().usage;
    const entries = [];
    for (const [url, u] of Object.entries(usage)) {
      if (u.count) entries.push({ url, count: u.count, lastUsed: u.lastUsed });
    }
    if (!entries.length) {
      document.getElementById('stats-summary').innerHTML =
        '<div class="empty" style="padding:24px 0">暂无使用数据。点几个书签后再来看。</div>';
      document.getElementById('stats-top').innerHTML = '';
      document.getElementById('stats-recent').innerHTML = '';
      return;
    }

    // 总览
    const totalClicks = entries.reduce((s, e) => s + e.count, 0);
    const uniqueLinks = entries.length;
    const topFolder = topFolderName();
    document.getElementById('stats-summary').innerHTML =
      `<div class="stats-row">` +
        `<div class="stats-num"><b>${totalClicks}</b><span>总点击</span></div>` +
        `<div class="stats-num"><b>${uniqueLinks}</b><span>点过书签</span></div>` +
        (topFolder ? `<div class="stats-num stats-num-text"><b title="${Search.escapeHtml(topFolder)}">${Search.escapeHtml(topFolder)}</b><span>最活跃分组</span></div>` : '') +
      `</div>`;

    // Top 10
    const top = entries.sort((a, z) => z.count - a.count).slice(0, 10);
    const max = top[0]?.count || 1;
    document.getElementById('stats-top').innerHTML =
      `<div class="stats-section-title">点击 Top ${top.length}</div>` +
      top.map((e, i) => {
        const title = findTitle(e.url) || e.url;
        const pct = Math.round((e.count / max) * 100);
        return `<div class="stats-bar-row" title="${Search.escapeHtml(e.url)}">
          <span class="stats-bar-fill" style="width:${pct}%"></span>
          <span class="stats-rank">${i + 1}</span>
          <span class="stats-bar-label">${Search.escapeHtml(title)}</span>
          <span class="stats-bar-count">${e.count}</span>
        </div>`;
      }).join('');

    // 最近活跃(7天内)
    const cutoff = Date.now() - 7 * 86400000;
    const recent = entries.filter(e => e.lastUsed > cutoff).sort((a, z) => z.lastUsed - a.lastUsed).slice(0, 10);
    document.getElementById('stats-recent').innerHTML =
      `<div class="stats-section-title">最近 7 天</div>` +
      (recent.length
        ? recent.map(e => {
            const title = findTitle(e.url) || e.url;
            const date = new Date(e.lastUsed);
            const ds = `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
            return `<div class="stats-recent-row">
              <span class="stats-recent-title" title="${Search.escapeHtml(e.url)}">${Search.escapeHtml(title)}</span>
              <span class="stats-recent-time">${ds}</span>
            </div>`;
          }).join('')
        : '<div class="empty" style="padding:12px 0;font-size:12px">最近 7 天没有点击</div>');

    // 关闭按钮
    document.getElementById('close-stats').onclick = close;
    panel.onclick = (e) => { if (e.target === panel) close(); };
  }

  function findTitle(url) {
    const tabs = tabsProvider();
    for (const tab of tabs) {
      for (const b of tab.bookmarks) {
        if (b.url === url) return Store.getAlias(b.url) || b.title || b.url;
      }
    }
    return null;
  }

  function topFolderName() {
    const tabs = tabsProvider();
    if (!tabs.length) return null;
    let best = null, bestScore = 0;
    for (const tab of tabs) {
      if (tab.isAll) continue;
      let s = 0;
      for (const b of tab.bookmarks) {
        const u = Store.getUsage(b.url);
        s += u.count;
      }
      if (s > bestScore) { bestScore = s; best = tab.title; }
    }
    return best;
  }

  return { init, open, close };
})();
