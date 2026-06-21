// settings.js — 设置面板:自动排序开关、页面宽度、清空使用统计
const Settings = (() => {
  let onChange = () => {};

  const WIDTH_MAX = 2600; // 滑块顶档:视为「全宽」(占满浏览器)

  // 把宽度设置落到 :root 的 --app-max 上;9999/超过顶档 => 全宽
  function applyWidth(px) {
    const full = !px || px >= WIDTH_MAX;
    document.documentElement.style.setProperty('--app-max', full ? 'none' : px + 'px');
  }

  function widthLabel(px) {
    return (!px || px >= WIDTH_MAX) ? '全宽' : px + 'px';
  }

  function init({ onSettingChange }) {
    onChange = onSettingChange;

    const panel = document.getElementById('settings-panel');
    const open = document.getElementById('open-settings');
    const close = document.getElementById('close-settings');
    const autosort = document.getElementById('set-autosort');
    const newtab = document.getElementById('set-newtab');
    const clearStats = document.getElementById('clear-stats');
    const toggleSort = document.getElementById('toggle-sort');
    const width = document.getElementById('set-width');
    const widthOut = document.getElementById('width-readout');

    autosort.checked = Store.getSetting('autoSort');
    newtab.checked = Store.getSetting('openInNewTab');
    syncToggleBtn(toggleSort);

    // 宽度:初始化滑块与读数(全宽存为 9999,滑块落到顶档)
    const savedW = Store.getSetting('maxWidth') || 1100;
    width.value = Math.min(savedW, WIDTH_MAX);
    widthOut.textContent = widthLabel(savedW);

    open.addEventListener('click', () => { panel.hidden = false; });
    close.addEventListener('click', () => { panel.hidden = true; });
    panel.addEventListener('click', (e) => { if (e.target === panel) panel.hidden = true; });

    autosort.addEventListener('change', () => {
      Store.setSetting('autoSort', autosort.checked);
      syncToggleBtn(toggleSort);
      onChange();
    });

    // 新标签页打开:切换后重渲染,让所有链接的 target 即时更新
    newtab.addEventListener('change', () => {
      Store.setSetting('openInNewTab', newtab.checked);
      onChange();
    });

    // 宽度滑块:拖动即时生效(不重排数据,只调容器宽度,网格自动改列数)
    width.addEventListener('input', () => {
      const raw = parseInt(width.value, 10);
      const stored = raw >= WIDTH_MAX ? 9999 : raw;
      applyWidth(stored);
      widthOut.textContent = widthLabel(stored);
      Store.setSetting('maxWidth', stored);
    });

    // 顶部快捷开关
    toggleSort.addEventListener('click', () => {
      const next = !Store.getSetting('autoSort');
      Store.setSetting('autoSort', next);
      autosort.checked = next;
      syncToggleBtn(toggleSort);
      onChange();
    });

    clearStats.addEventListener('click', () => {
      document.getElementById('stats-panel').hidden = true;
      Store.clearUsage();
      onChange();
    });
  }

  function syncToggleBtn(btn) {
    const on = Store.getSetting('autoSort');
    btn.classList.toggle('active', on);
    btn.title = on ? '自动排序:开(点击关闭)' : '自动排序:关(点击开启)';
  }

  return { init, applyWidth };
})();
