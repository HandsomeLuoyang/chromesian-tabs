// bookmarks.js — 读取 chrome.bookmarks,构建「顶层文件夹 → tab」数据结构
const Bookmarks = (() => {
  // 把书签树整理成 tabs: [{ id, title, bookmarks:[{id,title,url}], groups:[{key,title,bookmarks}] }]
  // 规则:书签栏 / 其他书签下的每个文件夹 = 一个 tab;
  //       tab 直属书签放入默认分组,子文件夹各成一个分组。
  function buildTabs(tree) {
    const roots = [];
    // tree[0].children 通常是 [书签栏, 其他书签, 移动设备书签...]
    (tree[0]?.children || []).forEach(rootFolder => {
      (rootFolder.children || []).forEach(node => {
        if (isFolder(node)) roots.push(node);
      });
      // 根容器直属的散装书签,归到一个「书签栏」式的 tab
      const looseBks = (rootFolder.children || []).filter(n => !isFolder(n) && n.url);
      if (looseBks.length) {
        roots.push({ id: 'loose-' + rootFolder.id, title: rootFolder.title || '书签', children: looseBks });
      }
    });

    const tabs = roots
      .map(folder => folderToTab(folder))
      .filter(tab => tab.count > 0);

    // 书签散落在多个文件夹时,前置一个「全部」总览 tab:
    // 每个文件夹作为一个分组小标题铺开,一眼看全,且各组仍可收缩。
    if (tabs.length > 1) {
      const all = {
        id: '__all__',
        title: '全部',
        isAll: true,                       // 标记:固定排首、不参与使用频率重排
        groups: tabs.map(t => ({ key: 'all-' + t.id, title: t.title, bookmarks: t.bookmarks })),
        bookmarks: tabs.flatMap(t => t.bookmarks),
        count: tabs.reduce((n, t) => n + t.count, 0),
      };
      return [all, ...tabs];
    }
    return tabs;
  }

  function isFolder(node) { return !node.url && Array.isArray(node.children); }

  function folderToTab(folder) {
    const directBks = [];
    const groups = [];

    (folder.children || []).forEach(child => {
      if (isFolder(child)) {
        const bks = collectBookmarks(child);
        if (bks.length) {
          groups.push({ key: 'g-' + child.id, title: child.title, bookmarks: bks });
        }
      } else if (child.url) {
        directBks.push({ id: child.id, title: child.title, url: child.url });
      }
    });

    const allGroups = [];
    if (directBks.length) allGroups.unshift({ key: 'g-direct-' + folder.id, title: '', bookmarks: directBks });
    allGroups.push(...groups);

    const flat = allGroups.flatMap(g => g.bookmarks);
    return {
      id: String(folder.id),
      title: folder.title || '未命名',
      groups: allGroups,
      bookmarks: flat,
      count: flat.length,
    };
  }

  // 递归收集一个文件夹下所有书签(子文件夹平铺)
  function collectBookmarks(folder) {
    const out = [];
    (folder.children || []).forEach(child => {
      if (isFolder(child)) out.push(...collectBookmarks(child));
      else if (child.url) out.push({ id: child.id, title: child.title, url: child.url });
    });
    return out;
  }

  async function getTabs() {
    const tree = await chrome.bookmarks.getTree();
    return buildTabs(tree);
  }

  // 监听书签变动,触发回调重建
  function onChange(cb) {
    const fns = ['onCreated', 'onChanged', 'onRemoved', 'onMoved', 'onChildrenReordered'];
    let timer = null;
    const handler = () => { clearTimeout(timer); timer = setTimeout(cb, 200); };
    fns.forEach(ev => chrome.bookmarks[ev]?.addListener(handler));
  }

  // 平铺所有文件夹(供新增书签时选目标),返回 [{id, title}]
  function getFolderList(tree) {
    const out = [];
    function walk(node, depth) {
      if (!node.url && node.children) {
        if (depth > 0) out.push({ id: node.id, title: node.title || '未命名' });
        node.children.forEach(c => walk(c, depth + 1));
      }
    }
    walk(tree[0], 0);
    return out;
  }

  return { getTabs, onChange, getFolderList };
})();
