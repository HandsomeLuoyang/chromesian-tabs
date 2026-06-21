// search.js — 实时搜索:分档打分(精确>前缀>词首>子串>收紧子序列),命中高亮,使用频率仅做同档微调
const Search = (() => {
  // 匹配档位(越高越优先);同档内再按位置/紧凑度细分
  const TIER = { EXACT: 5000, PREFIX: 4000, WORDSTART: 3000, SUBSTR: 2000, SUBSEQ: 1000 };

  // 文本匹配:返回 { score, ranges, tier };无命中返回 null
  // allowSubseq=false 时(用于 URL)只做子串,不退化到子序列,避免长串误配
  function match(query, text, allowSubseq = true) {
    const q = query;
    const t = (text || '').toLowerCase();
    if (!q) return null;
    if (!t) return null;

    if (t === q) return { score: TIER.EXACT, ranges: [[0, q.length]], tier: TIER.EXACT };

    const idx = t.indexOf(q);
    if (idx >= 0) {
      const prevChar = idx === 0 ? '' : t[idx - 1];
      const atWordStart = idx === 0 || /[\s./\-_:?#&=]/.test(prevChar);
      let tier;
      if (idx === 0) tier = TIER.PREFIX;
      else if (atWordStart) tier = TIER.WORDSTART;
      else tier = TIER.SUBSTR;
      // 同档内:越靠前分越高
      return { score: tier + (100 - Math.min(idx, 100)), ranges: [[idx, idx + q.length]], tier };
    }

    if (!allowSubseq) return null;
    // 子序列:仅在查询较短时启用,且要求足够紧凑,否则视为不匹配
    if (q.length < 2) return null;
    let ti = 0, qi = 0, gaps = 0, firstHit = -1;
    const ranges = [];
    while (ti < t.length && qi < q.length) {
      if (t[ti] === q[qi]) {
        if (firstHit < 0) firstHit = ti;
        ranges.push([ti, ti + 1]);
        qi++;
      } else if (qi > 0) {
        gaps++;
      }
      ti++;
    }
    if (qi < q.length) return null;
    const span = ti - firstHit;            // 命中跨度
    const density = q.length / span;       // 越接近 1 越紧凑
    if (density < 0.34) return null;        // 太松散 → 判为不匹配,过滤误配
    const score = TIER.SUBSEQ + Math.round(density * 200) - Math.min(gaps, 100);
    return { score, ranges: mergeRanges(ranges), tier: TIER.SUBSEQ };
  }

  function mergeRanges(ranges) {
    if (!ranges.length) return ranges;
    const out = [ranges[0].slice()];
    for (let i = 1; i < ranges.length; i++) {
      const last = out[out.length - 1];
      if (ranges[i][0] === last[1]) last[1] = ranges[i][1];
      else out.push(ranges[i].slice());
    }
    return out;
  }

  // items: [{ id,title,url,alias,groupTitle, _lurl(小写url缓存) }]
  function run(query, items) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const now = Date.now();
    const results = [];

    for (const it of items) {
      const display = it.alias || it.title || it.url;
      // 标题/别名:取较优者作为主匹配(允许子序列)
      const mAlias = it.alias ? match(q, it.alias.toLowerCase()) : null;
      const mTitle = it.title ? match(q, it.title.toLowerCase()) : null;
      const mName = pickBest(mAlias, mTitle);
      // URL:只做子串匹配,且降一档权重(避免长 URL 抢占名称匹配)
      const mUrl = match(q, it._lurl, false);

      if (!mName && !mUrl) continue;

      // 主得分取名称匹配;若只有 URL 命中,用 URL 分但整体下调
      const nameScore = mName ? mName.score : 0;
      const urlScore = mUrl ? mUrl.score - 1500 : 0; // URL 命中整体降档
      const textScore = Math.max(nameScore, urlScore);

      // 使用频率:仅作同档内微调(0~99),不足以跨档
      const usage = Math.min(Math.round(Usage.scoreFor(it.url, now) * 8), 99);
      const total = textScore * 100 + usage;

      const matchedAlias = mName && mName === mAlias;
      results.push({
        item: it,
        display,
        total,
        titleRanges: mName ? mName.ranges : [],
        urlRanges: mUrl ? mUrl.ranges : [],
        matchedAlias,
      });
    }

    results.sort((a, z) => z.total - a.total);
    return results.slice(0, 30);
  }

  function pickBest(a, b) {
    if (a && b) return a.score >= b.score ? a : b;
    return a || b;
  }

  function highlight(text, ranges) {
    if (!ranges || !ranges.length) return escapeHtml(text);
    let out = '', pos = 0;
    for (const [s, e] of ranges) {
      out += escapeHtml(text.slice(pos, s));
      out += '<mark>' + escapeHtml(text.slice(s, e)) + '</mark>';
      pos = e;
    }
    out += escapeHtml(text.slice(pos));
    return out;
  }

  function escapeHtml(s) {
    return (s || '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  return { run, highlight, escapeHtml };
})();
