// main.js — 入口:装配各模块,处理搜索输入与键盘导航,监听书签变动
(async function main() {
  await Store.load();

  // 尽早应用保存的页面宽度,避免开局闪一下默认宽度
  Settings.applyWidth(Store.getSetting('maxWidth'));

  Render.init({
    onBookmarkHit: (url) => Store.recordHit(url),
    // 先让搜索索引失效,再重建搜索/重绘,确保用上新别名
    onAliasChange: () => { Render.invalidateItems(); rebuildSearchIfActive(); Render.refresh(); },
  });

  Stats.init(() => Render.getTabs());

  Settings.init({
    onSettingChange: () => { Render.setTabs(currentTabs); updateReadout(); },
  });

  let currentTabs = [];
  async function reload() {
    currentTabs = await Bookmarks.getTabs();
    Render.setTabs(currentTabs);
    updateReadout();
  }

  // ---------- masthead 读数:链接数 / 分组数 / 时钟 ----------
  const readoutEl = document.getElementById('readout');
  function updateReadout() {
    const { links, groups } = Render.getStats();
    const t = new Date();
    const hh = String(t.getHours()).padStart(2, '0');
    const mm = String(t.getMinutes()).padStart(2, '0');
    readoutEl.innerHTML =
      `<b>${links}</b> 链接` +
      `<span class="sep">/</span><b>${groups}</b> 分组` +
      `<span class="sep">/</span><b>${hh}:${mm}</b>`;
  }
  // 时钟每 30s 走一次(够准,几乎零开销)
  setInterval(updateReadout, 30000);

  await reload();

  // 书签变动 → 重建(搜索态下不打断输入)
  Bookmarks.onChange(async () => {
    currentTabs = await Bookmarks.getTabs();
    if (searchInput.value.trim()) runSearch();
    else Render.setTabs(currentTabs);
    updateReadout();
  });

  // ---------- search ----------
  const searchInput = document.getElementById('search');
  const clearBtn = document.getElementById('search-clear');
  const searchHint = document.getElementById('search-hint');
  let activeResults = [];
  let activeIdx = 0;
  let debounceTimer = null;

  searchInput.focus();

  function runSearch() {
    const q = searchInput.value.trim();
    if (!q) { exitSearch(); return; }
    activeResults = Render.showSearch(q);
    activeIdx = 0;
    clearBtn.hidden = false;
    searchHint.hidden = true;
  }

  function exitSearch() {
    Render.hideSearch();
    activeResults = [];
    activeIdx = 0;
    clearBtn.hidden = true;
    searchHint.hidden = !!searchInput.value;
  }

  function rebuildSearchIfActive() {
    if (searchInput.value.trim()) runSearch();
  }

  searchInput.addEventListener('input', () => {
    searchHint.hidden = !!searchInput.value; // 一打字就藏起 "/" 提示
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runSearch, 80);
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (searchInput.value) { searchInput.value = ''; exitSearch(); }
      else searchInput.blur();
      return;
    }
    if (!activeResults.length) return;

    if (e.key === 'ArrowDown') { e.preventDefault(); moveSel(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveSel(-1); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const r = activeResults[activeIdx];
      if (r) Render.openUrl(r.item.url);
    }
  });

  function moveSel(delta) {
    const rows = document.querySelectorAll('#search-results .result');
    if (!rows.length) return;
    rows[activeIdx]?.classList.remove('active');
    activeIdx = (activeIdx + delta + rows.length) % rows.length;
    rows[activeIdx]?.classList.add('active');
    rows[activeIdx]?.scrollIntoView({ block: 'nearest' });
  }

  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    exitSearch();
    searchInput.focus();
  });

  // 全局 "/" 聚焦搜索
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== searchInput) {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  });

  // ---------- add bookmark ----------
  const addPanel = document.getElementById('add-panel');
  const addUrl = document.getElementById('add-url');
  const addTitle = document.getElementById('add-title');
  const addFolder = document.getElementById('add-folder');
  const addForm = document.getElementById('add-form');

  async function openAddPanel() {
    // 填充文件夹下拉
    const tree = await chrome.bookmarks.getTree();
    const folders = Bookmarks.getFolderList(tree);
    addFolder.innerHTML = '';
    folders.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f.id;
      opt.textContent = f.title;
      addFolder.appendChild(opt);
    });
    addUrl.value = '';
    addTitle.value = '';
    addPanel.hidden = false;
    addUrl.focus();
  }

  document.getElementById('add-bookmark').addEventListener('click', openAddPanel);

  document.getElementById('close-add').addEventListener('click', () => { addPanel.hidden = true; });
  document.getElementById('cancel-add').addEventListener('click', () => { addPanel.hidden = true; });
  addPanel.addEventListener('click', (e) => { if (e.target === addPanel) addPanel.hidden = true; });

  addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = addUrl.value.trim();
    if (!url) return;
    const title = addTitle.value.trim() || url;
    const parentId = addFolder.value;
    await chrome.bookmarks.create({ parentId, title, url });
    addPanel.hidden = true;
    await reload();
  });

  // ---------- stats ----------
  document.getElementById('open-stats').addEventListener('click', () => Stats.open());

  // ---------- command palette ----------
  Palette.init(() => Render.allItems(), reload);
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      Palette.open();
    }
  });
})();
