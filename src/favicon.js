// favicon.js — 图标获取:优先 Chrome MV3 _favicon API,失败兜底为首字母彩色块
const Favicon = (() => {
  // 用扩展自身的 _favicon 端点(需 manifest 声明 "favicon" 权限)
  function chromeFaviconUrl(pageUrl, size = 32) {
    const u = new URL(chrome.runtime.getURL('/_favicon/'));
    u.searchParams.set('pageUrl', pageUrl);
    u.searchParams.set('size', String(size));
    return u.toString();
  }

  const PALETTE = [
    '#ef6c75', '#f0883e', '#e0a800', '#3fb950', '#2ea7c8',
    '#3b6cf6', '#7c5cff', '#c264d4', '#e06292', '#5c8a72',
  ];

  function colorFor(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return PALETTE[h % PALETTE.length];
  }

  function letterFor(title, url) {
    const t = (title || '').trim();
    if (t) return t[0];
    try { return new URL(url).hostname.replace(/^www\./, '')[0] || '?'; }
    catch { return '?'; }
  }

  // 记住哪些 URL 取图标失败过,后续直接渲染兜底块,免得每次按键都重发请求 + 闪一下
  const failed = new Set();

  function fallbackNode(url, title, size) {
    const fb = document.createElement('div');
    fb.className = 'card-favicon card-fallback';
    fb.style.width = size + 'px';
    fb.style.height = size + 'px';
    fb.style.background = colorFor(url || title || '?');
    fb.textContent = letterFor(title, url);
    return fb;
  }

  // 创建图标节点:已知失败的直接给兜底块;否则放 chrome favicon img,onerror 时替换
  function create(url, title, size = 28) {
    if (failed.has(url)) return fallbackNode(url, title, size);

    const img = document.createElement('img');
    img.className = 'card-favicon';
    img.width = size;
    img.height = size;
    img.loading = 'lazy';
    img.alt = '';
    img.src = chromeFaviconUrl(url, Math.max(size, 32));

    img.addEventListener('error', () => {
      failed.add(url);
      img.replaceWith(fallbackNode(url, title, size));
    }, { once: true });

    return img;
  }

  return { create };
})();
