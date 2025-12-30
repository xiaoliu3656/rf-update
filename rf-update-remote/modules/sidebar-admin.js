(function () {
  'use strict';

  // 这里的逻辑已修改为：注册一个 Shell Tab，而不是创建独立的侧边栏 DOM。
  // 从而实现“合并 UI”且“使用壳布局”。

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
    if (document.getElementById('rf-admin-tab-style')) return;
    // 复用壳的 CSS 变量 (--rf-text, --rf-bg 等)
    const css = `
      .rf-admin-menu .rf-item {
        display: flex; align-items: center; justify-content: space-between;
        padding: 10px; margin-bottom: 4px;
        border-radius: 10px; cursor: pointer;
        color: var(--rf-text);
        transition: background .16s ease;
        user-select: none;
      }
      .rf-admin-menu .rf-item:hover { background: var(--rf-chip); }
      .rf-admin-menu .rf-item.active { background: rgba(0,102,255,.12); color: #0066ff; }
      
      .rf-admin-menu .rf-left { display: flex; align-items: center; gap: 10px; }
      .rf-admin-menu .rf-ico { width: 18px; height: 18px; opacity: 0.8; }
      .rf-admin-menu .rf-arrow { width: 14px; height: 14px; opacity: 0.5; transition: transform .2s; }
      .rf-admin-menu .rf-item.open .rf-arrow { transform: rotate(180deg); }

      .rf-admin-menu .rf-sub { 
        margin-left: 38px; padding-left: 10px; border-left: 2px solid var(--rf-line);
        display: none; margin-bottom: 8px;
        animation: rfSubIn .18s ease;
      }
      .rf-admin-menu .rf-item.open + .rf-sub { display: block; }
      .rf-admin-menu .rf-subitem {
        padding: 8px 10px; border-radius: 8px; cursor: pointer;
        color: var(--rf-sub); font-size: 0.95em; font-weight: 700;
        transition: color .16s ease, background .16s ease;
      }
      .rf-admin-menu .rf-subitem:hover { background: var(--rf-chip); color: var(--rf-text); }
      
      @keyframes rfSubIn{ from{ opacity:0; transform:translateY(-3px); } to{ opacity:1; transform:translateY(0); } }
    `;
    const style = document.createElement('style');
    style.id = 'rf-admin-tab-style';
    style.textContent = css;
    document.documentElement.appendChild(style);
  }

  function svg(icon) {
    const icons = {
      gauge: `<svg class="rf-ico" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3a9 9 0 109 9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 12l5-3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M6.8 17.2A6 6 0 1118 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".55"/></svg>`,
      user: `<svg class="rf-ico" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 12a4 4 0 100-8 4 4 0 000 8z" stroke="currentColor" stroke-width="2"/><path d="M4 20c1.7-3.3 4.5-5 8-5s6.3 1.7 8 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
      wallet: `<svg class="rf-ico" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 7h14a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V7z" stroke="currentColor" stroke-width="2"/><path d="M4 7a2 2 0 012-2h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M16 13h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
      arrow: `<svg class="rf-arrow" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 10l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      moneyIn: `<svg class="rf-ico" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3v12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M8 7l4-4 4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 14h14a2 2 0 012 2v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3a2 2 0 012-2z" stroke="currentColor" stroke-width="2"/></svg>`,
      moneyOut: `<svg class="rf-ico" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 21V9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M8 17l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 3h14a2 2 0 012 2v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" stroke="currentColor" stroke-width="2"/></svg>`,
      chart: `<svg class="rf-ico" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 19V5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M8 19v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 19V9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M16 19v-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M20 19V7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
      box: `<svg class="rf-ico" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 8l-9-5-9 5 9 5 9-5z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M3 8v8l9 5 9-5V8" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 13v8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
      plus: `<svg class="rf-ico" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 5v14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
      headset: `<svg class="rf-ico" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 12a8 8 0 0116 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M4 12v5a2 2 0 002 2h1v-7H6a2 2 0 00-2 2z" stroke="currentColor" stroke-width="2"/><path d="M20 12v5a2 2 0 01-2 2h-1v-7h1a2 2 0 012 2z" stroke="currentColor" stroke-width="2"/></svg>`,
    };
    return icons[icon] || icons.gauge;
  }

  function navigate(route) {
    if (!route) return;
    try {
      if (/^https?:\/\//i.test(route)) {
        location.href = route;
      } else {
        location.href = location.origin + route;
      }
    } catch (e) {
      RF.utils.warn('navigate failed', e?.message || e);
    }
  }

  function renderAdminTab(container) {
    ensureStyle();
    
    // 使用壳的 rf-card 样式
    container.innerHTML = `
      <div class="rf-card rf-admin-menu">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--rf-line);">
          <div style="font-weight:900;color:var(--rf-sub);font-size:12px;">快捷导航</div>
          <button class="rf-btn" id="rf-adm-cfg" style="padding:4px 10px;font-size:12px;border-radius:8px;">⚙ 配置路由</button>
        </div>
        <div id="rf-adm-list"></div>
      </div>
    `;

    const list = container.querySelector('#rf-adm-list');
    const routeMap = getRouteMap();

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

    items.forEach(it => {
      const hasSub = Array.isArray(it.sub) && it.sub.length > 0;
      const el = document.createElement('div');
      el.className = 'rf-item';
      el.innerHTML = `
        <div class="rf-left">
          ${svg(it.icon)}
          <div class="rf-txt" style="font-weight:700;">${it.label}</div>
        </div>
        ${hasSub ? svg('arrow') : ''}
      `;
      list.appendChild(el);

      if (hasSub) {
        const sub = document.createElement('div');
        sub.className = 'rf-sub';
        it.sub.forEach(sLabel => {
          const sEl = document.createElement('div');
          sEl.className = 'rf-subitem';
          sEl.textContent = sLabel;
          sEl.addEventListener('click', (e) => {
            e.stopPropagation();
            navigate(routeMap[sLabel] || routeMap[it.label]); // 简单的回退策略
          });
          sub.appendChild(sEl);
        });
        list.appendChild(sub);
        
        el.addEventListener('click', () => {
          el.classList.toggle('open');
        });
      } else {
        el.addEventListener('click', () => {
          navigate(routeMap[it.label]);
        });
      }
    });

    container.querySelector('#rf-adm-cfg').addEventListener('click', () => {
      const cur = getRouteMap();
      const txt = JSON.stringify(cur, null, 2);
      // 使用 prompt 简单交互，或者可以调用 RF.shell.open('config') 但这里是特定配置
      const next = prompt('编辑路由映射（JSON）\n键=菜单名，值=path 或 URL', txt);
      if (!next) return;
      try {
        const obj = JSON.parse(next);
        RF.storage.set(CFG_KEY, JSON.stringify(obj));
        RF.shell.notify('RF', '路由配置已保存，请重新打开面板');
      } catch {
        alert('JSON 不合法');
      }
    });
  }

  // 核心改动：注册 Tab
  if (RF.shell && RF.shell.addTab) {
    RF.shell.addTab('admin', '管理菜单', renderAdminTab);
    RF.utils.log('Admin tab registered');
  } else {
    RF.utils.warn('RF Shell version too old, cannot register admin tab');
  }

})();
