// storage.js — chrome.storage.local 封装,集中管理别名 / 使用统计 / 顺序 / 设置
const Store = (() => {
  const KEY = 'bm_home_state_v1';

  const defaults = {
    settings: { autoSort: true, maxWidth: 1100, openInNewTab: true }, // openInNewTab: 点击书签是否新标签页打开
    aliases: {},        // url -> 别名
    usage: {},          // url -> { count, lastUsed }
    pinned: {},         // url -> true (星标置顶)
    collapsed: {},      // groupKey -> true(收缩)
    activeTabId: null,  // 上次选中的 tab
  };

  let cache = null;

  function deepDefault(obj) {
    return {
      settings: { ...defaults.settings, ...(obj.settings || {}) },
      aliases: { ...(obj.aliases || {}) },
      usage: { ...(obj.usage || {}) },
      pinned: { ...(obj.pinned || {}) },
      collapsed: { ...(obj.collapsed || {}) },
      activeTabId: obj.activeTabId ?? null,
    };
  }

  async function load() {
    if (cache) return cache;
    const res = await chrome.storage.local.get(KEY);
    cache = deepDefault(res[KEY] || {});
    return cache;
  }

  let writePending = false;
  let generation = 0;
  let pendingGen = 0;
  function persist() {
    generation++;
    if (!writePending) {
      writePending = true;
      pendingGen = generation;
      chrome.storage.local.set({ [KEY]: cache }, () => { if (pendingGen === generation) writePending = false; });
    } else {
      clearTimeout(persist._timer);
      pendingGen = generation;
      persist._timer = setTimeout(() => {
        if (pendingGen === generation) {
          chrome.storage.local.set({ [KEY]: cache }, () => { writePending = false; });
        }
      }, 120);
    }
  }

  return {
    load,
    get() { return cache; },

    // settings
    getSetting(k) { return cache.settings[k]; },
    setSetting(k, v) { cache.settings[k] = v; persist(); },

    // aliases
    getAlias(url) { return cache.aliases[url] || ''; },
    setAlias(url, alias) {
      if (alias && alias.trim()) cache.aliases[url] = alias.trim();
      else delete cache.aliases[url];
      persist();
    },

    // pin
    isPinned(url) { return !!cache.pinned[url]; },
    togglePin(url) {
      if (cache.pinned[url]) delete cache.pinned[url];
      else cache.pinned[url] = true;
      persist();
    },

    // usage
    getUsage(url) { return cache.usage[url] || { count: 0, lastUsed: 0 }; },
    recordHit(url) {
      const u = cache.usage[url] || { count: 0, lastUsed: 0 };
      u.count += 1;
      u.lastUsed = Date.now();
      cache.usage[url] = u;
      persist();
    },
    clearUsage() { cache.usage = {}; persist(); },

    // collapsed groups
    isCollapsed(key) { return !!cache.collapsed[key]; },
    setCollapsed(key, val) {
      if (val) cache.collapsed[key] = true;
      else delete cache.collapsed[key];
      persist();
    },

    // active tab
    getActiveTab() { return cache.activeTabId; },
    setActiveTab(id) { cache.activeTabId = id; persist(); },
  };
})();
