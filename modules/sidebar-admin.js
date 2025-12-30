(function () {
  'use strict';

  // 仅示例：当页面本身已有侧边栏时，你可以改为“增强/补齐菜单”，而不是覆盖。
  // 默认：注入一个浮动侧边栏（可折叠），风格参考你给的截图。

  const CFG_KEY = 'sidebarAdmin:routeMap';

  const DEFAULT_ROUTE_MAP = {
    "仪表盘": "/",
    "账户管理": "/account",
    "资金管理": "/fund",
    "充值管理": "/deposit",
    "提现管理": "/withdraw",
    "股票管理": "/stocks",
    "大宗/库存股管理": "/block",
    "申购管理": "/subscribe",
    "客服管理": "/support"
  };

  function getRouteMap() {
    const saved = RF.storage.get(CFG_KEY, null);
    if (!saved) return { ...DEFAULT_ROUTE_MAP };
    try {
      const obj = JSON.parse(saved);
      return { ...DEFAULT_ROUTE_MAP, ...obj };
    } catch {
      return { ...DEFAULT_ROUTE_MAP };
    }
  }

  function ensureStyle() {
    if (document.getElementById('rf-admin-sidebar-style')) return;
    const css = `
#rf-admin-sidebar{
  position: fixed;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  width: 240px;
  max-height: 76vh;
  z-index: 2147483646;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 18px 60px rgba(0,0,0,.22);
  border: 1px solid rgba(0,0,0,.08);
  background: rgba(255,255,255,.86);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  font-family: -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
}
@media (prefers-color-scheme: dark){
  #rf-admin-sidebar{
    background: rgba(20,20,22,.78);
    border-color: rgba(255,255,255,.10);
    box-shadow: 0 18px 60px rgba(0,0,0,.55);
  }
}
#rf-admin-sidebar .rf-hd{
  display:flex; align-items:center; justify-content:space-between;
  padding: 10px 10px;
  border-bottom: 1px solid rgba(0,0,0,.06);
  background: linear-gradient(180deg, rgba(0,102,255,.10), transparent);
}
@media (prefers-color-scheme: dark){
  #rf-admin-sidebar .rf-hd{ border-bottom-color: rgba(255,255,255,.10); }
}
#rf-admin-sidebar .rf-brand{
  display:flex; align-items:center; gap:10px;
  font-weight: 900;
  color: rgba(10,10,10,.86);
}
@media (prefers-color-scheme: dark){
  #rf-admin-sidebar .rf-brand{ color: rgba(255,255,255,.92); }
}
#rf-admin-sidebar .rf-pill{
  font-weight: 900;
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid rgba(0,0,0,.08);
  background: rgba(0,0,0,.04);
  color: rgba(10,10,10,.62);
}
@media (prefers-color-scheme: dark){
  #rf-admin-sidebar .rf-pill{
    border-color: rgba(255,255,255,.12);
    background: rgba(255,255,255,.08);
    color: rgba(255,255,255,.65);
  }
}

#rf-admin-sidebar .rf-actions{ display:flex; gap:8px; }
#rf-admin-sidebar .rf-btn{
  width: 32px; height: 32px;
  border-radius: 10px;
  border: 1px solid rgba(0,0,0,.08);
  background: rgba(255,255,255,.9);
  cursor:pointer;
  display:flex; align-items:center; justify-content:center;
  transition: transform .16s ease, background .16s ease;
}
#rf-admin-sidebar .rf-btn:hover{ transform: translateY(-1px); background: rgba(0,0,0,.04); }
@media (prefers-color-scheme: dark){
  #rf-admin-sidebar .rf-btn{
    border-color: rgba(255,255,255,.12);
    background: rgba(30,30,32,.92);
  }
  #rf-admin-sidebar .rf-btn:hover{ background: rgba(255,255,255,.08); }
}

#rf-admin-sidebar .rf-bd{
  padding: 8px;
  overflow: auto;
  max-height: calc(76vh - 54px);
}

#rf-admin-sidebar .rf-item{
  display:flex; align-items:center; justify-content:space-between;
  gap:10px;
  padding: 10px 10px;
  border-radius: 10px;
  cursor:pointer;
  user-select:none;
  color: rgba(10,10,10,.84);
  transition: transform .16s ease, background .16s ease;
}
#rf-admin-sidebar .rf-item:hover{
  transform: translateY(-1px);
  background: rgba(0,0,0,.04);
}
@media (prefers-color-scheme: dark){
  #rf-admin-sidebar .rf-item{ color: rgba(255,255,255,.90); }
  #rf-admin-sidebar .rf-item:hover{ background: rgba(255,255,255,.08); }
}
#rf-admin-sidebar .rf-item.active{
  background: rgba(0,102,255,.12);
}
#rf-admin-sidebar .rf-left{
  display:flex; align-items:center; gap:10px;
  min-width: 0;
}
#rf-admin-sidebar .rf-txt{
  font-weight: 900;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
#rf-admin-sidebar .rf-ico{
  width: 18px; height: 18px; flex: 0 0 18px;
  opacity: .9;
}
#rf-admin-sidebar .rf-arrow{
  width: 14px; height: 14px;
  opacity: .45;
  transition: transform .18s ease;
}
#rf-admin-sidebar .rf-item.open .rf-arrow{ transform: rotate(180deg); }

#rf-admin-sidebar .rf-sub{
  margin: 4px 0 8px 34px;
  border-left: 2px solid rgba(0,0,0,.06);
  padding-left: 10px;
  display:none;
  animation: rfSubIn .18s ease;
}
#rf-admin-sidebar .rf-item.open + .rf-sub{ display:block; }
@media (prefers-color-scheme: dark){
  #rf-admin-sidebar .rf-sub{ border-left-color: rgba(255,255,255,.10); }
}

#rf-admin-sidebar .rf-sub .rf-subitem{
  padding: 8px 10px;
  border-radius: 10px;
  cursor:pointer;
  color: rgba(10,10,10,.70);
  font-weight: 800;
  transition: background .16s ease, transform .16s ease;
}
#rf-admin-sidebar .rf-sub .rf-subitem:hover{
  background: rgba(0,0,0,.04);
  transform: translateY(-1px);
}
@media (prefers-color-scheme: dark){
  #rf-admin-sidebar .rf-sub .rf-subitem{ color: rgba(255,255,255,.70); }
  #rf-admin-sidebar .rf-sub .rf-subitem:hover{ background: rgba(255,255,255,.08); }
}

#rf-admin-sidebar.rf-collapsed{
  width: 64px;
}
#rf-admin-sidebar.rf-collapsed .rf-txt,
#rf-admin-sidebar.rf-collapsed .rf-pill,
#rf-admin-sidebar.rf-collapsed .rf-arrow,
#rf-admin-sidebar.rf-collapsed .rf-sub{
  display:none !important;
}
#rf-admin-sidebar.rf-collapsed .rf-item{
  justify-content:center;
}
#rf-admin-sidebar.rf-collapsed .rf-left{ justify-content:center; }
#rf-admin-sidebar.rf-collapsed .rf-hd{ justify-content:center; }
#rf-admin-sidebar.rf-collapsed .rf-actions{ display:none; }

@keyframes rfSubIn{
  from{ opacity: 0; transform: translateY(-3px); }
  to{ opacity: 1; transform: translateY(0); }
}

/* 轻微的“蓝色高亮条”，更贴近截图 */
#rf-admin-sidebar .rf-item.active::before{
  content:"";
  width: 4px;
  height: 18px;
  border-radius: 99px;
  background: rgba(0,102,255,.90);
  display:block;
  margin-right: 10px;
}
#rf-admin-sidebar .rf-item.active .rf-left{ gap: 6px; }
#rf-admin-sidebar .rf-item.active{ background: rgba(0,102,255,.10); }
    `.trim();

    const style = document.createElement('style');
    style.id = 'rf-admin-sidebar-style';
    style.textContent = css;
    document.documentElement.appendChild(style);
  }

  function svg(icon) {
    // 简单内置图标（无需外链）
    const icons = {
      gauge: `<svg class="rf-ico" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 3a9 9 0 109 9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <path d="M12 12l5-3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <path d="M6.8 17.2A6 6 0 1118 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".55"/>
      </svg>`,
      user: `<svg class="rf-ico" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 12a4 4 0 100-8 4 4 0 000 8z" stroke="currentColor" stroke-width="2"/>
        <path d="M4 20c1.7-3.3 4.5-5 8-5s6.3 1.7 8 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>`,
      wallet: `<svg class="rf-ico" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 7h14a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V7z" stroke="currentColor" stroke-width="2"/>
        <path d="M4 7a2 2 0 012-2h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <path d="M16 13h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>`,
      arrow: `<svg class="rf-arrow" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M7 10l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
      moneyIn: `<svg class="rf-ico" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 3v12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <path d="M8 7l4-4 4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M5 14h14a2 2 0 012 2v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3a2 2 0 012-2z" stroke="currentColor" stroke-width="2"/>
      </svg>`,
      moneyOut: `<svg class="rf-ico" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 21V9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <path d="M8 17l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M5 3h14a2 2 0 012 2v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" stroke="currentColor" stroke-width="2"/>
      </svg>`,
      chart: `<svg class="rf-ico" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 19V5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <path d="M8 19v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <path d="M12 19V9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <path d="M16 19v-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <path d="M20 19V7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>`,
      box: `<svg class="rf-ico" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M21 8l-9-5-9 5 9 5 9-5z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
        <path d="M3 8v8l9 5 9-5V8" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
        <path d="M12 13v8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>`,
      plus: `<svg class="rf-ico" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 5v14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <path d="M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>`,
      headset: `<svg class="rf-ico" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 12a8 8 0 0116 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <path d="M4 12v5a2 2 0 002 2h1v-7H6a2 2 0 00-2 2z" stroke="currentColor" stroke-width="2"/>
        <path d="M20 12v5a2 2 0 01-2 2h-1v-7h1a2 2 0 012 2z" stroke="currentColor" stroke-width="2"/>
      </svg>`,
      gear: `<svg class="rf-ico" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" stroke-width="2"/>
        <path d="M19.4 15a7.9 7.9 0 000-6l-2 1a6 6 0 01-1.3-1.3l1-2a7.9 7.9 0 00-6 0l1 2A6 6 0 019 9.7l-2-1a7.9 7.9 0 000 6l2-1A6 6 0 019 14.3l-1 2a7.9 7.9 0 006 0l-1-2a6 6 0 011.3-1.3l2 1z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" opacity=".7"/>
      </svg>`
    };
    return icons[icon] || icons.gauge;
  }

  function createItem(label, icon, hasSub = false) {
    const item = document.createElement('div');
    item.className = 'rf-item';
    item.setAttribute('data-label', label);
    item.innerHTML = `
      <div class="rf-left">
        ${svg(icon)}
        <div class="rf-txt">${label}</div>
      </div>
      ${hasSub ? svg('arrow') : `<span style="width:14px;height:14px;opacity:.0;"></span>`}
    `;
    return item;
  }

  function createSub(items) {
    const sub = document.createElement('div');
    sub.className = 'rf-sub';
    for (const it of items) {
      const el = document.createElement('div');
      el.className = 'rf-subitem';
      el.textContent = it.label;
      el.addEventListener('click', () => {
        it.onClick?.();
      });
      sub.appendChild(el);
    }
    return sub;
  }

  function markActive(sidebar, label) {
    sidebar.querySelectorAll('.rf-item').forEach(i => {
      i.classList.toggle('active', i.getAttribute('data-label') === label);
    });
  }

  function navigate(route) {
    // 你可以改成你站点的路由方式（hash/history/router）
    // 这里默认采用：如果 route 是完整 URL 就直接跳转，否则拼接到 origin
    if (!route) return;
    try {
      if (/^https?:\/\//i.test(route)) {
        location.href = route;
      } else {
        // 保留当前 origin，直接跳 path（适配多数后台）
        location.href = location.origin + route;
      }
    } catch (e) {
      RF.utils.warn('navigate failed', e?.message || e);
    }
  }

  function mount() {
    if (document.getElementById('rf-admin-sidebar')) return;

    ensureStyle();

    const sidebar = document.createElement('div');
    sidebar.id = 'rf-admin-sidebar';

    const hd = document.createElement('div');
    hd.className = 'rf-hd';
    hd.innerHTML = `
      <div class="rf-brand">
        <span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:10px;background:rgba(0,102,255,.12);">${svg('gauge')}</span>
        <span>管理菜单</span>
        <span class="rf-pill">RF</span>
      </div>
      <div class="rf-actions">
        <button class="rf-btn" id="rf-as-toggle" title="折叠/展开">↔</button>
        <button class="rf-btn" id="rf-as-config" title="配置路由">⚙</button>
      </div>
    `;
    sidebar.appendChild(hd);

    const bd = document.createElement('div');
    bd.className = 'rf-bd';
    sidebar.appendChild(bd);

    const routeMap = getRouteMap();

    // 菜单（参考截图）
    const items = [
      { label: "仪表盘", icon: "gauge" },
      { label: "账户管理", icon: "user", sub: ["账户列表", "KYC/实名", "角色权限"] },
      { label: "资金管理", icon: "wallet", sub: ["资金流水", "对账", "风控阈值"] },
      { label: "充值管理", icon: "moneyIn", sub: ["充值订单", "通道配置", "异常处理"] },
      { label: "提现管理", icon: "moneyOut", sub: ["提现审核", "批量处理", "风控拦截"] },
      { label: "股票管理", icon: "chart", sub: ["股票列表", "行情源", "交易时段"] },
      { label: "大宗/库存股管理", icon: "box", sub: ["库存列表", "大宗订单", "折扣配置"] },
      { label: "申购管理", icon: "plus", sub: ["申购列表", "配售规则", "结果公告"] },
      { label: "客服管理", icon: "headset", sub: ["工单列表", "快捷回复", "客服排班"] },
    ];

    for (const it of items) {
      const hasSub = Array.isArray(it.sub) && it.sub.length > 0;
      const el = createItem(it.label, it.icon, hasSub);
      bd.appendChild(el);

      if (hasSub) {
        const sub = createSub(it.sub.map(s => ({
          label: s,
          onClick: () => {
            markActive(sidebar, it.label);
            // 子项默认走主项路由，也可自行分配 routeMap 子路由
            navigate(routeMap[it.label]);
          }
        })));
        bd.appendChild(sub);
      }

      el.addEventListener('click', () => {
        if (hasSub) {
          el.classList.toggle('open');
          markActive(sidebar, it.label);
          return;
        }
        markActive(sidebar, it.label);
        navigate(routeMap[it.label]);
      });
    }

    // 默认激活：仪表盘
    markActive(sidebar, '仪表盘');

    // 折叠
    hd.querySelector('#rf-as-toggle').addEventListener('click', () => {
      sidebar.classList.toggle('rf-collapsed');
    });

    // 路由配置：用 prompt 简化（你也可以换成更高级的弹窗 UI）
    hd.querySelector('#rf-as-config').addEventListener('click', () => {
      const cur = getRouteMap();
      const txt = JSON.stringify(cur, null, 2);
      const next = prompt('编辑路由映射（JSON）\n键=菜单名，值=path 或 URL', txt);
      if (!next) return;
      try {
        const obj = JSON.parse(next);
        RF.storage.set(CFG_KEY, JSON.stringify(obj));
        alert('已保存，刷新页面后生效');
      } catch {
        alert('JSON 不合法');
      }
    });

    document.documentElement.appendChild(sidebar);
  }

  // 等 DOM 可用再挂载
  const t = setInterval(() => {
    if (document.documentElement) {
      clearInterval(t);
      mount();
    }
  }, 30);
})();
