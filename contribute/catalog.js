/* Displays only the server's explicitly published game snapshots. Never executes submissions. */
(() => {
  'use strict';
  const root = document.getElementById('community-games'); if (!root) return;
  const core = window.ContributionCore, list = root.querySelector('.community-grid'), status = root.querySelector('.community-status'), more = root.querySelector('.community-more');
  if (!core) { status.textContent = '目前無法讀取投稿遊戲，請稍後再來。'; return; }
  const node = (tag,text,className) => { const out = document.createElement(tag); if (text !== undefined) out.textContent = text; if (className) out.className = className; return out; };
  const external = (text,url) => { const link = node('a',text); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.referrerPolicy = 'no-referrer'; return link; };
  let api = '', offset = 0, loading = false, shown = 0; const seen = new Set();
  function card(item) {
    if (!item || typeof item.id !== 'string' || seen.has(item.id) || typeof item.title !== 'string' || !item.title.trim() || item.title.length > 100 || typeof item.summary !== 'string' || !item.summary.trim() || item.summary.length > 1200 || !/^[a-f\d]{40}$/i.test(item.commitSha || '')) return null;
    const repo = core.repository(item.repoUrl); if (!repo) return null;
    const article = node('article',undefined,'community-card'), image = node('div',undefined,'community-cover'), cover = core.localCover(item.coverPath);
    if (cover) { const img = node('img'); img.src = cover; img.alt = item.title + ' 核准封面'; img.width = 1200; img.height = 630; img.loading = 'lazy'; img.addEventListener('error', () => { img.remove(); image.append(node('span',item.title)); },{once:true}); image.append(img); }
    else { image.append(node('small','COMMUNITY / WEB GAME'),node('span',item.title)); }
    article.append(image);
    const copy = node('div',undefined,'community-copy'); copy.append(node('p','審稿後收錄','community-tag'),node('h3',item.title),node('p',item.summary,'community-description'));
    if (typeof item.creditName === 'string' && item.creditName.length <= 60) copy.append(node('p','作者署名：' + item.creditName,'community-credit'));
    const meta = node('dl');
    const repoRow = node('div'); repoRow.append(node('dt','公開原始碼'),node('dd')); repoRow.lastChild.append(external(repo.replace('https://github.com/','') + ' ↗',repo));
    const shaRow = node('div'); shaRow.append(node('dt','收錄版本'),node('dd')); shaRow.lastChild.append(external(item.commitSha,repo + '/tree/' + item.commitSha));
    const licenseRow = node('div'); licenseRow.append(node('dt','程式授權'),node('dd',typeof item.license === 'string' ? item.license.slice(0,120) : '請見原始碼'));
    meta.append(repoRow,shaRow,licenseRow); copy.append(meta);
    if (typeof item.externalServices === 'string') copy.append(node('p','外部服務與資料處理：' + item.externalServices.slice(0,1000),'community-description'));
    const game = core.publicHttps(item.gameUrl);
    if (game) { const link = external('第三方試玩 ↗',game); link.className = 'community-play'; copy.append(link); }
    else copy.append(node('p','目前未提供線上試玩，執行方式請見公開原始碼。','community-no-demo'));
    article.append(copy); seen.add(item.id); return article;
  }
  async function load() {
    if (loading || !api) return; loading = true; more.disabled = true; status.textContent = '正在讀取已發布的投稿遊戲…'; root.setAttribute('aria-busy','true');
    try {
      const url = new URL(api); url.searchParams.set('action','games'); url.searchParams.set('offset',String(offset)); url.searchParams.set('limit','24');
      const response = await fetch(url,{credentials:'omit',referrerPolicy:'no-referrer'}); if (!response.ok) throw new Error('unavailable');
      const raw = await response.text(); if (raw.length > 250000) throw new Error('oversize'); const result = JSON.parse(raw);
      if (!Array.isArray(result.items) || result.items.length > 100) throw new Error('invalid');
      for (const item of result.items) { const itemCard = card(item); if (itemCard) { list.append(itemCard); shown++; } }
      status.textContent = shown ? '已列出 ' + shown + ' 款已發布投稿。試玩會前往第三方網站，請先查看來源與版本。' : '目前尚無已發布的投稿遊戲。你可以先玩上方兩款，或投稿自己的作品。';
      const next = result.nextOffset;
      more.hidden = !(result.hasMore === true && Number.isSafeInteger(next) && next > offset && next <= 1000);
      if (!more.hidden) offset = next;
      more.textContent = '再看更多投稿遊戲';
    } catch { status.textContent = shown ? '已保留目前載入的遊戲，下一批暫時無法讀取。請稍後重試。' : '目前無法讀取投稿遊戲，請稍後再試。上方兩款遊戲仍可照常遊玩。'; more.hidden = false; more.textContent = '重新讀取'; }
    finally { loading = false; more.disabled = false; root.removeAttribute('aria-busy'); }
  }
  more.addEventListener('click',load);
  (async () => {
    try {
      const response = await fetch('/contribute/config.json?v=15',{credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'}); if (!response.ok) throw new Error('config');
      const raw = await response.text(); if (raw.length > 8000) throw new Error('config'); const config = JSON.parse(raw); api = core.publicHttps(config.apiUrl) || '';
      if (api && !(new URL(api).search || new URL(api).hash)) await load();
      else { api = ''; status.textContent = '投稿收件與社群遊戲列表尚未開放。你可以先準備作品資料；已開放的兩款遊戲照常遊玩。'; }
    } catch { status.textContent = '目前無法確認社群遊戲列表，請稍後再來。上方兩款遊戲仍可照常遊玩。'; }
  })();
})();
