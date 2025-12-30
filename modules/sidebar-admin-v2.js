(function () {
  'use strict';

  /**
   * Admin Sidebar (v2)
   * - 菜单结构按你给的截图
   * - 支持：折叠/展开、记忆展开状态、当前项高亮、角标（例如“1”）
   * - 实用功能：搜索过滤、快速操作（刷新/复制URL/打开壳面板/编辑路由/挂载选择器）、快捷键
   * - 默认：浮动注入；可配置挂载到站点原侧边栏容器（CSS 选择器）
   */

  const NS = 'rfAdminSidebarV2';
  const KEY_ROUTE_MAP = `${NS}:routeMap`;
  const KEY_UI = `${NS}:ui`;
  const KEY_MOUNT_SEL = `${NS}:mountSelector`;

  const DEFAULT_ROUTE_MAP = {
    "仪表盘": "/",
    "账户管理/会员管理": "/account/member",
    "账户管理/VIP会员列表": "/account/vip",
    "账户管理/实名管理": "/account/kyc",
    "账户管理/银行卡管理": "/account/bankcard",

    "资金管理/资金记录": "/fund/records",
    "资金管理/贷款管理": "/fund/loan",

    "充值管理/充值记录管理": "/deposit/records",
    "提现管理/提现记录管理": "/withdraw/records",

    "股票管理/股票订单管理": "/stocks/orders",
    "大宗/库存股管理/大宗/库存股订单": "/block/orders",

    "申购管理/FPO订单": "/subscribe/fpo",
    "申购管理/IPO订单": "/subscribe/ipo",

    "客服管理/客服配置": "/support/config",
    "客服管理/聊天界面": "/support/chat",
    "客服管理/工单管理": "/support/ticket",
    "客服管理/群组管理": "/support/group",
    "客服管理/快捷语管理": "/support/quick"
  };

  const MENU = [
    { type: 'item', label: '仪表盘', icon: 'gauge' },

    { type: 'group', label: '账户管理', icon: 'user', children: [
      { label: '会员管理', key: '账户管理/会员管理' },
      { label: 'VIP会员列表', key: '账户管理/VIP会员列表' },
      { label: '实名管理', key: '账户管理/实名管理' },
      { label: '银行卡管理', key: '账户管理/银行卡管理' }
    ]},

    { type: 'group', label: '资金管理', icon: 'wallet', children: [
      { label: '资金记录', key: '资金管理/资金记录' },
      { label: '贷款管理', key: '资金管理/贷款管理' }
    ]},

    { type: 'group', label: '充值管理', icon: 'moneyIn', children: [
      { label: '充值记录管理', key: '充值管理/充值记录管理' }
    ]},

    { type: 'group', label: '提现管理', icon: 'moneyOut', badge: 1, children: [
      { label: '提现记录管理', key: '提现管理/提现记录管理', badge: 1 }
    ]},

    { type: 'group', label: '股票管理', icon: 'chart', children: [
      { label: '股票订单管理', key: '股票管理/股票订单管理' }
    ]},

    { type: 'group', label: '大宗/库存股管理', icon: 'list', children: [
      { label: '大宗/库存股订单', key: '大宗/库存股管理/大宗/库存股订单' }
    ]},

    { type: 'group', label: '申购管理', icon: 'bookmark', children: [
      { label: 'FPO订单', key: '申购管理/FPO订单' },
      { label: 'IPO订单', key: '申购管理/IPO订单' }
    ]},

    { type: 'group', label: '客服管理', icon: 'users', children: [
      { label: '客服配置', key: '客服管理/客服配置' },
      { label: '聊天界面', key: '客服管理/聊天界面' },
      { label: '工单管理', key: '客服管理/工单管理' },
      { label: '群组管理', key: '客服管理/群组管理' },
      { label: '快捷语管理', key: '客服管理/快捷语管理' }
    ]}
  ];

  function getRouteMap() {
    const saved = RF.storage.get(KEY_ROUTE_MAP, null);
    if (!saved) return { ...DEFAULT_ROUTE_MAP };
    try { return { ...DEFAULT_ROUTE_MAP, ...JSON.parse(saved) }; } catch { return { ...DEFAULT_ROUTE_MAP }; }
  }
  function setRouteMap(obj) { RF.storage.set(KEY_ROUTE_MAP, JSON.stringify(obj || {})); }

  function getUIState() {
    const saved = RF.storage.get(KEY_UI, null);
    const def = { collapsed: false, pinned: true, openGroups: { '账户管理': true }, lastActiveKey: '' };
    if (!saved) return def;
    try { return { ...def, ...JSON.parse(saved) }; } catch { return def; }
  }
  function setUIState(patch) {
    const cur = getUIState();
    RF.storage.set(KEY_UI, JSON.stringify({ ...cur, ...patch }));
  }

  function getMountSelector() { return RF.storage.get(KEY_MOUNT_SEL, '') || ''; }
  function setMountSelector(sel) { RF.storage.set(KEY_MOUNT_SEL, String(sel || '')); }

  function ensureStyle() {
    if (document.getElementById('rf-admin-sidebar-style-v2')) return;
    const css = `
#rf-admin-sidebar-v2{position:fixed;left:14px;top:50%;transform:translateY(-50%);width:256px;max-height:80vh;z-index:2147483646;border-radius:14px;overflow:hidden;box-shadow:0 18px 60px rgba(0,0,0,.22);border:1px solid rgba(0,0,0,.08);background:rgba(255,255,255,.88);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
@media (prefers-color-scheme: dark){#rf-admin-sidebar-v2{background:rgba(20,20,22,.78);border-color:rgba(255,255,255,.10);box-shadow:0 18px 60px rgba(0,0,0,.55)}}
#rf-admin-sidebar-v2 .rf-hd{display:flex;align-items:center;justify-content:space-between;padding:10px 10px;border-bottom:1px solid rgba(0,0,0,.06);background:linear-gradient(180deg, rgba(0,102,255,.10), transparent)}
@media (prefers-color-scheme: dark){#rf-admin-sidebar-v2 .rf-hd{border-bottom-color:rgba(255,255,255,.10)}}
#rf-admin-sidebar-v2 .rf-brand{display:flex;align-items:center;gap:10px;font-weight:900;color:rgba(10,10,10,.86)}
@media (prefers-color-scheme: dark){#rf-admin-sidebar-v2 .rf-brand{color:rgba(255,255,255,.92)}}
#rf-admin-sidebar-v2 .rf-pill{font-weight:900;font-size:11px;padding:4px 8px;border-radius:999px;border:1px solid rgba(0,0,0,.08);background:rgba(0,0,0,.04);color:rgba(10,10,10,.62)}
@media (prefers-color-scheme: dark){#rf-admin-sidebar-v2 .rf-pill{border-color:rgba(255,255,255,.12);background:rgba(255,255,255,.08);color:rgba(255,255,255,.65)}}
#rf-admin-sidebar-v2 .rf-actions{display:flex;gap:8px}
#rf-admin-sidebar-v2 .rf-btn{width:32px;height:32px;border-radius:10px;border:1px solid rgba(0,0,0,.08);background:rgba(255,255,255,.92);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform .16s ease, background .16s ease, opacity .16s ease;user-select:none}
#rf-admin-sidebar-v2 .rf-btn:hover{transform:translateY(-1px);background:rgba(0,0,0,.04)}
@media (prefers-color-scheme: dark){#rf-admin-sidebar-v2 .rf-btn{border-color:rgba(255,255,255,.12);background:rgba(30,30,32,.92)}#rf-admin-sidebar-v2 .rf-btn:hover{background:rgba(255,255,255,.08)}}
#rf-admin-sidebar-v2 .rf-bd{padding:10px 8px 10px;overflow:auto;max-height:calc(80vh - 52px)}
#rf-admin-sidebar-v2 .rf-search{display:flex;align-items:center;gap:8px;margin:0 2px 10px;padding:8px 10px;border-radius:12px;border:1px solid rgba(0,0,0,.08);background:rgba(255,255,255,.70)}
@media (prefers-color-scheme: dark){#rf-admin-sidebar-v2 .rf-search{border-color:rgba(255,255,255,.12);background:rgba(30,30,32,.55)}}
#rf-admin-sidebar-v2 .rf-search input{border:0;outline:none;width:100%;background:transparent;color:inherit;font-weight:800}
#rf-admin-sidebar-v2 .rf-search .hint{font-size:11px;opacity:.55;font-weight:900}
#rf-admin-sidebar-v2 .rf-item{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 10px;border-radius:10px;cursor:pointer;user-select:none;color:rgba(10,10,10,.84);transition:transform .16s ease, background .16s ease}
#rf-admin-sidebar-v2 .rf-item:hover{transform:translateY(-1px);background:rgba(0,0,0,.04)}
@media (prefers-color-scheme: dark){#rf-admin-sidebar-v2 .rf-item{color:rgba(255,255,255,.90)}#rf-admin-sidebar-v2 .rf-item:hover{background:rgba(255,255,255,.08)}}
#rf-admin-sidebar-v2 .rf-item.active{background:rgba(0,102,255,.10)}
#rf-admin-sidebar-v2 .rf-left{display:flex;align-items:center;gap:10px;min-width:0}
#rf-admin-sidebar-v2 .rf-txt{font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#rf-admin-sidebar-v2 .rf-ico{width:18px;height:18px;flex:0 0 18px;opacity:.9}
#rf-admin-sidebar-v2 .rf-arrow{width:14px;height:14px;opacity:.45;transition:transform .18s ease}
#rf-admin-sidebar-v2 .rf-item.open .rf-arrow{transform:rotate(180deg)}
#rf-admin-sidebar-v2 .rf-sub{margin:4px 0 8px 34px;border-left:2px solid rgba(0,0,0,.06);padding-left:10px;display:none;animation:rfSubIn .18s ease}
#rf-admin-sidebar-v2 .rf-item.open + .rf-sub{display:block}
@media (prefers-color-scheme: dark){#rf-admin-sidebar-v2 .rf-sub{border-left-color:rgba(255,255,255,.10)}}
#rf-admin-sidebar-v2 .rf-sub .rf-subitem{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border-radius:10px;cursor:pointer;color:rgba(10,10,10,.72);font-weight:900;transition:background .16s ease, transform .16s ease}
#rf-admin-sidebar-v2 .rf-sub .rf-subitem:hover{background:rgba(0,0,0,.04);transform:translateY(-1px)}
#rf-admin-sidebar-v2 .rf-sub .rf-subitem.active{background:rgba(0,102,255,.10);color:rgba(10,10,10,.86)}
@media (prefers-color-scheme: dark){#rf-admin-sidebar-v2 .rf-sub .rf-subitem{color:rgba(255,255,255,.70)}#rf-admin-sidebar-v2 .rf-sub .rf-subitem:hover{background:rgba(255,255,255,.08)}#rf-admin-sidebar-v2 .rf-sub .rf-subitem.active{color:rgba(255,255,255,.92)}}
#rf-admin-sidebar-v2 .rf-badge{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 6px;border-radius:999px;font-size:11px;font-weight:900;background:rgba(255,59,48,.12);color:rgba(255,59,48,.92);border:1px solid rgba(255,59,48,.20)}
@media (prefers-color-scheme: dark){#rf-admin-sidebar-v2 .rf-badge{background:rgba(255,59,48,.18);border-color:rgba(255,59,48,.25)}}
#rf-admin-sidebar-v2.rf-collapsed{width:64px}
#rf-admin-sidebar-v2.rf-collapsed .rf-txt,#rf-admin-sidebar-v2.rf-collapsed .rf-pill,#rf-admin-sidebar-v2.rf-collapsed .rf-arrow,#rf-admin-sidebar-v2.rf-collapsed .rf-sub,#rf-admin-sidebar-v2.rf-collapsed .rf-search,#rf-admin-sidebar-v2.rf-collapsed .rf-tools{display:none!important}
#rf-admin-sidebar-v2.rf-collapsed .rf-item{justify-content:center}
#rf-admin-sidebar-v2.rf-collapsed .rf-left{justify-content:center}
#rf-admin-sidebar-v2.rf-collapsed .rf-hd{justify-content:center}
#rf-admin-sidebar-v2.rf-collapsed .rf-actions{display:none}
@keyframes rfSubIn{from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:translateY(0)}}
#rf-admin-sidebar-v2 .rf-item.active::before{content:"";width:4px;height:18px;border-radius:99px;background:rgba(0,102,255,.92);display:block;margin-right:10px}
#rf-admin-sidebar-v2 .rf-item.active .rf-left{gap:6px}
#rf-admin-sidebar-v2 .rf-sub .rf-subitem.active::before{content:"";width:4px;height:14px;border-radius:99px;background:rgba(0,102,255,.92);display:block;margin-right:10px}
#rf-admin-sidebar-v2 .rf-sub .rf-subitem.active{padding-left:0}
#rf-admin-sidebar-v2 .rf-sub .rf-subitem .rf-left2{display:flex;align-items:center;gap:10px;min-width:0}
#rf-admin-sidebar-v2 .rf-tools{margin:8px 2px 0;padding:10px 10px;border-radius:12px;border:1px solid rgba(0,0,0,.08);background:rgba(255,255,255,.55)}
@media (prefers-color-scheme: dark){#rf-admin-sidebar-v2 .rf-tools{border-color:rgba(255,255,255,.12);background:rgba(30,30,32,.45)}}
#rf-admin-sidebar-v2 .rf-tools .row{display:flex;gap:8px;flex-wrap:wrap}
#rf-admin-sidebar-v2 .rf-tools .tbtn{padding:8px 10px;border-radius:12px;border:1px solid rgba(0,0,0,.08);background:rgba(255,255,255,.82);cursor:pointer;font-weight:900;font-size:12px;transition:transform .16s ease, background .16s ease}
#rf-admin-sidebar-v2 .rf-tools .tbtn:hover{transform:translateY(-1px);background:rgba(0,0,0,.04)}
@media (prefers-color-scheme: dark){#rf-admin-sidebar-v2 .rf-tools .tbtn{border-color:rgba(255,255,255,.12);background:rgba(30,30,32,.82)}#rf-admin-sidebar-v2 .rf-tools .tbtn:hover{background:rgba(255,255,255,.08)}}
`.trim();
    const style = document.createElement('style');
    style.id = 'rf-admin-sidebar-style-v2';
    style.textContent = css;
    document.documentElement.appendChild(style);
  }

  function svg(icon) {
    const icons = {
      gauge: `<svg class="rf-ico" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3a9 9 0 109 9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 12l5-3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M6.8 17.2A6 6 0 1118 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".55"/></svg>`,
      user: `<svg class="rf-ico" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 12a4 4 0 100-8 4 4 0 000 8z" stroke="currentColor" stroke-width="2"/><path d="M4 20c1.7-3.3 4.5-5 8-5s6.3 1.7 8 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
      wallet: `<svg class="rf-ico" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 7h14a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V7z" stroke="currentColor" stroke-width="2"/><path d="M4 7a2 2 0 012-2h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M16 13h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
      moneyIn: `<svg class="rf-ico" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3v12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M8 7l4-4 4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 14h14a2 2 0 012 2v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3a2 2 0 012-2z" stroke="currentColor" stroke-width="2"/></svg>`,
      moneyOut: `<svg class="rf-ico" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 21V9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M8 17l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 3h14a2 2 0 012 2v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" stroke="currentColor" stroke-width="2"/></svg>`,
      chart: `<svg class="rf-ico" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 19V5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <path d="M8 19v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <path d="M12 19V9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <path d="M16 19v-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <path d="M20 19V7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>`,
      list: `<svg class="rf-ico" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 6h13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M8 12h13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M8 18h13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>`,
      bookmark: `<svg class="rf-ico" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 4h10a2 2 0 012 2v16l-7-4-7 4V6a2 2 0 012-2z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`,
      users: `<svg class="rf-ico" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 11a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" stroke-width="2"/><path d="M8 12a4 4 0 100-8 4 4 0 000 8z" stroke="currentColor" stroke-width="2"/><path d="M2 20c1.5-2.8 4-4.2 6.5-4.2S13.5 17.2 15 20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M14 20c.7-1.6 2.1-2.7 4-3" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".7"/></svg>`,
      arrow: `<svg class="rf-arrow" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 10l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    };
    return icons[icon] || icons.gauge;
  }

  function el(tag, attrs = {}, html = '') {
    const d = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') d.className = v;
      else d.setAttribute(k, v);
    }
    if (html) d.innerHTML = html;
    return d;
  }

  function badgeHtml(n) { return n ? `<span class="rf-badge">${String(n)}</span>` : ''; }

  function navigate(route) {
    if (!route) return;
    try {
      if (/^https?:\/\//i.test(route)) location.href = route;
      else location.href = location.origin + route;
    } catch (e) { RF.utils.warn('navigate failed', e?.message || e); }
  }

  function copyText(text) {
    try { navigator.clipboard.writeText(text); return true; }
    catch {
      try {
        const ta = el('textarea', { style:'position:fixed;left:-9999px;top:-9999px;' });
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        return true;
      } catch { return false; }
    }
  }

  function mountNode() {
    const sel = getMountSelector();
    if (!sel) return null;
    try { return document.querySelector(sel); } catch { return null; }
  }

  function setActive(sidebar, key) {
    sidebar.querySelectorAll('.rf-item').forEach(n => n.classList.remove('active'));
    sidebar.querySelectorAll('.rf-subitem').forEach(n => n.classList.remove('active'));
    const a = sidebar.querySelector(`.rf-item[data-key="${CSS.escape(key)}"]`);
    if (a) a.classList.add('active');
    const b = sidebar.querySelector(`.rf-subitem[data-key="${CSS.escape(key)}"]`);
    if (b) b.classList.add('active');
    setUIState({ lastActiveKey: key });
  }

  function applySearch(sidebar, q) {
    q = String(q || '').trim().toLowerCase();
    sidebar.querySelectorAll('.rf-item[data-type="item"]').forEach(i => {
      const label = (i.getAttribute('data-label') || '').toLowerCase();
      i.style.display = (!q || label.includes(q)) ? '' : 'none';
    });

    sidebar.querySelectorAll('.rf-item[data-type="group"]').forEach(g => {
      const label = (g.getAttribute('data-label') || '').toLowerCase();
      const sub = g.nextElementSibling;
      let showGroup = !q || label.includes(q);
      let showAnySub = false;

      if (sub && sub.classList.contains('rf-sub')) {
        sub.querySelectorAll('.rf-subitem').forEach(s => {
          const t = (s.getAttribute('data-label') || '').toLowerCase();
          const show = !q || showGroup || t.includes(q);
          s.style.display = show ? '' : 'none';
          if (show) showAnySub = true;
        });
      }

      const visible = !q || showGroup || showAnySub;
      g.style.display = visible ? '' : 'none';
      if (sub) sub.style.display = (g.classList.contains('open') && visible) ? '' : 'none';
    });
  }

  function build() {
    if (document.getElementById('rf-admin-sidebar-v2')) return;
    ensureStyle();

    const ui = getUIState();
    const routeMap = getRouteMap();

    const sidebar = el('div', { id:'rf-admin-sidebar-v2' });
    if (ui.collapsed) sidebar.classList.add('rf-collapsed');

    const hd = el('div', { class:'rf-hd' });
    hd.innerHTML = `
      <div class="rf-brand">
        <span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:10px;background:rgba(0,102,255,.12);">${svg('gauge')}</span>
        <span>管理菜单</span>
        <span class="rf-pill">RF</span>
      </div>
      <div class="rf-actions">
        <button class="rf-btn" id="rf-as-pin" title="固定/取消固定">${ui.pinned ? '📌' : '📍'}</button>
        <button class="rf-btn" id="rf-as-toggle" title="折叠/展开">↔</button>
        <button class="rf-btn" id="rf-as-more" title="工具">⋯</button>
      </div>
    `;
    sidebar.appendChild(hd);

    const bd = el('div', { class:'rf-bd' });
    const search = el('div', { class:'rf-search' }, `<span style="font-weight:900;opacity:.55;">⌕</span><input type="text" placeholder="搜索菜单…" /><span class="hint">Alt+K</span>`);
    bd.appendChild(search);

    const tools = el('div', { class:'rf-tools', style:'display:none;' });
    tools.innerHTML = `
      <div class="row">
        <button class="tbtn" data-act="refresh">刷新页面</button>
        <button class="tbtn" data-act="copyurl">复制URL</button>
        <button class="tbtn" data-act="openui">打开壳面板</button>
        <button class="tbtn" data-act="route">编辑路由</button>
        <button class="tbtn" data-act="mount">挂载选择器</button>
      </div>
      <div class="row" style="margin-top:8px;">
        <button class="tbtn" data-act="expand">全部展开</button>
        <button class="tbtn" data-act="collapse">全部收起</button>
        <button class="tbtn" data-act="reset">重置默认</button>
      </div>
    `;
    bd.appendChild(tools);

    function groupNode(label, icon, badge) {
      const n = el('div', { class:'rf-item', 'data-type':'group', 'data-label':label });
      n.innerHTML = `
        <div class="rf-left">${svg(icon)}<div class="rf-txt">${label}</div></div>
        <div style="display:flex;align-items:center;gap:8px;">${badgeHtml(badge)}${svg('arrow')}</div>
      `;
      return n;
    }
    function itemNode(label, icon, badge, key) {
      const n = el('div', { class:'rf-item', 'data-type':'item', 'data-label':label, 'data-key': key || label });
      n.innerHTML = `<div class="rf-left">${svg(icon)}<div class="rf-txt">${label}</div></div><div style="display:flex;align-items:center;gap:8px;">${badgeHtml(badge)}</div>`;
      return n;
    }
    function subNode(children) {
      const s = el('div', { class:'rf-sub' });
      for (const c of children) {
        const row = el('div', { class:'rf-subitem', 'data-label':c.label, 'data-key':c.key });
        row.innerHTML = `<div class="rf-left2"><div style="width:10px;"></div><div style="min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.label}</div></div>${badgeHtml(c.badge)}`;
        row.addEventListener('click', (ev) => {
          ev.stopPropagation();
          setActive(sidebar, c.key);
          navigate(routeMap[c.key] || '');
        });
        s.appendChild(row);
      }
      return s;
    }

    for (const m of MENU) {
      if (m.type === 'item') {
        const it = itemNode(m.label, m.icon, m.badge, m.label);
        bd.appendChild(it);
        it.addEventListener('click', () => { setActive(sidebar, m.label); navigate(routeMap[m.label] || ''); });
      } else {
        const g = groupNode(m.label, m.icon, m.badge);
        const sub = subNode(m.children || []);
        bd.appendChild(g);
        bd.appendChild(sub);
        const open = !!ui.openGroups?.[m.label];
        if (open) { g.classList.add('open'); sub.style.display = ''; } else sub.style.display = 'none';

        g.addEventListener('click', () => {
          const isOpen = g.classList.toggle('open');
          sub.style.display = isOpen ? '' : 'none';
          const cur = getUIState();
          const next = { ...(cur.openGroups || {}) };
          next[m.label] = isOpen;
          setUIState({ openGroups: next });
        });
      }
    }

    const input = search.querySelector('input');
    input.addEventListener('input', () => applySearch(sidebar, input.value));

    hd.querySelector('#rf-as-more').addEventListener('click', () => {
      tools.style.display = (tools.style.display === 'none') ? '' : 'none';
    });

    tools.querySelectorAll('button[data-act]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const act = btn.getAttribute('data-act');
        if (act === 'refresh') location.reload();
        if (act === 'copyurl') alert(copyText(location.href) ? '已复制 URL' : '复制失败');
        if (act === 'openui') RF.shell?.open?.();
        if (act === 'route') {
          const cur = getRouteMap();
          const txt = JSON.stringify(cur, null, 2);
          const next = prompt('编辑路由映射（JSON）\n键=“组/子项” 或 “仪表盘”\n值=path 或 URL', txt);
          if (!next) return;
          try { setRouteMap(JSON.parse(next)); alert('已保存，刷新后生效'); } catch { alert('JSON 不合法'); }
        }
        if (act === 'mount') {
          const cur = getMountSelector() || '';
          const next = prompt('挂载到站点侧边栏容器（CSS 选择器）\n留空=浮动注入', cur);
          if (next === null) return;
          setMountSelector(next.trim());
          alert('已保存，刷新后生效');
        }
        if (act === 'expand') {
          const cur = getUIState();
          const og = { ...(cur.openGroups || {}) };
          MENU.filter(x => x.type === 'group').forEach(x => og[x.label] = true);
          setUIState({ openGroups: og });
          alert('已展开，刷新后生效');
        }
        if (act === 'collapse') {
          const cur = getUIState();
          const og = { ...(cur.openGroups || {}) };
          MENU.filter(x => x.type === 'group').forEach(x => og[x.label] = false);
          setUIState({ openGroups: og });
          alert('已收起，刷新后生效');
        }
        if (act === 'reset') {
          if (!confirm('重置路由与UI状态？')) return;
          RF.storage.del(KEY_ROUTE_MAP);
          RF.storage.del(KEY_UI);
          RF.storage.del(KEY_MOUNT_SEL);
          alert('已重置，刷新后生效');
        }
      });
    });

    hd.querySelector('#rf-as-toggle').addEventListener('click', () => {
      const isCollapsed = sidebar.classList.toggle('rf-collapsed');
      setUIState({ collapsed: isCollapsed });
    });
    hd.querySelector('#rf-as-pin').addEventListener('click', () => {
      const cur = getUIState();
      const next = !cur.pinned;
      setUIState({ pinned: next });
      hd.querySelector('#rf-as-pin').textContent = next ? '📌' : '📍';
      alert(next ? '已固定' : '已取消固定（点击空白可关闭）');
    });

    const last = ui.lastActiveKey || '仪表盘';
    setActive(sidebar, last);

    sidebar.appendChild(bd);

    const mount = mountNode();
    if (mount) {
      sidebar.style.position = 'relative';
      sidebar.style.left = '0';
      sidebar.style.top = '0';
      sidebar.style.transform = 'none';
      sidebar.style.maxHeight = 'unset';
      sidebar.style.width = '100%';
      mount.innerHTML = '';
      mount.appendChild(sidebar);
    } else {
      document.documentElement.appendChild(sidebar);
      document.addEventListener('click', (ev) => {
        const cur = getUIState();
        if (cur.pinned) return;
        if (!sidebar.contains(ev.target)) sidebar.remove();
      }, { capture:true, passive:true });
    }

    window.addEventListener('keydown', (e) => {
      if (e.altKey && e.key.toLowerCase() === 'm') { e.preventDefault(); sidebar.classList.toggle('rf-collapsed'); }
      if (e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); input?.focus?.(); }
    }, { passive:false });
  }

  const t = setInterval(() => {
    if (document.documentElement) { clearInterval(t); build(); }
  }, 30);
})();
