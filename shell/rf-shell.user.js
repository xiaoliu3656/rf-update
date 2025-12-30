// ==UserScript==
// @name         RF Remote Bootstrap (Shell)
// @namespace    https://example.com/
// @version      1.5.3
// @description  Remote bootstrap shell: pulls manifest/modules/about/changelog from GitHub Raw or server. Public template.
// @author       You
// @match        https://admin-mx10.pfinprime.com/*
// @run-at       document-start
// @updateURL    https://raw.githubusercontent.com/xiaoliu3656/rf-update/main/shell/rf-shell.user.js
// @downloadURL  https://raw.githubusercontent.com/xiaoliu3656/rf-update/main/shell/rf-shell.user.js
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
// @connect      raw.githubusercontent.com
// @connect      github.com
// @connect      *
// ==/UserScript==

(() => {
  'use strict';

  /******************************************************************
   * 你要改这里：远程根路径 base（仓库/服务器目录）
   * - 你给的 changelog 链接是 refs/heads/main 形式，这里同时放两个 base：
   ******************************************************************/
  const REMOTE_BASES = [
    'https://raw.githubusercontent.com/xiaoliu3656/rf-update/main',
    'https://raw.githubusercontent.com/xiaoliu3656/rf-update/refs/heads/main'
  ];

  const BOOTSTRAP_VERSION = '1.5.3';
  const STORAGE_NS = 'RF_BOOTSTRAP';

  const KEY_CFG = `${STORAGE_NS}:cfg`;
  const KEY_LAST_CHECK = `${STORAGE_NS}:lastCheckAt`;
  const KEY_LAST_BASE = `${STORAGE_NS}:lastBase`;
  const KEY_MANIFEST = `${STORAGE_NS}:manifest`;
  const KEY_CACHE_PREFIX = `${STORAGE_NS}:cache:`;
  const KEY_LOG = `${STORAGE_NS}:log`;
  const KEY_LAST_ERR = `${STORAGE_NS}:lastErr`;

  const KEY_CHANGELOG = `${STORAGE_NS}:changelog`;
  const KEY_ABOUT = `${STORAGE_NS}:about`;

  const DEFAULT_CFG = {
    enabled: true,
    autoUpdate: true,
    checkIntervalHours: 6,
    strictVerify: false,
    safeMode: false,
    debug: false,
    onlyWhitelist: true,
    whitelist: ['admin-mx10.pfinprime.com'],
    showFloatButton: true,
    defaultTab: 'status',
    reduceMotion: false,
    neonGlow: true,
    neonIntensity: 0.85,
    neonSpeed: 1.0,
    neonFollowCursor: true,
    neonSparkles: true,
    neonGlassNoise: true,
    disabledModules: {},
  };

  const FALLBACK_ABOUT = {
    name: 'RF Remote Framework',
    channel: 'stable',
    desc: '壳脚本本地缺少 about.json 时显示的填充数据。',
    home: 'https://example.com',
    contact: 'support@example.com',
    license: 'MIT',
    tips: ['打开壳面板 → 状态 → 立即检查更新']
  };

  const FALLBACK_CHANGELOG = [
    { at: new Date().toISOString(), version: BOOTSTRAP_VERSION, title: '本地填充', items: ['未拉到远程 changelog.json 时展示'], source: 'local' }
  ];

  const now = () => Date.now();

  function cfg() {
    const saved = GM_getValue(KEY_CFG, null);
    if (!saved) return { ...DEFAULT_CFG };
    try { return { ...DEFAULT_CFG, ...JSON.parse(saved) }; } catch { return { ...DEFAULT_CFG }; }
  }
  function setCfg(next) { GM_setValue(KEY_CFG, JSON.stringify(next)); }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  function parseSemver(v) {
    const m = String(v || '').match(/(\d+)\.(\d+)\.(\d+)/);
    if (!m) return [0,0,0];
    return [parseInt(m[1],10), parseInt(m[2],10), parseInt(m[3],10)];
  }
  function cmpSemver(a, b) {
    const A = parseSemver(a), B = parseSemver(b);
    for (let i=0;i<3;i++) { if (A[i] > B[i]) return 1; if (A[i] < B[i]) return -1; }
    return 0;
  }

  function sameHostOrSub(host, rule) {
    if (!rule) return false;
    if (rule.startsWith('*.')) {
      const base = rule.slice(2);
      return host === base || host.endsWith('.' + base);
    }
    return host === rule;
  }

  function urlJoin(base, path) {
    if (!base.endsWith('/')) base += '/';
    path = String(path || '').replace(/^\/+/, '');
    return base + path;
  }

  function gmFetch(url, opts = {}) {
    const method = opts.method || 'GET';
    const headers = opts.headers || {};
    const responseType = opts.responseType || 'text';
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method, url, headers, responseType, timeout: 20000,
        onload: (res) => (res.status >= 200 && res.status < 300) ? resolve(res) : reject(new Error(`HTTP ${res.status}`)),
        onerror: () => reject(new Error('Network error')),
        ontimeout: () => reject(new Error('Timeout'))
      });
    });
  }

  async function sha256Hex(text) {
    try {
      const enc = new TextEncoder().encode(text);
      const buf = await crypto.subtle.digest('SHA-256', enc);
      const arr = Array.from(new Uint8Array(buf));
      return arr.map(b => b.toString(16).padStart(2,'0')).join('');
    } catch { return ''; }
  }

  function hoursToMs(h) { return Math.max(0, Number(h || 0)) * 3600 * 1000; }

  function notify(title, text) { try { GM_notification({ title, text, timeout: 3500 }); } catch {} }

  function pushLog(level, message, extra) {
    const c = cfg();
    const max = 400;
    const oldRaw = GM_getValue(KEY_LOG, '[]');
    let arr = [];
    try { arr = JSON.parse(oldRaw); } catch { arr = []; }
    arr.push({ at: new Date().toISOString(), level, message: String(message || ''), extra: extra ? String(extra) : '' });
    if (arr.length > max) arr = arr.slice(arr.length - max);
    GM_setValue(KEY_LOG, JSON.stringify(arr));
    if (c.debug) console.log(`[RF][${level}]`, message, extra || '');
  }

  function setLastError(e) {
    const info = { at: new Date().toISOString(), message: e?.message ? String(e.message) : String(e), stack: e?.stack ? String(e.stack).slice(0, 2500) : '' };
    GM_setValue(KEY_LAST_ERR, JSON.stringify(info));
  }

  function getLogs() { try { return JSON.parse(GM_getValue(KEY_LOG, '[]')); } catch { return []; } }

  function getChangelog() {
    const raw = GM_getValue(KEY_CHANGELOG, '');
    if (!raw) return FALLBACK_CHANGELOG.slice();
    try { const arr = JSON.parse(raw); return Array.isArray(arr) && arr.length ? arr : FALLBACK_CHANGELOG.slice(); }
    catch { return FALLBACK_CHANGELOG.slice(); }
  }
  function setChangelog(arr) { GM_setValue(KEY_CHANGELOG, JSON.stringify(Array.isArray(arr) ? arr : [])); }

  function getAbout() {
    const raw = GM_getValue(KEY_ABOUT, '');
    if (!raw) return { ...FALLBACK_ABOUT };
    try { const obj = JSON.parse(raw); return obj && typeof obj === 'object' ? { ...FALLBACK_ABOUT, ...obj } : { ...FALLBACK_ABOUT }; }
    catch { return { ...FALLBACK_ABOUT }; }
  }
  function setAbout(obj) { GM_setValue(KEY_ABOUT, JSON.stringify(obj && typeof obj === 'object' ? obj : {})); }

  function getLocalManifest() { try { return JSON.parse(GM_getValue(KEY_MANIFEST, '') || ''); } catch { return null; } }
  function setLocalManifest(mf) { GM_setValue(KEY_MANIFEST, JSON.stringify(mf || {})); }

  function getCache(path) { return GM_getValue(KEY_CACHE_PREFIX + path, ''); }
  function setCache(path, content) { GM_setValue(KEY_CACHE_PREFIX + path, content); }
  function delCache(path) { GM_deleteValue(KEY_CACHE_PREFIX + path); }

  function clearAllCache() {
    const keys = GM_listValues();
    for (const k of keys) if (k.startsWith(KEY_CACHE_PREFIX)) GM_deleteValue(k);
    GM_deleteValue(KEY_MANIFEST);
    pushLog('info', '缓存已清空');
  }

  async function fetchManifestFromBase(base) {
    const url = urlJoin(base, 'manifest.json') + `?_=${Date.now()}`;
    const res = await gmFetch(url, { responseType: 'text' });
    return JSON.parse(res.responseText);
  }
  async function fetchTextFromBase(base, path) {
    const url = urlJoin(base, path) + `?_=${Date.now()}`;
    const res = await gmFetch(url, { responseType: 'text' });
    return res.responseText;
  }
  async function fetchOptionalJson(base, path) {
    try {
      const url = urlJoin(base, path) + `?_=${Date.now()}`;
      const res = await gmFetch(url, { responseType: 'text' });
      return JSON.parse(res.responseText);
    } catch { return null; }
  }

  async function pickWorkingBase() {
    const candidates = [...REMOTE_BASES];
    const results = [];
    for (const base of candidates) {
      try {
        const mf = await fetchManifestFromBase(base);
        results.push({ base, manifest: mf });
      } catch (e) {
        pushLog('warn', `Base 失败：${base}`, e?.message || e);
      }
    }
    if (!results.length) throw new Error('No working base found');
    results.sort((a, b) => cmpSemver(b.manifest.version, a.manifest.version));
    return results[0];
  }

  async function checkAndUpdate({ force = false } = {}) {
    const c = cfg();
    if (!c.enabled) return;

    const lastCheckAt = Number(GM_getValue(KEY_LAST_CHECK, 0));
    const intervalMs = hoursToMs(c.checkIntervalHours);
    if (!force && c.autoUpdate && lastCheckAt && (now() - lastCheckAt) < intervalMs) return;

    GM_setValue(KEY_LAST_CHECK, now());

    const { base, manifest: remoteMf } = await pickWorkingBase();

    if (remoteMf.minBootstrap && cmpSemver(BOOTSTRAP_VERSION, remoteMf.minBootstrap) < 0) {
      throw new Error(`需要 Bootstrap >= ${remoteMf.minBootstrap}，当前 ${BOOTSTRAP_VERSION}`);
    }

    GM_setValue(KEY_LAST_BASE, base);

    // 远程拉取 about/changelog（你要求“远程生效”）
    const aboutRemote = await fetchOptionalJson(base, 'about.json');
    if (aboutRemote) setAbout(aboutRemote);

    const changelogRemote = await fetchOptionalJson(base, 'changelog.json');
    if (Array.isArray(changelogRemote) && changelogRemote.length) setChangelog(changelogRemote);

    const localMf = getLocalManifest();
    const needUpdate = force || !localMf || cmpSemver(remoteMf.version, localMf.version) > 0;
    if (!needUpdate) { pushLog('info', `无需更新，远程版本：${remoteMf.version}`); return; }

    const host = location.host;
    const paths = new Set();
    (remoteMf.entry || []).forEach(p => paths.add(p));
    for (const rule of (remoteMf.hostRules || [])) {
      if (sameHostOrSub(host, rule.match)) (rule.modules || []).forEach(p => paths.add(p));
    }

    let ok = 0, skip = 0;
    for (const path of paths) {
      if (c.disabledModules?.[path]) { skip++; continue; }
      const content = await fetchTextFromBase(base, path);

      if (c.strictVerify) {
        const integrity = remoteMf.integrity?.[path]?.sha256;
        if (!integrity) throw new Error(`缺少 sha256：${path}`);
        const hex = await sha256Hex(content);
        if (!hex) throw new Error(`环境不支持 sha256：${path}`);
        const normalized = String(integrity).replace(/^sha256-?/i, '').toLowerCase();
        if (hex.toLowerCase() !== normalized) throw new Error(`sha256 校验失败：${path}`);
      }

      setCache(path, content);
      ok++;
    }

    setLocalManifest(remoteMf);
    pushLog('info', `已更新到 ${remoteMf.version}（缓存模块：${ok}，跳过：${skip}）`);
    notify('RF 已更新', `远程版本：${remoteMf.version}`);
  }

  function shouldRunOnThisHost() {
    const c = cfg();
    if (!c.enabled) return false;
    if (!c.onlyWhitelist) return true;
    return (c.whitelist || []).some(w => sameHostOrSub(location.host, w));
  }

  function collectModulesToRun(mf) {
    const c = cfg();
    const host = location.host;
    const list = [];
    (mf.entry || []).forEach(p => list.push(p));
    for (const rule of (mf.hostRules || [])) if (sameHostOrSub(host, rule.match)) (rule.modules || []).forEach(p => list.push(p));
    const uniq = [];
    const seen = new Set();
    for (const p of list) {
      if (seen.has(p)) continue;
      seen.add(p);
      if (c.disabledModules?.[p]) continue;
      uniq.push(p);
    }
    return uniq;
  }

  function runCachedModule(path, code) {
    const wrapper = new Function('RF', code);
    wrapper({
      bootstrapVersion: BOOTSTRAP_VERSION,
      host: location.host,
      href: location.href,
      shell: {
        open: () => openShellUI(),
        notify,
        addTab: (id, title, render) => {
          if (!id || !title || typeof render !== 'function') return;
          CUSTOM_TABS.set(id, { title, render });
        }
      },
      storage: {
        get: (k, d) => GM_getValue(`${STORAGE_NS}:mod:${k}`, d),
        set: (k, v) => GM_setValue(`${STORAGE_NS}:mod:${k}`, v),
        del: (k) => GM_deleteValue(`${STORAGE_NS}:mod:${k}`)
      },
      utils: {
        gmFetch,
        log: (...a) => pushLog('info', `[${path}] ${a.join(' ')}`),
        warn: (...a) => pushLog('warn', `[${path}] ${a.join(' ')}`),
        err: (...a) => pushLog('error', `[${path}] ${a.join(' ')}`)
      }
    });
  }

  // ======= Shell UI（与前面 1.5.0 同结构，保留 status/config/modules/logs/changelog/about）=======
  const UI = { btnId:'rf-shell-float-btn', panelId:'rf-shell-panel', bodyId:'rf-shell-body', styleId:'rf-shell-style', backdropId:'rf-shell-backdrop', toastId:'rf-shell-toast' };

  const CursorFX = { on:false, raf:0, x:0, y:0, tx:0, ty:0, handler:null, loop:null };

  function enableCursorGlow() {
    const c = cfg();
    if (c.reduceMotion || !c.neonGlow || !c.neonFollowCursor) return;
    if (CursorFX.on) return;

    CursorFX.on = true;
    CursorFX.handler = (ev) => { CursorFX.tx = ev.clientX; CursorFX.ty = ev.clientY; };
    CursorFX.loop = () => {
      CursorFX.x += (CursorFX.tx - CursorFX.x) * 0.18;
      CursorFX.y += (CursorFX.ty - CursorFX.y) * 0.18;
      document.documentElement.style.setProperty('--rf-cx', `${CursorFX.x}px`);
      document.documentElement.style.setProperty('--rf-cy', `${CursorFX.y}px`);
      CursorFX.raf = requestAnimationFrame(CursorFX.loop);
    };
    window.addEventListener('mousemove', CursorFX.handler, { passive:true });
    CursorFX.x = window.innerWidth * 0.85;
    CursorFX.y = window.innerHeight * 0.85;
    CursorFX.tx = CursorFX.x;
    CursorFX.ty = CursorFX.y;
    CursorFX.loop();
  }
  function disableCursorGlow() {
    if (!CursorFX.on) return;
    CursorFX.on = false;
    if (CursorFX.handler) window.removeEventListener('mousemove', CursorFX.handler);
    if (CursorFX.raf) cancelAnimationFrame(CursorFX.raf);
    CursorFX.handler = null;
    CursorFX.loop = null;
    CursorFX.raf = 0;
  }

  function injectShellStyle() {
    if (document.getElementById(UI.styleId)) return;
    const c = cfg();
    const reduce = !!c.reduceMotion;
    const neon = !!c.neonGlow && !reduce;

    const intensity = Math.max(0, Math.min(1, Number(c.neonIntensity ?? 0.85)));
    const speed = Math.max(0.5, Math.min(2, Number(c.neonSpeed ?? 1.0)));

    const style = document.createElement('style');
    style.id = UI.styleId;
    style.textContent = `
:root{
  --rf-radius: 16px; --rf-blur: 14px;
  --rf-shadow: 0 18px 60px rgba(0,0,0,.22);
  --rf-shadow-sm: 0 10px 30px rgba(0,0,0,.18);
  --rf-border: rgba(255,255,255,.22); --rf-border2: rgba(0,0,0,.10);
  --rf-text: rgba(10,10,10,.92); --rf-sub: rgba(10,10,10,.62);
  --rf-bg: rgba(255,255,255,.68); --rf-bg2: rgba(255,255,255,.84);
  --rf-chip: rgba(0,0,0,.06); --rf-line: rgba(0,0,0,.08);
  --rf-btn: rgba(255,255,255,.82); --rf-btn2: rgba(0,0,0,.06);
  --rf-neon-i:${intensity}; --rf-neon-speed:${speed};
  --rf-cx:85vw; --rf-cy:85vh;
}
@media (prefers-color-scheme: dark){
  :root{
    --rf-text: rgba(255,255,255,.92); --rf-sub: rgba(255,255,255,.62);
    --rf-bg: rgba(20,20,22,.64); --rf-bg2: rgba(20,20,22,.82);
    --rf-chip: rgba(255,255,255,.08); --rf-line: rgba(255,255,255,.10);
    --rf-btn: rgba(30,30,32,.72); --rf-btn2: rgba(255,255,255,.10);
    --rf-border2: rgba(255,255,255,.12);
    --rf-shadow: 0 18px 60px rgba(0,0,0,.55); --rf-shadow-sm: 0 10px 30px rgba(0,0,0,.45);
  }
}
#${UI.backdropId}{ position:fixed; inset:0; z-index:2147483646;
  background: radial-gradient(1200px 800px at 85% 85%, rgba(10,132,255,.22), transparent 55%),
             radial-gradient(900px 650px at 15% 15%, rgba(52,199,89,.18), transparent 55%),
             rgba(0,0,0,.18);
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  opacity:0; pointer-events:none; transition: opacity .28s ease;
}
#${UI.backdropId}.on{ opacity:1; pointer-events:auto; }

#${UI.btnId}{ position:fixed; right:14px; bottom:14px; z-index:2147483647;
  width:52px; height:52px; border-radius:18px; border:1px solid var(--rf-border2);
  color:var(--rf-text);
  background: linear-gradient(135deg, rgba(255,255,255,.9), rgba(255,255,255,.55));
  box-shadow: var(--rf-shadow-sm);
  cursor:pointer;
  font:900 14px/1.0 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
  letter-spacing:.2px;
  ${reduce ? '' : 'transition: transform .18s ease, box-shadow .18s ease, filter .18s ease;'}
  ${neon ? 'isolation:isolate;' : ''}
}
@media (prefers-color-scheme: dark){
  #${UI.btnId}{ background: linear-gradient(135deg, rgba(30,30,32,.92), rgba(30,30,32,.55)); }
}
#${UI.btnId}:hover{
  ${reduce ? '' : 'transform: translateY(-2px) scale(1.02);'}
  box-shadow: var(--rf-shadow);
  ${neon ? 'filter:saturate(1.05);' : ''}
}
#${UI.panelId}{ position:fixed; right:14px; bottom:74px; z-index:2147483647;
  width:460px; max-width: calc(100vw - 28px);
  max-height:76vh; overflow:hidden;
  color:var(--rf-text); background: var(--rf-bg);
  border:1px solid var(--rf-border); border-top-color: rgba(255,255,255,.32); border-left-color: rgba(255,255,255,.26);
  border-radius: var(--rf-radius);
  box-shadow: var(--rf-shadow);
  backdrop-filter: blur(var(--rf-blur)); -webkit-backdrop-filter: blur(var(--rf-blur));
  transform-origin: 92% 92%;
  opacity:0;
  ${reduce ? '' : 'transform: translateY(14px) scale(.96); transition: transform .22s cubic-bezier(.2,.8,.2,1), opacity .22s ease;'}
  ${neon ? 'isolation:isolate;' : ''}
}
#${UI.panelId}.on{ opacity:1; ${reduce ? '' : 'transform: translateY(0) scale(1);'} }

${neon ? `
:root{
  --rf-neon-a: conic-gradient(from 0deg,
    rgba(255,0,102,.95), rgba(255,168,0,.95), rgba(255,230,0,.95),
    rgba(0,255,153,.95), rgba(0,180,255,.95), rgba(140,0,255,.95),
    rgba(255,0,102,.95)
  );
  --rf-neon-b: conic-gradient(from 180deg,
    rgba(0,180,255,.9), rgba(140,0,255,.9), rgba(255,0,102,.9),
    rgba(255,168,0,.9), rgba(0,255,153,.9), rgba(0,180,255,.9)
  );
}
#${UI.panelId} .rf-spot{ position:absolute; inset:0; pointer-events:none; z-index:0;
  background: radial-gradient(480px 360px at var(--rf-cx) var(--rf-cy), rgba(255,255,255,.18), rgba(10,132,255,.10), transparent 60%);
  opacity: calc(.22 * var(--rf-neon-i));
  filter: blur(6px) saturate(1.1);
}
@media (prefers-color-scheme: dark){
  #${UI.panelId} .rf-spot{
    background: radial-gradient(520px 380px at var(--rf-cx) var(--rf-cy), rgba(255,255,255,.10), rgba(10,132,255,.10), transparent 62%);
    opacity: calc(.28 * var(--rf-neon-i));
  }
}
#${UI.panelId}::before{ content:""; position:absolute; inset:-2px;
  border-radius: calc(var(--rf-radius) + 2px);
  background: var(--rf-neon-a);
  filter: blur(14px) saturate(1.15);
  opacity: calc(.60 * var(--rf-neon-i));
  z-index:-2;
  animation: rfNeonSpin calc(6.5s / var(--rf-neon-speed)) linear infinite,
             rfNeonBreath calc(2.9s / var(--rf-neon-speed)) ease-in-out infinite;
}
#${UI.panelId}::after{ content:""; position:absolute; inset:-1px;
  border-radius: calc(var(--rf-radius) + 1px);
  background: var(--rf-neon-b);
  opacity: calc(.16 * var(--rf-neon-i));
  z-index:-2;
  animation: rfNeonSpin calc(10s / var(--rf-neon-speed)) linear infinite reverse;
}
#${UI.panelId} .rf-shimmer{ position:absolute; inset:-40%; pointer-events:none; z-index:-1;
  background: linear-gradient(120deg, transparent 35%, rgba(255,255,255,.08) 45%, rgba(10,132,255,.10) 52%, rgba(255,255,255,.06) 58%, transparent 70%);
  transform: translateX(-40%) rotate(8deg);
  opacity: calc(.55 * var(--rf-neon-i));
  animation: rfShimmer calc(3.6s / var(--rf-neon-speed)) ease-in-out infinite;
  mix-blend-mode: overlay;
}
#${UI.panelId} .rf-spark{ position:absolute; inset:0; pointer-events:none; z-index:1;
  opacity: calc(.55 * var(--rf-neon-i));
  background:
    radial-gradient(2px 2px at 16% 22%, rgba(255,255,255,.85), transparent 60%),
    radial-gradient(1.5px 1.5px at 78% 18%, rgba(255,255,255,.70), transparent 60%),
    radial-gradient(2.2px 2.2px at 66% 72%, rgba(255,255,255,.80), transparent 60%),
    radial-gradient(1.8px 1.8px at 30% 76%, rgba(255,255,255,.65), transparent 60%),
    radial-gradient(2px 2px at 88% 54%, rgba(255,255,255,.70), transparent 60%);
  animation: rfTwinkle calc(2.8s / var(--rf-neon-speed)) ease-in-out infinite;
}
#${UI.btnId}::before{ content:""; position:absolute; inset:-2px; border-radius:20px;
  background: var(--rf-neon-a);
  filter: blur(8px) saturate(1.12);
  opacity: calc(.78 * var(--rf-neon-i));
  z-index:-1;
  animation: rfNeonSpin calc(2.8s / var(--rf-neon-speed)) linear infinite,
             rfNeonBreath calc(2.2s / var(--rf-neon-speed)) ease-in-out infinite;
}
#${UI.btnId}::after{ content:""; position:absolute; inset:-1px; border-radius:19px;
  background: var(--rf-neon-b);
  opacity: calc(.22 * var(--rf-neon-i));
  z-index:-1;
  animation: rfNeonSpin calc(5.2s / var(--rf-neon-speed)) linear infinite reverse;
}
@keyframes rfNeonSpin{ to{ transform: rotate(360deg); } }
@keyframes rfNeonBreath{ 0%,100%{ opacity: calc(.55 * var(--rf-neon-i)); } 50%{ opacity: calc(.78 * var(--rf-neon-i)); } }
@keyframes rfShimmer{
  0%{ transform: translateX(-55%) rotate(8deg); opacity: calc(.15 * var(--rf-neon-i)); }
  35%{ opacity: calc(.55 * var(--rf-neon-i)); }
  70%{ opacity: calc(.32 * var(--rf-neon-i)); }
  100%{ transform: translateX(55%) rotate(8deg); opacity: calc(.10 * var(--rf-neon-i)); }
}
@keyframes rfTwinkle{ 0%,100%{ opacity: calc(.35 * var(--rf-neon-i)); transform: translateY(0); } 50%{ opacity: calc(.75 * var(--rf-neon-i)); transform: translateY(-1px); } }
` : ''}

#${UI.panelId} .rf-hd{ position:relative; display:flex; align-items:center; justify-content:space-between;
  padding:12px 12px 10px; border-bottom:1px solid var(--rf-line);
  background: linear-gradient(180deg, var(--rf-bg2), transparent);
  z-index:2;
}
#${UI.panelId} .rf-title{ display:flex; align-items:center; gap:10px; font-weight:900; }
#${UI.panelId} .rf-badge{ font-weight:900; font-size:11px; padding:4px 8px; border-radius:999px;
  background: var(--rf-chip); border:1px solid var(--rf-line); color: var(--rf-sub);
}
#${UI.panelId} .rf-x{ width:34px; height:34px; border-radius:12px; border:1px solid var(--rf-line);
  background: var(--rf-btn); color: var(--rf-text); cursor:pointer; font-size:18px;
  display:flex; align-items:center; justify-content:center;
  ${reduce ? '' : 'transition: transform .16s ease, background .16s ease;'}
}
#${UI.panelId} .rf-x:hover{ background: var(--rf-btn2); ${reduce ? '' : 'transform: rotate(4deg) scale(1.02);'} }
#${UI.panelId} .rf-tabs{ position:relative; display:flex; gap:8px; padding:10px 12px; border-bottom:1px solid var(--rf-line); overflow:auto; z-index:2; }
#${UI.panelId} .rf-tab{ padding:8px 12px; border-radius:999px; border:1px solid var(--rf-line); background: var(--rf-btn);
  cursor:pointer; user-select:none; font-weight:900; color: var(--rf-sub);
  ${reduce ? '' : 'transition: transform .16s ease, background .16s ease, color .16s ease;'}
}
#${UI.panelId} .rf-tab:hover{ background: var(--rf-btn2); ${reduce ? '' : 'transform: translateY(-1px);'} }
#${UI.panelId} .rf-tab.active{ color: var(--rf-text);
  background: linear-gradient(135deg, rgba(10,132,255,.22), rgba(52,199,89,.18));
  border-color: rgba(10,132,255,.25);
}
#${UI.panelId} .rf-bd{ position:relative; padding:12px; overflow:auto; max-height: calc(76vh - 110px); z-index:2; }

#${UI.panelId} .rf-card{ border:1px solid var(--rf-line); background: rgba(255,255,255,.45);
  border-radius: var(--rf-radius); padding: 12px;
  box-shadow: 0 10px 22px rgba(0,0,0,.08);
  ${reduce ? '' : 'animation: rfPop .24s ease;'}
}
@media (prefers-color-scheme: dark){ #${UI.panelId} .rf-card{ background: rgba(30,30,32,.45); box-shadow: 0 10px 22px rgba(0,0,0,.30); } }

#${UI.panelId} .rf-kv{ margin:6px 0; display:flex; gap:10px; align-items:flex-start; }
#${UI.panelId} .rf-kv b{ width:110px; flex:0 0 110px; color: var(--rf-sub); font-weight:900; }
#${UI.panelId} .rf-kv .v{ flex:1 1 auto; color: var(--rf-text); word-break:break-word; }

#${UI.panelId} .rf-row{ display:flex; gap:10px; flex-wrap:wrap; margin-top:10px; }
#${UI.panelId} .rf-btn{ padding:9px 12px; border-radius:14px; border:1px solid var(--rf-line);
  background: var(--rf-btn); color: var(--rf-text); cursor:pointer; font-weight:900;
  ${reduce ? '' : 'transition: transform .16s ease, box-shadow .16s ease, background .16s ease;'}
}
#${UI.panelId} .rf-btn:hover{ background: var(--rf-btn2); ${reduce ? '' : 'transform: translateY(-1px);'} box-shadow: 0 10px 20px rgba(0,0,0,.10); }
#${UI.panelId} .rf-btn.primary{ background: linear-gradient(135deg, rgba(10,132,255,.32), rgba(10,132,255,.16)); border-color: rgba(10,132,255,.28); }
#${UI.panelId} .rf-btn.danger{ background: linear-gradient(135deg, rgba(255,59,48,.28), rgba(255,59,48,.14)); border-color: rgba(255,59,48,.22); }

#${UI.panelId} .rf-field{ margin-top:10px; }
#${UI.panelId} .rf-label{ font-weight:900; color: var(--rf-sub); margin:4px 2px 6px; }
#${UI.panelId} textarea, #${UI.panelId} input[type="number"], #${UI.panelId} select{
  width:100%; box-sizing:border-box; padding:10px 10px; border-radius:14px; border:1px solid var(--rf-line);
  background: rgba(255,255,255,.55); color: var(--rf-text); outline:none;
  ${reduce ? '' : 'transition: border-color .16s ease, transform .16s ease, background .16s ease;'}
}
@media (prefers-color-scheme: dark){ #${UI.panelId} textarea, #${UI.panelId} input[type="number"], #${UI.panelId} select{ background: rgba(30,30,32,.52); } }
#${UI.panelId} textarea{ height: 90px; resize: vertical; }
#${UI.panelId} textarea:focus, #${UI.panelId} input:focus, #${UI.panelId} select:focus{ border-color: rgba(10,132,255,.55); ${reduce ? '' : 'transform: translateY(-1px);'} }

#${UI.panelId} .rf-toggle{ display:flex; align-items:center; justify-content:space-between; padding:10px 10px; border:1px solid var(--rf-line);
  border-radius:14px; background: rgba(255,255,255,.35);
}
@media (prefers-color-scheme: dark){ #${UI.panelId} .rf-toggle{ background: rgba(30,30,32,.35); } }
#${UI.panelId} .rf-toggle .k{ font-weight:900; color: var(--rf-sub); }
#${UI.panelId} .rf-toggle .s{ color: var(--rf-sub); font-size:11px; margin-top:2px; }
#${UI.panelId} .rf-toggle input{ transform: scale(1.05); }

#${UI.toastId}{ position:fixed; right:14px; bottom:74px; z-index:2147483647;
  width:320px; max-width: calc(100vw - 28px);
  border-radius:16px; border:1px solid var(--rf-line); background: var(--rf-bg2); color: var(--rf-text);
  box-shadow: var(--rf-shadow); padding:10px 12px;
  opacity:0; pointer-events:none;
  ${reduce ? '' : 'transform: translateY(10px) scale(.98); transition: opacity .2s ease, transform .2s ease;'}
}
#${UI.toastId}.on{ opacity:1; pointer-events:auto; ${reduce ? '' : 'transform: translateY(0) scale(1);'} }
#${UI.toastId} .h{ font-weight:900; margin-bottom:2px; } #${UI.toastId} .t{ color: var(--rf-sub); }

${reduce ? '' : '@keyframes rfPop{from{opacity:0;transform:translateY(10px) scale(.985);}to{opacity:1;transform:translateY(0) scale(1);}}'}
`;
    document.documentElement.appendChild(style);
  }

  function toast(title, text, ms = 2200) {
    injectShellStyle();
    let el = document.getElementById(UI.toastId);
    if (!el) {
      el = document.createElement('div');
      el.id = UI.toastId;
      el.innerHTML = `<div class="h"></div><div class="t"></div>`;
      document.documentElement.appendChild(el);
    }
    el.querySelector('.h').textContent = title || 'RF';
    el.querySelector('.t').textContent = text || '';
    el.classList.add('on');
    clearTimeout(el._rfTimer);
    el._rfTimer = setTimeout(() => el.classList.remove('on'), ms);
  }

  function ensureBackdrop() {
    let bd = document.getElementById(UI.backdropId);
    if (bd) return bd;
    bd = document.createElement('div');
    bd.id = UI.backdropId;
    bd.addEventListener('click', () => closeShellUI());
    document.documentElement.appendChild(bd);
    return bd;
  }

  function ensureFloatButton() {
    injectShellStyle();
    const c = cfg();
    if (!c.showFloatButton) return;
    if (!document.documentElement) return;
    if (document.getElementById(UI.btnId)) return;
    const btn = document.createElement('button');
    btn.id = UI.btnId;
    btn.textContent = 'RF';
    btn.title = '打开 RF 壳面板';
    btn.addEventListener('click', () => openShellUI());
    document.documentElement.appendChild(btn);
  }

  function closeShellUI() {
    const panel = document.getElementById(UI.panelId);
    const bd = document.getElementById(UI.backdropId);
    if (panel) panel.classList.remove('on');
    if (bd) bd.classList.remove('on');
    disableCursorGlow();
    setTimeout(() => {
      const p = document.getElementById(UI.panelId);
      const b = document.getElementById(UI.backdropId);
      if (p && !p.classList.contains('on')) p.remove();
      if (b && !b.classList.contains('on')) b.remove();
    }, cfg().reduceMotion ? 0 : 230);
  }

  function openShellUI(tab) {
    injectShellStyle();
    ensureBackdrop();
    let panel = document.getElementById(UI.panelId);
    if (!panel) {
      panel = document.createElement('div');
      panel.id = UI.panelId;
      panel.innerHTML = `
        <div class="rf-spot"></div>
        <div class="rf-shimmer"></div>
        <div class="rf-spark"></div>
        <div class="rf-hd">
          <div class="rf-title"><span>RF Shell</span><span class="rf-badge">Bootstrap ${escapeHtml(BOOTSTRAP_VERSION)}</span></div>
          <button class="rf-x" id="rf-shell-close" aria-label="Close">×</button>
        </div>
        <div class="rf-tabs">
          <div class="rf-tab" data-tab="status">状态</div>
          <div class="rf-tab" data-tab="config">配置</div>
          <div class="rf-tab" data-tab="modules">模块</div>
          <div class="rf-tab" data-tab="logs">日志</div>
          <div class="rf-tab" data-tab="changelog">更新日志</div>
          <div class="rf-tab" data-tab="about">关于</div>
          ${Array.from(CUSTOM_TABS.entries()).map(([id, t]) => `<div class="rf-tab" data-tab="${escapeHtml(id)}">${escapeHtml(t.title)}</div>`).join('')}
        </div>
        <div class="rf-bd" id="${UI.bodyId}"></div>
      `;
      document.documentElement.appendChild(panel);

      const c = cfg();
      const spark = panel.querySelector('.rf-spark');
      if (spark) spark.style.display = (c.neonGlow && !c.reduceMotion && c.neonSparkles) ? 'block' : 'none';

      panel.querySelector('#rf-shell-close').addEventListener('click', () => closeShellUI());
      panel.querySelectorAll('.rf-tab').forEach(el => el.addEventListener('click', () => renderShell(el.getAttribute('data-tab'))));
      panel._rfEsc = (e) => { if (e.key === 'Escape') closeShellUI(); };
      window.addEventListener('keydown', panel._rfEsc, { passive:true });
    }
    document.getElementById(UI.backdropId).classList.add('on');
    requestAnimationFrame(() => panel.classList.add('on'));
    enableCursorGlow();
    renderShell(tab || cfg().defaultTab || 'status');
  }

  function setActiveTab(tab) {
    const panel = document.getElementById(UI.panelId);
    if (!panel) return;
    panel.querySelectorAll('.rf-tab').forEach(el => el.classList.toggle('active', el.getAttribute('data-tab') === tab));
  }

  function renderShell(tab, tip) {
    setActiveTab(tab);
    const body = document.getElementById(UI.bodyId);
    if (!body) return;

    const c = cfg();
    const mf = getLocalManifest();
    const lastCheckAt = Number(GM_getValue(KEY_LAST_CHECK, 0));
    const lastBase = GM_getValue(KEY_LAST_BASE, '');
    let lastErr = null;
    try { lastErr = JSON.parse(GM_getValue(KEY_LAST_ERR, '') || ''); } catch { lastErr = null; }
    const canRun = !c.onlyWhitelist || (c.whitelist || []).some(w => sameHostOrSub(location.host, w));

    if (tab === 'status') {
      body.innerHTML = `
        <div class="rf-card">
          <div class="rf-kv"><b>当前域名</b><div class="v">${escapeHtml(location.host)}</div></div>
          <div class="rf-kv"><b>允许运行</b><div class="v">${canRun ? '是' : '否'}</div></div>
          <div class="rf-kv"><b>远程版本</b><div class="v">${escapeHtml(mf?.version || '-')}</div></div>
          <div class="rf-kv"><b>上次检查</b><div class="v">${lastCheckAt ? new Date(lastCheckAt).toLocaleString() : '-'}</div></div>
          <div class="rf-kv"><b>当前 Base</b><div class="v">${escapeHtml(lastBase || '-')}</div></div>
          <div class="rf-kv"><b>安全模式</b><div class="v">${c.safeMode ? '开启（不执行远程模块）' : '关闭'}</div></div>

          <div class="rf-row">
            <button class="rf-btn primary" id="rf-act-check">立即检查更新</button>
            <button class="rf-btn" id="rf-act-clear">清空缓存</button>
            <button class="rf-btn" id="rf-act-toggle">${c.enabled ? '禁用壳' : '启用壳'}</button>
            <button class="rf-btn" id="rf-act-safe">${c.safeMode ? '关闭安全模式' : '开启安全模式'}</button>
          </div>

          <div style="margin-top:10px;color:var(--rf-sub);font-size:11px;">
            ${lastErr?.message ? `上次错误：${escapeHtml(lastErr.at)} - ${escapeHtml(lastErr.message)}` : '上次错误：无'}
          </div>
          ${tip ? `<div style="margin-top:8px;font-weight:900;">${escapeHtml(tip)}</div>` : ''}
        </div>
      `;
      body.querySelector('#rf-act-check').addEventListener('click', async () => {
        toast('RF', '正在检查更新…');
        try { await checkAndUpdate({ force:true }); toast('RF', '检查完成'); renderShell('status', '检查完成'); }
        catch (e) { setLastError(e); toast('RF', `检查失败：${e?.message || e}`); renderShell('status', `检查失败：${e?.message || e}`); }
      });
      body.querySelector('#rf-act-clear').addEventListener('click', () => { clearAllCache(); toast('RF', '缓存已清空'); renderShell('status', '缓存已清空'); });
      body.querySelector('#rf-act-toggle').addEventListener('click', () => { const c2=cfg(); c2.enabled=!c2.enabled; setCfg(c2); toast('RF', c2.enabled?'已启用':'已禁用'); renderShell('status'); });
      body.querySelector('#rf-act-safe').addEventListener('click', () => { const c2=cfg(); c2.safeMode=!c2.safeMode; setCfg(c2); toast('RF', c2.safeMode?'安全模式开启':'安全模式关闭'); renderShell('status'); });
      return;
    }

    if (tab === 'config') {
      const wl = (c.whitelist || []).join('\n');
      body.innerHTML = `
        <div class="rf-card">
          <div class="rf-toggle"><div><div class="k">自动更新</div><div class="s">按间隔拉取 manifest</div></div><input type="checkbox" id="rf-c-auto" ${c.autoUpdate ? 'checked':''}></div>
          <div class="rf-field"><div class="rf-label">检查间隔（小时）</div><input type="number" id="rf-c-interval" min="1" step="1" value="${Number(c.checkIntervalHours || 6)}"></div>

          <div class="rf-toggle" style="margin-top:10px;"><div><div class="k">严格校验（sha256）</div><div class="s">需要 manifest.integrity</div></div><input type="checkbox" id="rf-c-verify" ${c.strictVerify ? 'checked':''}></div>

          <div class="rf-toggle" style="margin-top:10px;"><div><div class="k">仅白名单域名运行</div><div class="s">避免在无关站点执行</div></div><input type="checkbox" id="rf-c-onlywl" ${c.onlyWhitelist ? 'checked':''}></div>
          <div class="rf-field"><div class="rf-label">白名单（每行一个：example.com 或 *.example.com）</div><textarea id="rf-c-wl">${escapeHtml(wl)}</textarea></div>

          <div class="rf-toggle" style="margin-top:10px;"><div><div class="k">显示悬浮按钮</div><div class="s">右下角 RF 入口</div></div><input type="checkbox" id="rf-c-float" ${c.showFloatButton ? 'checked':''}></div>
          <div class="rf-toggle" style="margin-top:10px;"><div><div class="k">降低动画</div><div class="s">开启后关闭大部分动效</div></div><input type="checkbox" id="rf-c-motion" ${c.reduceMotion ? 'checked':''}></div>

          <div class="rf-toggle" style="margin-top:10px;"><div><div class="k">炫彩灯效</div><div class="s">RGB 灯带</div></div><input type="checkbox" id="rf-c-neon" ${c.neonGlow ? 'checked':''}></div>
          <div class="rf-field"><div class="rf-label">灯效强度（0~1）</div><input type="number" id="rf-c-int" min="0" max="1" step="0.05" value="${Number(c.neonIntensity ?? 0.85)}"></div>
          <div class="rf-field"><div class="rf-label">灯效速度倍率（0.5~2）</div><input type="number" id="rf-c-speed" min="0.5" max="2" step="0.1" value="${Number(c.neonSpeed ?? 1.0)}"></div>

          <div class="rf-row"><button class="rf-btn primary" id="rf-c-save">保存配置</button><button class="rf-btn" id="rf-c-export">导出</button><button class="rf-btn" id="rf-c-import">导入</button><button class="rf-btn danger" id="rf-c-reset">重置</button></div>
          <div class="rf-field"><div class="rf-label">导入/导出 JSON（仅壳配置）</div><textarea id="rf-c-io" placeholder="点击导出会出现在这里；粘贴后点击导入"></textarea></div>

          ${tip ? `<div style="margin-top:8px;font-weight:900;">${escapeHtml(tip)}</div>` : ''}
        </div>
      `;

      body.querySelector('#rf-c-save').addEventListener('click', () => {
        const c2 = cfg();
        c2.autoUpdate = !!body.querySelector('#rf-c-auto').checked;
        c2.checkIntervalHours = Math.max(1, Number(body.querySelector('#rf-c-interval').value || 6));
        c2.strictVerify = !!body.querySelector('#rf-c-verify').checked;
        c2.onlyWhitelist = !!body.querySelector('#rf-c-onlywl').checked;
        c2.showFloatButton = !!body.querySelector('#rf-c-float').checked;
        c2.reduceMotion = !!body.querySelector('#rf-c-motion').checked;
        c2.neonGlow = !!body.querySelector('#rf-c-neon').checked;
        c2.neonIntensity = Math.max(0, Math.min(1, Number(body.querySelector('#rf-c-int').value ?? 0.85)));
        c2.neonSpeed = Math.max(0.5, Math.min(2, Number(body.querySelector('#rf-c-speed').value ?? 1.0)));

        const wl2 = String(body.querySelector('#rf-c-wl').value || '').split('\n').map(s => s.trim()).filter(Boolean);
        c2.whitelist = wl2;

        setCfg(c2);

        const btn = document.getElementById(UI.btnId);
        if (c2.showFloatButton) ensureFloatButton();
        else if (btn) btn.remove();

        toast('RF', '配置已保存');
        renderShell('config', '配置已保存（建议刷新页面让样式完全重载）');
      });

      body.querySelector('#rf-c-export').addEventListener('click', () => {
        body.querySelector('#rf-c-io').value = GM_getValue(KEY_CFG, JSON.stringify(DEFAULT_CFG));
        toast('RF', '已导出到文本框');
      });
      body.querySelector('#rf-c-import').addEventListener('click', () => {
        const txt = body.querySelector('#rf-c-io').value || '';
        try { setCfg({ ...DEFAULT_CFG, ...JSON.parse(txt) }); toast('RF', '导入成功'); renderShell('config', '导入成功'); }
        catch { toast('RF', '导入失败：JSON 不合法'); }
      });
      body.querySelector('#rf-c-reset').addEventListener('click', () => { setCfg({ ...DEFAULT_CFG }); toast('RF', '已重置'); renderShell('config', '已重置（刷新页面生效）'); });

      return;
    }

    if (tab === 'modules') {
      const all = new Set();
      if (mf?.entry) mf.entry.forEach(p => all.add(p));
      if (mf?.hostRules) mf.hostRules.forEach(r => (r.modules || []).forEach(p => all.add(p)));
      const list = Array.from(all).map(p => ({ path:p, disabled:!!c.disabledModules?.[p], cached:!!getCache(p) }));

      body.innerHTML = `
        <div class="rf-card">
          <div style="font-weight:900;color:var(--rf-sub);font-size:11px;">控制远程模块启用/禁用（模块自己的 UI 不在壳里）。</div>
          <div class="rf-row">
            <button class="rf-btn primary" id="rf-m-check">检查并更新</button>
            <button class="rf-btn" id="rf-m-enableall">全部启用</button>
            <button class="rf-btn" id="rf-m-disableall">全部禁用</button>
          </div>
          <div style="margin-top:10px;">
            ${list.length ? '' : `<div style="color:var(--rf-sub);">manifest 里还没有任何模块条目</div>`}
            <div id="rf-mod-list"></div>
          </div>
          ${tip ? `<div style="margin-top:8px;font-weight:900;">${escapeHtml(tip)}</div>` : ''}
        </div>
      `;

      const wrap = body.querySelector('#rf-mod-list');
      wrap.innerHTML = list.map(item => `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 10px;border:1px solid var(--rf-line);border-radius:14px;background:rgba(255,255,255,.32);margin-top:8px;">
          <div style="min-width:0;">
            <div style="font-weight:900;">${escapeHtml(item.path)}</div>
            <div style="font-size:11px;color:var(--rf-sub);margin-top:2px;">缓存：${item.cached ? '是' : '否'} ｜ 状态：${item.disabled ? '禁用' : '启用'}</div>
          </div>
          <div style="display:flex;gap:8px;flex:0 0 auto;">
            <button class="rf-btn" data-act="toggle" data-path="${escapeHtml(item.path)}" style="padding:7px 10px;border-radius:12px;">${item.disabled ? '启用' : '禁用'}</button>
            <button class="rf-btn" data-act="delcache" data-path="${escapeHtml(item.path)}" style="padding:7px 10px;border-radius:12px;">删缓存</button>
          </div>
        </div>
      `).join('');

      wrap.querySelectorAll('button[data-act]').forEach(btn => {
        btn.addEventListener('click', () => {
          const act = btn.getAttribute('data-act');
          const path = btn.getAttribute('data-path');
          const c2 = cfg();
          if (act === 'toggle') {
            c2.disabledModules = c2.disabledModules || {};
            if (c2.disabledModules[path]) delete c2.disabledModules[path];
            else c2.disabledModules[path] = true;
            setCfg(c2);
            toast('RF', '模块状态已更新');
            renderShell('modules');
          }
          if (act === 'delcache') {
            delCache(path);
            toast('RF', '模块缓存已删除');
            renderShell('modules');
          }
        });
      });

      body.querySelector('#rf-m-enableall').addEventListener('click', () => { const c2=cfg(); c2.disabledModules={}; setCfg(c2); toast('RF','已全部启用'); renderShell('modules'); });
      body.querySelector('#rf-m-disableall').addEventListener('click', () => {
        const c2=cfg(); c2.disabledModules = c2.disabledModules || {};
        list.forEach(i => c2.disabledModules[i.path]=true);
        setCfg(c2); toast('RF','已全部禁用'); renderShell('modules');
      });
      body.querySelector('#rf-m-check').addEventListener('click', async () => {
        toast('RF','正在更新模块缓存…');
        try { await checkAndUpdate({ force:true }); toast('RF','更新完成'); renderShell('modules','更新完成（刷新页面生效）'); }
        catch (e) { setLastError(e); toast('RF',`更新失败：${e?.message || e}`); }
      });
      return;
    }

    if (tab === 'logs') {
      const logs = getLogs().slice().reverse().slice(0, 160);
      const text = logs.map(l => `[${l.at}] ${l.level.toUpperCase()} ${l.message}${l.extra ? ' | ' + l.extra : ''}`).join('\n');
      body.innerHTML = `
        <div class="rf-card">
          <div class="rf-row">
            <button class="rf-btn" id="rf-l-clear">清空日志</button>
            <button class="rf-btn primary" id="rf-l-copy">复制</button>
            <button class="rf-btn" id="rf-l-refresh">刷新</button>
          </div>
          <div style="margin-top:10px;border:1px solid var(--rf-line);border-radius:var(--rf-radius);background:rgba(0,0,0,.04);padding:10px;white-space:pre-wrap;word-break:break-word;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:11px;" id="rf-log-box">${escapeHtml(text || '暂无日志')}</div>
          ${tip ? `<div style="margin-top:8px;font-weight:900;">${escapeHtml(tip)}</div>` : ''}
        </div>
      `;
      body.querySelector('#rf-l-clear').addEventListener('click', () => { GM_setValue(KEY_LOG,'[]'); toast('RF','日志已清空'); renderShell('logs'); });
      body.querySelector('#rf-l-refresh').addEventListener('click', () => { toast('RF','已刷新'); renderShell('logs'); });
      body.querySelector('#rf-l-copy').addEventListener('click', async () => {
        const t = body.querySelector('#rf-log-box')?.textContent || '';
        try { await navigator.clipboard.writeText(t); toast('RF','已复制'); }
        catch { toast('RF','复制失败（权限限制）'); }
      });
      return;
    }

    if (tab === 'changelog') {
      const list = getChangelog();
      body.innerHTML = `
        <div class="rf-card">
          <div style="font-weight:900;color:var(--rf-sub);font-size:11px;">优先显示远程 /changelog.json；没有则显示填充数据。</div>
          <div class="rf-row">
            <button class="rf-btn primary" id="rf-cl-refresh">刷新远程数据</button>
            <button class="rf-btn" id="rf-cl-clear">清空本地缓存</button>
          </div>
          <div id="rf-cl-wrap"></div>
          ${tip ? `<div style="margin-top:8px;font-weight:900;">${escapeHtml(tip)}</div>` : ''}
        </div>
      `;
      const wrap = body.querySelector('#rf-cl-wrap');
      wrap.innerHTML = list.map(x => `
        <div style="margin-top:10px;border:1px solid var(--rf-line);border-radius:var(--rf-radius);padding:12px;background:rgba(255,255,255,.36);">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
            <div style="min-width:0;">
              <div style="font-weight:900;">${escapeHtml(x.title || '更新')}</div>
              <div style="color:var(--rf-sub);font-size:11px;margin-top:2px;">时间：${escapeHtml(x.at || '-')} ｜ 来源：${escapeHtml(x.source || 'remote')}</div>
            </div>
            <div style="font-weight:900;padding:4px 10px;border-radius:999px;border:1px solid var(--rf-line);background:var(--rf-chip);">${escapeHtml(x.version || '-')}</div>
          </div>
          <ul style="margin:10px 0 0;padding-left:18px;">
            ${(x.items || []).map(i => `<li style="margin:6px 0;">${escapeHtml(i)}</li>`).join('')}
          </ul>
        </div>
      `).join('');

      body.querySelector('#rf-cl-clear').addEventListener('click', () => { GM_deleteValue(KEY_CHANGELOG); toast('RF','已清空'); renderShell('changelog'); });
      body.querySelector('#rf-cl-refresh').addEventListener('click', async () => {
        toast('RF','正在刷新…');
        try { await checkAndUpdate({ force:true }); toast('RF','刷新完成'); renderShell('changelog'); }
        catch (e) { setLastError(e); toast('RF',`刷新失败：${e?.message || e}`); }
      });
      return;
    }

    if (tab === 'about') {
      const about = getAbout();
      const mfName = mf?.name || about.name;
      const mfChannel = mf?.channel || about.channel;
      const mfUpdatedAt = mf?.updatedAt || '-';

      body.innerHTML = `
        <div class="rf-card">
          <div style="font-size:16px;font-weight:900;">${escapeHtml(mfName || 'RF')}</div>
          <div style="color:var(--rf-sub);margin-top:4px;">Channel：${escapeHtml(mfChannel || 'stable')} ｜ Remote Version：${escapeHtml(mf?.version || '-')}</div>
          <div style="margin-top:10px;color:var(--rf-text);">${escapeHtml(about.desc || '')}</div>

          <div style="margin-top:12px;">
            <div class="rf-kv"><b>Home</b><div class="v">${escapeHtml(about.home || '-')}</div></div>
            <div class="rf-kv"><b>Contact</b><div class="v">${escapeHtml(about.contact || '-')}</div></div>
            <div class="rf-kv"><b>License</b><div class="v">${escapeHtml(about.license || '-')}</div></div>
            <div class="rf-kv"><b>UpdatedAt</b><div class="v">${escapeHtml(mfUpdatedAt)}</div></div>
          </div>

          <div style="margin-top:10px;">
            <div style="font-weight:900;color:var(--rf-sub);">使用提示</div>
            <ul style="margin:10px 0 0;padding-left:18px;">
              ${(about.tips || []).map(t => `<li style="margin:6px 0;">${escapeHtml(t)}</li>`).join('')}
            </ul>
          </div>

          <div class="rf-row">
            <button class="rf-btn primary" id="rf-ab-refresh">刷新远程数据</button>
          </div>

          ${tip ? `<div style="margin-top:8px;font-weight:900;">${escapeHtml(tip)}</div>` : ''}
        </div>
      `;

      body.querySelector('#rf-ab-refresh').addEventListener('click', async () => {
        toast('RF','正在刷新…');
        try { await checkAndUpdate({ force:true }); toast('RF','刷新完成'); renderShell('about'); }
        catch (e) { setLastError(e); toast('RF',`刷新失败：${e?.message || e}`); }
      });
      return;
    }

    if (CUSTOM_TABS.has(tab)) {
      const t = CUSTOM_TABS.get(tab);
      body.innerHTML = '';
      try {
        const container = document.createElement('div');
        t.render(container);
        body.appendChild(container);
      } catch (e) {
        body.innerHTML = `<div style="padding:10px;color:red;">Render Error: ${escapeHtml(e.message)}</div>`;
      }
      return;
    }
  }

  async function run() {
    GM_registerMenuCommand('RF：打开壳面板', () => openShellUI());
    GM_registerMenuCommand('RF：立即检查更新', async () => {
      toast('RF','正在检查更新…');
      try { await checkAndUpdate({ force:true }); toast('RF','检查完成'); }
      catch (e) { setLastError(e); toast('RF',`检查失败：${e?.message || e}`); }
    });
    GM_registerMenuCommand('RF：清空缓存', () => { clearAllCache(); toast('RF','缓存已清空'); });

    ensureFloatButton();
    if (!document.getElementById(UI.btnId)) {
      document.addEventListener('DOMContentLoaded', () => ensureFloatButton(), { once:true });
    }

    if (!shouldRunOnThisHost()) return;

    try { await checkAndUpdate({ force:false }); }
    catch (e) { setLastError(e); pushLog('error','更新失败，降级使用缓存', e?.message || e); }

    const c = cfg();
    if (c.safeMode) { pushLog('warn','安全模式开启：不执行远程模块'); return; }

    const mf = getLocalManifest();
    if (!mf) { pushLog('warn','本地没有 manifest 缓存（首次安装请打开壳面板→状态→立即检查更新）'); return; }

    const modules = collectModulesToRun(mf);
    for (const path of modules) {
      const code = getCache(path);
      if (!code) { pushLog('warn',`缺少模块缓存：${path}`); continue; }
      try { runCachedModule(path, code); pushLog('info',`模块已执行：${path}`); }
      catch (e) { setLastError(e); pushLog('error',`模块执行失败：${path}`, e?.message || e); }
    }
  }

  run().catch(e => { setLastError(e); pushLog('error','Bootstrap Fatal', e?.message || e); });
})();
