// palette.js — Command Palette (Ctrl+K):搜索书签 + 命令执行
const Palette = (() => {
  const COMMANDS = [
    { key: '新增书签', action: () => { close(); document.getElementById('add-bookmark').click(); } },
    { key: '设置',     action: () => { close(); document.getElementById('open-settings').click(); } },
    { key: '统计',     action: () => { close(); Stats.open(); } },
    { key: '切换排序', action: () => { close(); document.getElementById('toggle-sort').click(); } },
    { key: '清除统计', action: () => { close(); document.getElementById('stats-panel').hidden = true; Store.clearUsage(); onReload(); } },
  ];

  let activeIdx = 0;
  let results = [];

  function open() {
    const panel = document.getElementById('palette');
    const input = document.getElementById('palette-input');
    input.value = '';
    results = [];
    activeIdx = 0;
    renderResults([]);
    panel.hidden = false;
    input.focus();
  }

  function close() {
    document.getElementById('palette').hidden = true;
    results = [];
    activeIdx = 0;
  }

  function renderResults(list) {
    const box = document.getElementById('palette-results');
    box.innerHTML = '';
    list.forEach((r, i) => {
      const div = document.createElement('div');
      div.className = 'pal-item' + (i === activeIdx ? ' active' : '');
      if (r.isCmd) {
        div.innerHTML = `<span class="pal-cmd-mark">&gt;</span><span>${Search.escapeHtml(r.label)}</span>`;
      } else {
        div.innerHTML =
          `<span class="pal-favicon-wrap"></span>` +
          `<span class="pal-title">${Search.escapeHtml(r.display)}</span>` +
          `<span class="pal-url">${Search.escapeHtml(r.url)}</span>`;
        // 异步挂 favicon
        const wrap = div.querySelector('.pal-favicon-wrap');
        wrap.appendChild(Favicon.create(r.url, r.display, 20));
      }
      div.addEventListener('click', () => { activeIdx = i; executeCurrent(); });
      div.addEventListener('mouseenter', () => { activeIdx = i; highlight(); });
      box.appendChild(div);
    });
    if (!list.length) {
      box.innerHTML = '<div class="pal-empty">无匹配结果</div>';
    }
  }

  function highlight() {
    const items = document.querySelectorAll('#palette-results .pal-item');
    items.forEach((el, i) => el.classList.toggle('active', i === activeIdx));
  }

  function executeCurrent() {
    const r = results[activeIdx];
    if (!r) return;
    if (r.isCmd) { r.action(); }
    else {
      close();
      Render.openUrl(r.url);
    }
  }

  // 初始化:绑定键盘
  function init(searchItemsFn, reloadFn) {
    onReload = reloadFn;
    const input = document.getElementById('palette-input');

    input.addEventListener('input', () => {
      const q = input.value.trim();
      if (!q) { results = []; activeIdx = 0; renderResults([]); return; }

      if (q.startsWith('>')) {
        // 命令模式
        const cmdQ = q.slice(1).toLowerCase();
        results = COMMANDS
          .filter(c => c.key.toLowerCase().includes(cmdQ))
          .map(c => ({ isCmd: true, label: c.key, action: c.action }));
      } else {
        // 书签搜索
        const items = searchItemsFn();
        const hits = Search.run(q, items).slice(0, 8);
        results = hits.map(h => ({
          isCmd: false,
          url: h.item.url,
          display: h.item.alias || h.item.title || h.item.url,
        }));
      }
      activeIdx = 0;
      renderResults(results);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); activeIdx = (activeIdx + 1) % Math.max(results.length, 1); highlight(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); activeIdx = (activeIdx - 1 + results.length) % Math.max(results.length, 1); highlight(); }
      else if (e.key === 'Enter') { e.preventDefault(); executeCurrent(); }
    });

    document.getElementById('palette').addEventListener('click', (e) => {
      if (e.target.id === 'palette') close();
    });
  }

  return { open, close, init };
})();
