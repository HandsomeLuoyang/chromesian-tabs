// render.js — 渲染 tab 栏、书签网格、分组收缩/展开、别名编辑、搜索结果
const Render = (() => {
  let tabs = [];
  let activeTabId = null;
  let onHit = () => {};      // 点击书签回调(记录使用)
  let onAlias = () => {};    // 别名变更回调

  const el = {
    tabbar: () => document.getElementById('tabbar'),
    content: () => document.getElementById('content'),
    results: () => document.getElementById('search-results'),
  };

  function init({ onBookmarkHit, onAliasChange }) {
    onHit = onBookmarkHit;
    onAlias = onAliasChange;
  }

  function getTabs() { return tabs; }

  function setTabs(newTabs) {
    tabs = newTabs;
    itemsCache = null; // 书签变动,搜索索引失效
    const sorted = Usage.sortTabs(tabs);
    // 选中:优先上次选中,否则第一个
    const saved = Store.getActiveTab();
    activeTabId = sorted.find(t => t.id === saved)?.id || sorted[0]?.id || null;
    renderTabbar(sorted);
    renderContent();
  }

  function renderTabbar(sortedTabs) {
    const bar = el.tabbar();
    bar.innerHTML = '';
    sortedTabs.forEach(tab => {
      const b = document.createElement('button');
      b.className = 'tab' + (tab.id === activeTabId ? ' active' : '');
      b.innerHTML = `<span>${Search.escapeHtml(tab.title)}</span><span class="tab-count">${tab.count}</span>`;
      b.addEventListener('click', () => {
        activeTabId = tab.id;
        Store.setActiveTab(tab.id);
        renderTabbar(sortedTabs);
        renderContent();
      });
      bar.appendChild(b);
    });
  }

  function renderContent() {
    closePopover(); // 切 tab 时关掉别名弹窗,避免悬空
    const root = el.content();
    root.innerHTML = '';
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab) { root.innerHTML = '<div class="empty">还没有书签文件夹。去 Chrome 书签栏建几个文件夹吧。</div>'; return; }

    // 最近使用条:紧凑横排,仅当有点击记录时显示
    const recent = Usage.getRecent(8);
    if (recent.length) {
      const bar = document.createElement('div');
      bar.className = 'recent-bar';
      const label = document.createElement('span');
      label.className = 'recent-label';
      label.textContent = '最近';
      bar.appendChild(label);
      recent.forEach(r => {
        const title = findTitle(r.url);
        if (!title) return;
        bar.appendChild(recentCard(r.url, title));
      });
      root.appendChild(bar);
    }

    tab.groups.forEach(group => {
      const groupKey = `${tab.id}:${group.key}`;
      const collapsed = Store.isCollapsed(groupKey);
      const wrap = document.createElement('section');
      wrap.className = 'group' + (collapsed ? ' collapsed' : '');

      if (group.title) {
        const head = document.createElement('div');
        head.className = 'group-head';
        head.innerHTML =
          `<span class="group-caret">▾</span>` +
          `<span class="group-title">${Search.escapeHtml(group.title)}</span>` +
          `<span class="group-count">${group.bookmarks.length}</span>`;
        head.addEventListener('click', () => {
          const now = !wrap.classList.contains('collapsed');
          wrap.classList.toggle('collapsed', now);
          Store.setCollapsed(groupKey, now);
        });
        wrap.appendChild(head);
      }

      const grid = document.createElement('div');
      grid.className = 'grid';
      const ordered = Usage.sortBookmarks(group.bookmarks);
      ordered.forEach((bk, i) => grid.appendChild(cardFor(bk, i)));
      wrap.appendChild(grid);
      root.appendChild(wrap);
    });
  }

  function cardFor(bk, idx = 0) {
    const alias = Store.getAlias(bk.url);
    const display = alias || bk.title || bk.url;
    const a = document.createElement('a');
    a.className = 'card';
    a.href = bk.url;
    a.title = `${display}\n${bk.url}`;
    applyLinkTarget(a);

    a.appendChild(Favicon.create(bk.url, display, 30));

    const body = document.createElement('div');
    body.className = 'card-body';
    body.innerHTML =
      `<div class="card-title">${Search.escapeHtml(display)}</div>` +
      `<div class="card-url">${Search.escapeHtml(prettyUrl(bk.url))}</div>`;
    a.appendChild(body);

    const edit = document.createElement('button');
    edit.className = 'card-edit';
    edit.textContent = '✎';
    edit.title = '设置别名';
    edit.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openAliasPopover(a, bk);
    });
    a.appendChild(edit);

    const star = document.createElement('button');
    star.className = 'card-star' + (Store.isPinned(bk.url) ? ' pinned' : '');
    star.textContent = Store.isPinned(bk.url) ? '★' : '☆';
    star.title = Store.isPinned(bk.url) ? '取消置顶' : '置顶';
    star.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      Store.togglePin(bk.url);
      star.textContent = Store.isPinned(bk.url) ? '★' : '☆';
      star.classList.toggle('pinned', Store.isPinned(bk.url));
      star.title = Store.isPinned(bk.url) ? '取消置顶' : '置顶';
      refresh();
    });
    a.appendChild(star);

    a.addEventListener('click', () => { onHit(bk.url); });
    a.addEventListener('mousedown', (e) => { if (e.button === 1) onHit(bk.url); }); // 中键也计入
    return a;
  }

  // 从 tabs 数据反查书签标题(供最近使用条用,usage 不存标题)
  function findTitle(url) {
    for (const t of tabs) {
      for (const b of t.bookmarks) {
        if (b.url === url) return Store.getAlias(b.url) || b.title || b.url;
      }
    }
    return null;
  }

  function recentCard(url, title) {
    const a = document.createElement('a');
    a.className = 'recent-item';
    a.href = url;
    a.title = title;
    applyLinkTarget(a);
    a.appendChild(Favicon.create(url, title, 20));
    const t = document.createElement('span');
    t.className = 'recent-title';
    t.textContent = title;
    a.appendChild(t);
    a.addEventListener('click', () => onHit(url));
    a.addEventListener('mousedown', (e) => { if (e.button === 1) onHit(url); });
    return a;
  }

  function prettyUrl(url) {
    try {
      const u = new URL(url);
      return u.hostname.replace(/^www\./, '') + (u.pathname !== '/' ? u.pathname : '');
    } catch { return url; }
  }

  // 根据设置给 <a> 设 target:新标签页用 _blank + noopener;否则当前页跳转
  function applyLinkTarget(a) {
    if (Store.getSetting('openInNewTab')) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    } else {
      a.removeAttribute('target');
      a.removeAttribute('rel');
    }
  }

  // 程序化打开 URL(搜索回车、命令面板用),遵循新标签页设置
  function openUrl(url) {
    Store.recordHit(url);
    if (Store.getSetting('openInNewTab')) {
      window.open(url, '_blank', 'noopener');
    } else {
      window.location.href = url;
    }
  }

  // ---------- alias popover ----------
  let activePop = null;
  function openAliasPopover(anchor, bk) {
    closePopover();
    const pop = document.createElement('div');
    pop.className = 'alias-pop';
    const current = Store.getAlias(bk.url);
    pop.innerHTML =
      `<label>别名(留空恢复原标题)</label>` +
      `<input type="text" value="${Search.escapeHtml(current)}" placeholder="${Search.escapeHtml(bk.title || '')}" />` +
      `<div class="alias-pop-actions">` +
        `<button data-act="cancel">取消</button>` +
        `<button class="primary" data-act="save">保存</button>` +
      `</div>`;
    document.body.appendChild(pop);

    const rect = anchor.getBoundingClientRect();
    pop.style.top = (window.scrollY + rect.bottom + 6) + 'px';
    pop.style.left = (window.scrollX + Math.min(rect.left, window.innerWidth - 280)) + 'px';

    const input = pop.querySelector('input');
    input.focus();
    input.select();

    const save = () => { Store.setAlias(bk.url, input.value); onAlias(); closePopover(); };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') save();
      if (e.key === 'Escape') closePopover();
    });
    pop.querySelector('[data-act="save"]').addEventListener('click', save);
    pop.querySelector('[data-act="cancel"]').addEventListener('click', closePopover);

    activePop = pop;
    setTimeout(() => document.addEventListener('mousedown', outside), 0);
    function outside(e) { if (!pop.contains(e.target)) closePopover(); }
    pop._outside = outside;
  }

  function closePopover() {
    if (activePop) {
      document.removeEventListener('mousedown', activePop._outside);
      activePop.remove();
      activePop = null;
    }
  }

  // ---------- search mode ----------
  function showSearch(query) {
    closePopover(); // 搜索时关掉别名弹窗
    const items = allItems();
    const results = Search.run(query, items);
    const box = el.results();
    box.innerHTML = '';

    if (!results.length) {
      box.innerHTML = `<div class="empty">没有匹配「${Search.escapeHtml(query)}」的书签</div>`;
    } else {
      results.forEach((r, i) => box.appendChild(resultRow(r, i === 0, i)));
    }
    el.content().hidden = true;
    el.tabbar().style.display = 'none';
    box.hidden = false;
    return results;
  }

  function resultRow(r, active, idx = 0) {
    const it = r.item;
    const a = document.createElement('a');
    a.className = 'result' + (active ? ' active' : '');
    a.href = it.url;
    a.dataset.url = it.url;
    applyLinkTarget(a);

    a.appendChild(Favicon.create(it.url, r.display, 26));

    const meta = document.createElement('div');
    meta.className = 'result-meta';
    meta.innerHTML =
      `<div class="result-title">${Search.highlight(r.display, r.titleRanges)}</div>` +
      `<div class="result-url">${Search.highlight(prettyUrl(it.url), r.urlRanges)}</div>`;
    a.appendChild(meta);

    if (it.groupTitle) {
      const g = document.createElement('span');
      g.className = 'result-group';
      g.textContent = it.groupTitle;
      a.appendChild(g);
    }

    a.addEventListener('click', () => onHit(it.url));
    a.addEventListener('mousedown', (e) => { if (e.button === 1) onHit(it.url); });
    return a;
  }

  function hideSearch() {
    el.results().hidden = true;
    el.results().innerHTML = '';
    el.content().hidden = false;
    el.tabbar().style.display = '';
  }

  // 展平所有书签为搜索项(带 tab 名作为 groupTitle)。结果缓存,书签/别名变动时失效。
  let itemsCache = null;
  function allItems() {
    if (itemsCache) return itemsCache;
    const items = [];
    const seen = new Set();
    tabs.forEach(tab => {
      if (tab.isAll) return; // 跳过「全部」总览 tab,否则所有项都会被标成"全部"且抢占去重
      tab.bookmarks.forEach(bk => {
        if (seen.has(bk.url)) return; // 同一 URL 去重
        seen.add(bk.url);
        items.push({
          id: bk.id,
          title: bk.title || '',
          url: bk.url,
          _lurl: (bk.url || '').toLowerCase(), // 预存小写 URL,搜索时免重复 toLowerCase
          alias: Store.getAlias(bk.url),
          groupTitle: tab.title,
        });
      });
    });
    itemsCache = items;
    return items;
  }
  function invalidateItems() { itemsCache = null; }

  // 供 masthead 读数用:去重后的书签总数 + 真实分组数(不含「全部」总览 tab)
  function getStats() {
    return { links: allItems().length, groups: tabs.filter(t => !t.isAll).length };
  }

  function refresh() { invalidateItems(); renderContent(); }

  return { init, setTabs, showSearch, hideSearch, refresh, closePopover, invalidateItems, getStats, allItems, openUrl, getTabs };
})();
