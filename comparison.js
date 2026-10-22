'use strict';

(() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const arr = value => Array.isArray(value) ? value : [];
  const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const fmt = value => Number.isFinite(Number(value)) ? Number(value).toLocaleString('zh-TW', {maximumFractionDigits:1}) : '—';
  const pct = value => `${fmt(value)}%`;
  const synchrony = score => 100-num(score);
  const signed = value => `${num(value) > 0 ? '+' : num(value) < 0 ? '−' : ''}${fmt(Math.abs(num(value)))}`;
  const width = value => Math.max(0, Math.min(100, num(value)));
  const safeUrl = value => /^(https?:\/\/|\.\/)/i.test(String(value || '')) ? String(value) : '';
  const roles = {primary:'主提案', joint:'共同提案'};
  // Presentation bands use the raw absolute percentage-point gap, before rounding.
  const sealGrades = [
    {code:'large', min:20, lines:['差很大'], range:'20 百分點以上'},
    {code:'marked', min:10, lines:['差多多'], range:'10 至未滿 20 百分點'},
    {code:'some', min:3, lines:['有點差'], range:'3 至未滿 10 百分點'},
    {code:'near', min:0, lines:['差一點'], range:'未滿 3 百分點'}
  ];
  const noTopicSeal = {code:'none', lines:['完全沒有']};
  function comparisonSeal(row) {
    const leg = Number(row.legPct), policy = Number(row.policyPct);
    const gap = Math.abs(Number(row.deltaPp));
    if (![leg, policy, gap].every(Number.isFinite)) return null;
    const grade = leg === 0 && policy === 0 ? noTopicSeal : sealGrades.find(item => gap >= item.min);
    const zeroLabel = leg === 0 && policy > 0 ? `${roles[state.role]} 0%` : policy === 0 && leg > 0 ? '官網 0%' : '';
    return {grade, gap, zeroLabel};
  }
  function sealMarkup(grade, mini = false) {
    return `<span class="cmp-seal cmp-seal-${grade.code}${mini ? ' cmp-seal-mini' : ''}"><span class="cmp-seal-text">${grade.lines.map(line => `<span>${esc(line)}</span>`).join('')}</span></span>`;
  }
  let stopSealEffects = () => {};
  function observeComparisonSeals() {
    stopSealEffects();
    const cells = [...root.querySelectorAll('.cmp-chart-with-stamps .cmp-stamp-cell')];
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motion.matches || !window.IntersectionObserver || !Element.prototype.animate) return;
    const timers = new Set(), animations = new Set(), seen = new WeakSet();
    let active = true, lastImpactAt = -1000, shake = null;
    const track = animation => {
      animations.add(animation);
      animation.finished.catch(() => {}).finally(() => animations.delete(animation));
      return animation;
    };
    const later = (fn, delay) => {
      const timer = setTimeout(() => {timers.delete(timer); if (active) fn();}, delay);
      timers.add(timer);
    };
    const impact = () => {
      if (!active || motion.matches || performance.now() - lastImpactAt < 400) return;
      lastImpactAt = performance.now();
      shake?.cancel();
      document.documentElement.classList.add('cmp-stamp-impact');
      shake = track(document.body.animate([
        {transform:'translate3d(0,0,0)'}, {transform:'translate3d(-11px,7px,0)'},
        {transform:'translate3d(9px,-5px,0)'}, {transform:'translate3d(-6px,4px,0)'},
        {transform:'translate3d(4px,-2px,0)'}, {transform:'translate3d(-2px,1px,0)'},
        {transform:'translate3d(0,0,0)'}
      ], {duration:240, easing:'ease-out'}));
      const currentShake=shake;
      currentShake.finished.catch(() => {}).finally(() => {
        if (shake===currentShake) document.documentElement.classList.remove('cmp-stamp-impact');
      });
    };
    const observer = new IntersectionObserver(entries => {
      entries.filter(entry => entry.isIntersecting && entry.intersectionRatio >= .45 && !seen.has(entry.target))
        .sort((a,b) => a.boundingClientRect.top - b.boundingClientRect.top)
        .forEach((entry,index) => {
          const cell = entry.target, seal = cell.querySelector('.cmp-seal');
          seen.add(cell); observer.unobserve(cell);
          later(() => {
            seal?.classList.remove('cmp-seal-await');
            if (!seal || motion.matches) return;
            const rotation = parseFloat(getComputedStyle(seal).getPropertyValue('--cmp-seal-rotate')) || 0;
            const drop = Math.max(500, cell.getBoundingClientRect().top + 200);
            track(seal.animate([
              {transform:`translate3d(60px,-${drop}px,0) scale(3.8) rotate(${rotation-17}deg)`,opacity:0,offset:0},
              {transform:`translate3d(35px,-${drop*.55}px,0) scale(2.9) rotate(${rotation-10}deg)`,opacity:1,offset:.22},
              {transform:`translate3d(0,-24px,0) scale(1.35) rotate(${rotation-3}deg)`,opacity:1,offset:.62},
              {transform:`translate3d(0,3px,0) scale(.86) rotate(${rotation}deg)`,opacity:1,offset:.72},
              {transform:`translate3d(0,-2px,0) scale(1.055) rotate(${rotation}deg)`,opacity:1,offset:.86},
              {transform:`translate3d(0,0,0) scale(1) rotate(${rotation}deg)`,opacity:1,offset:1}
            ], {duration:620,easing:'cubic-bezier(.18,.7,.25,1)'}));
            later(impact,440);
          }, index*110);
        });
    }, {threshold:.45});
    cells.forEach(cell => {cell.querySelector('.cmp-seal')?.classList.add('cmp-seal-await'); observer.observe(cell);});
    const cleanup = () => {
      active=false; observer.disconnect(); timers.forEach(clearTimeout); timers.clear();
      animations.forEach(animation => animation.cancel()); animations.clear();
      document.documentElement.classList.remove('cmp-stamp-impact');
      cells.forEach(cell => cell.querySelector('.cmp-seal')?.classList.remove('cmp-seal-await'));
      motion.removeEventListener('change',cleanup);
    };
    motion.addEventListener('change',cleanup);
    stopSealEffects=cleanup;
  }
  window.addEventListener('pagehide', () => stopSealEffects());
  const periods = {all:'全期', pre:'正式提名前', post:'正式提名起'};
  const weightings = {document:'每件法案算一件', bundle:'相關修法合併算一組'};
  const codings = {main:'每案選一個主要目的', fractional:'多個主題平均分配'};
  const state = {data:null, role:'primary', period:'all', weighting:'document', coding:'main', search:'',temporalAxis:'target', ledgerType:'legislation', ledgerTopic:'', visible:20};
  let root;

  const topicName = id => arr(state.data.categories).find(category => category.id === id)?.name || id || '待分類';
  const currentView = () => arr(state.data.views).find(view => view.role === state.role && view.period === state.period && view.weighting === state.weighting && view.coding === state.coding);
  const periodDocs = docs => arr(docs).filter(doc => {
    if (state.period === 'all') return true;
    const boundary = state.data.meta?.timeCut?.date || '2026-05-13';
    if (!doc.date) return false;
    return state.period === 'pre' ? doc.date < boundary : doc.date >= boundary;
  });

  function sourceLink(source, fallbackLabel) {
    if (Array.isArray(source)) return source.map(item => sourceLink(item, fallbackLabel)).join('、');
    const url = safeUrl(typeof source === 'string' ? source : source?.url || source?.sourceUrl);
    const label = typeof source === 'object' ? source?.title || source?.label || fallbackLabel : fallbackLabel;
    return url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>` : '';
  }

  function shell() {
    const counts = {primary:arr(state.data.documents?.primary).length, joint:arr(state.data.documents?.joint).length};
    const policyCount = arr(state.data.documents?.policy).length;
    root.classList.add('section','cmp-section');
    root.setAttribute('aria-labelledby','cmp-title');
    root.innerHTML = `<div class="wrap">
      <div class="section-heading cmp-heading"><div><p class="section-number">第一個比較 ／ 立院提案 vs. 競選政策</p><h2 id="cmp-title">在立院提的案，<br>和競選政策有多像？</h2></div><p class="section-deck">一邊是提過的法律案，<br>一邊是官網提出的政策。</p></div>
      <p class="cmp-intro">把法律案和官網 ${fmt(policyCount)} 頁政策，按照「想解決什麼問題」分成同樣的 12 類。<strong>看看兩邊各把多少比重放在哪些事。</strong></p>
      <details class="cmp-reading-help"><summary>先了解比較範圍 <span aria-hidden="true">＋</span></summary><p>這裡按「修法想解決的問題」分類，和前面按「法案管什麼人、什麼事」的分法不同。立委和市長的工作也不同；這個比例是在比較議題，不是在評分政策真假。</p><p>分類由 AI 輔助逐案整理，屬探索性比較，尚未經獨立人類雙盲編碼或效度驗證。可展開下方的逐案資料與計算方法檢查。</p></details>
      <form class="cmp-controls" aria-label="調整政策分布比較口徑">
        <details class="cmp-role-advanced"><summary>進階：共同提案 ＋</summary><label><span>立法參與角色</span><select data-cmp-control="role"><option value="primary">主提案 ${fmt(counts.primary)} 件</option><option value="joint">共同提案 ${fmt(counts.joint)} 件</option></select></label></details>
        <label><span>立法提案期間</span><select data-cmp-control="period"><option value="all">全期（含提名後）</option><option value="pre">正式提名前</option><option value="post">正式提名起</option></select></label>
        <label><span>法案怎麼計數？</span><select data-cmp-control="weighting"><option value="document">每件法案算一件</option><option value="bundle">相關修法合併算一組</option></select></label>
        <label><span>一案有多個主題時？</span><select data-cmp-control="coding"><option value="main">選一個主要目的</option><option value="fractional">平均分給相關主題</option></select></label>
      </form>
      <div class="cmp-period-note" id="cmp-period-note"></div>
      <div id="cmp-result" aria-live="polite" aria-atomic="true"></div>
      <details class="cmp-detail cmp-sensitivity"><summary>換一種算法，結果會差多少？<span aria-hidden="true">＋</span></summary><div id="cmp-sensitivity"></div></details>
      <div id="cmp-temporal"></div>
      <div id="cmp-policy-rings"></div>
      <details class="cmp-detail cmp-ledger" id="cmp-ledger"><summary>逐案分類帳：${fmt(counts.primary + counts.joint)} 件法律案＋${fmt(policyCount)} 頁政策<span aria-hidden="true">＋</span></summary>
        <div class="cmp-ledger-content"><p class="cmp-note">預設只列目前角色及期間的法律案；可切換看政策頁。主分類模式只依主要目的篩選，複選模式才納入附加主題。點選主題圖的名稱，可查看對應紀錄。主提案係提案名單第一位，單憑排序無法確認由哪個辦公室獨立起草。</p>
          <div class="cmp-ledger-controls"><label class="cmp-search"><span class="sr-only">搜尋分類帳編號或標題</span><input data-cmp-search type="search" placeholder="搜尋案號、標題或政策頁名稱…" autocomplete="off"></label>
            <label><span class="sr-only">分類帳資料類型</span><select data-cmp-ledger="ledgerType"><option value="all">法律案與政策頁</option><option value="legislation" selected>只看法律案</option><option value="policy">只看政策頁</option></select></label>
            <label><span class="sr-only">分類帳主題</span><select data-cmp-ledger="ledgerTopic"><option value="">所有主題</option>${arr(state.data.categories).map(category => `<option value="${esc(category.id)}">${esc(category.name)}</option>`).join('')}</select></label>
          </div><p id="cmp-ledger-count" class="cmp-note" aria-live="polite"></p><div id="cmp-ledger-list"></div><button type="button" class="cmp-more" data-cmp-more hidden>再顯示 20 筆 ↓</button>
        </div>
      </details>
      <details class="cmp-detail cmp-method"><summary>計算方法、來源與解讀界限<span aria-hidden="true">＋</span></summary><div id="cmp-method"></div></details>
    </div>`;
    root.querySelector('form').addEventListener('submit', event => event.preventDefault());
    root.addEventListener('change', event => {
      const control = event.target.dataset.cmpControl;
      const ledger = event.target.dataset.cmpLedger;
      if (control && ['role','period','weighting','coding'].includes(control)) {
        state[control] = event.target.value;
        state.visible = 20;
        render();
      } else if (ledger && ['ledgerType','ledgerTopic'].includes(ledger)) {
        state[ledger] = event.target.value;
        state.visible = 20;
        renderLedger();
      }
    });
    root.addEventListener('input', event => {
      if (!event.target.matches('[data-cmp-search]')) return;
      state.search = event.target.value;
      state.visible = 20;
      renderLedger();
    });
    root.addEventListener('click', event => {
      const axis=event.target.closest('[data-cmp-temporal-axis]');if(axis){state.temporalAxis=axis.dataset.cmpTemporalAxis;renderTemporal();return;}
      const more = event.target.closest('[data-cmp-more]');
      if (more) { state.visible += 20; renderLedger(); return; }
      const topic = event.target.closest('[data-cmp-topic]');
      if (!topic) return;
      state.ledgerTopic = topic.dataset.cmpTopic;
      state.search = '';
      state.ledgerType = 'legislation';
      state.visible = 20;
      root.querySelector('[data-cmp-search]').value = '';
      root.querySelector('[data-cmp-ledger="ledgerTopic"]').value = state.ledgerTopic;
      root.querySelector('[data-cmp-ledger="ledgerType"]').value = 'legislation';
      const ledger = root.querySelector('#cmp-ledger');
      ledger.open = true;
      renderLedger();
      ledger.scrollIntoView({behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block:'start'});
      ledger.querySelector('summary').focus({preventScroll:true});
    });
  }

  function render() {
    const view = currentView();
    const cut = state.data.meta?.timeCut || {};
    const cutDate = cut.date || '2026-05-13';
    root.querySelector('#cmp-period-note').innerHTML = `<span class="cmp-note-dot" aria-hidden="true"></span><p>切點：<strong>${esc(cutDate)} 正式提名</strong>，不代表競選活動開始日。全期包含提名後法案。${sourceLink(cut.source,'提名時間來源')}</p>`;
    if (!view) {
      root.querySelector('#cmp-result').innerHTML = '<p class="cmp-empty" role="status">這組比較口徑尚無資料，請切換其他選項。</p>';
      root.querySelector('#cmp-sensitivity').innerHTML = '';
      renderTemporal(); renderPolicyRings(); renderLedger(); renderMethod();
      return;
    }
    const policyUnits = view.policyUnits || arr(state.data.documents?.policy).length;
    const unitLabel = state.weighting === 'bundle' ? '組修法套案' : '件法律案';
    const rows = arr(view.rows);
    root.querySelector('#cmp-result').innerHTML = `
      <div class="cmp-summary"><div class="cmp-score-panel"><p class="cmp-kicker">兩邊主題比例重疊的部分</p><p class="cmp-score"><strong>${fmt(view.overlap)}</strong><span>%</span></p><div class="cmp-score-track" role="img" aria-label="主題同步率 ${esc(fmt(view.overlap))}%，0%無主題權重交集，100%同分布"><span style="width:${width(view.overlap)}%"></span></div><div class="cmp-score-scale"><span>0% 完全不同</span><span>100% 分布相同</span></div></div>
        <div class="cmp-reading"><p class="cmp-kicker">這個數字怎麼讀？</p><p>主題比例重疊 <strong>${pct(view.overlap)}</strong>。<br>數字越低，兩邊關注的議題組合越不同。</p><p class="cmp-note">這不是「有幾件一樣的法案」，也不是政見兌現率。立委與市長的工作不同，仍要搭配具體內容看。</p><details class="cmp-original-score"><summary>原始相異分數與換算 ＋</summary><p>相異 ${fmt(view.score)} 分；同步率 = 100 − 相異分數 = ${pct(view.overlap)}。分類、資料及權重不變。</p></details><p class="cmp-view-label">${esc(roles[state.role])} · ${esc(periods[state.period])} · ${esc(weightings[state.weighting])} · ${esc(codings[state.coding])}</p></div>
      </div>
      <div class="cmp-chart-head"><div><h3>哪些議題多，哪些議題少？</h3><p>${esc(roles[state.role])} ${fmt(view.nDocuments)} 件法律案${state.weighting === 'bundle' ? ` → ${fmt(view.nUnits)} 組套案` : ''}，對照官網 ${fmt(policyUnits)} 個政策套案頁。</p></div><span class="cmp-chart-key"><i class="cmp-leg-key"></i>${esc(roles[state.role])}<i class="cmp-policy-key"></i>競選政策</span></div>
      <div class="cmp-stamp-guide"><h4>看中間的章，一眼讀懂比重差距。</h4><p>按兩欄比例相差幾個百分點分級；章看的是議題比重，不代表立場是否相同。</p><ul class="cmp-stamp-legend">${sealGrades.map(grade => `<li>${sealMarkup(grade, true)}<span>${grade.range}</span></li>`).join('')}</ul><div class="cmp-stamp-empty-example">${sealMarkup(noTopicSeal, true)}<p>灰章「完全沒有」只指兩邊在目前分類皆為 0%。單邊為 0% 則在章下註明。</p></div></div>
      <div class="cmp-chart cmp-chart-with-stamps" role="table" aria-label="立法與競選政策主題分布比較">
        <div class="cmp-chart-row cmp-chart-labels" role="row"><span role="columnheader">主題 · 點選查原案</span><span role="columnheader">${esc(roles[state.role])}<small>共 ${fmt(view.nUnits)} ${unitLabel}</small></span><span class="cmp-stamp-heading" role="columnheader">比重差距<small>看中間的章</small></span><span role="columnheader">競選官網政策<small>共 ${fmt(policyUnits)} 頁</small></span><span role="columnheader">差距<small>政策－立法</small></span></div>
        ${rows.map(row => {
          const category = arr(state.data.categories).find(item => item.id === row.id);
          const seal = comparisonSeal(row);
          return `<div class="cmp-chart-row" role="row" data-cmp-grade="${seal?.grade.code || 'unavailable'}" data-gap-pp="${seal?.gap ?? ''}"><div class="cmp-topic-cell" role="cell"><button type="button" class="cmp-topic-button" data-cmp-topic="${esc(row.id)}" title="${esc(category?.definition || '')}">${esc(row.name || topicName(row.id))}<span aria-hidden="true">↗</span></button></div><div class="cmp-bar-cell cmp-leg-cell" role="cell"><span class="cmp-bar-label">${esc(roles[state.role])}</span><div class="cmp-bar-track"><span class="cmp-bar cmp-leg-bar" style="width:${width(row.legPct)}%"></span></div><span class="cmp-bar-value">${pct(row.legPct)}</span></div><div class="cmp-stamp-cell" role="cell">${seal ? sealMarkup(seal.grade) + (seal.zeroLabel ? `<small class="cmp-zero-tag">${esc(seal.zeroLabel)}</small>` : '') : '<span>資料不足</span>'}</div><div class="cmp-bar-cell cmp-policy-cell" role="cell"><span class="cmp-bar-label">競選官網政策</span><div class="cmp-bar-track"><span class="cmp-bar cmp-policy-bar" style="width:${width(row.policyPct)}%"></span></div><span class="cmp-bar-value">${pct(row.policyPct)}</span></div><span class="cmp-delta ${num(row.deltaPp) > 0 ? 'cmp-positive' : num(row.deltaPp) < 0 ? 'cmp-negative' : ''}" role="cell"><span class="cmp-delta-label">差距（政策－立法）</span><span class="cmp-delta-value">${signed(row.deltaPp)}</span><small>百分點</small></span></div>`;
        }).join('')}
      </div><details class="cmp-reading-help"><summary>這張長條圖怎麼分類？ <span aria-hidden="true">＋</span></summary><p class="cmp-chart-foot">兩邊各自加總為 100%。${state.coding === 'fractional' ? '同一案有多個主題時，平均分給這些主題，所以計算件數可能出現小數。' : '每份法案或政策頁只選一個主要目的；其他相關主題仍保留在逐案資料中。'}${state.weighting === 'bundle' ? '相關修法先合併成一組，每組算一次；組內各案再按主題平均。' : ''}四捨五入後，顯示值可能有些微差異。印章按未四捨五入的絕對差分級；分級是閱讀提示，並非統計檢定。此分類將 6 件主提案及 4 件共同提案的職場育兒修法歸勞動類；前面按「法案管什麼」分類時，軍職法案仍歸國防／軍職制度。</p></details><p class="cmp-zero-note">${state.coding === 'fractional' ? '0% 表示依目前分類，沒有比例分配到這個主題；不等於完全沒有相關內容。' : '0% 不代表完全沒碰過這個議題，只代表沒有案件以它作為主要目的。切換「平均分給相關主題」可把次要主題也算進來。'}</p>`;
    observeComparisonSeals();
    renderSensitivity(view);
    renderTemporal();
    renderPolicyRings();
    renderLedger();
    renderMethod();
  }

  function renderSensitivity(view) {
    const related = arr(state.data.views).filter(item => item.role === state.role && item.period === state.period).sort((a,b) => (a.weighting === 'document' ? 0 : 2) + (a.coding === 'main' ? 0 : 1) - (b.weighting === 'document' ? 0 : 2) - (b.coding === 'main' ? 0 : 1));
    const alternative = view.alternativeRange;
    const leave = view.leaveOneOut;
    root.querySelector('#cmp-sensitivity').innerHTML = `<div class="cmp-sensitivity-content"><p class="cmp-note">以下保留相同角色與期間。分類、拆案方式及政策頁篇幅都會影響同步率；各種口徑一併呈現。</p><div class="cmp-scenario-grid">${related.map(item => `<div class="cmp-scenario ${item.key === view.key ? 'cmp-scenario-current' : ''}"><p>${esc(weightings[item.weighting] || item.weighting)}</p><span>${esc(codings[item.coding] || item.coding)}</span><strong>${fmt(synchrony(item.score))}<small>% 同步</small></strong></div>`).join('')}</div><div class="cmp-range-grid">${alternative ? `<div><h4>政策頁其他合理主類</h4><strong>${fmt(synchrony(alternative.max))}–${fmt(synchrony(alternative.min))}<small>% 同步</small></strong><p>依已列出的 ${fmt(Array.isArray(alternative.scenarios) ? alternative.scenarios.length : alternative.scenarios)} 個替代分類情境重算。這是情境範圍，並非統計信賴區間。</p></div>` : ''}${leave ? `<div><h4>12 頁政策逐次留一頁</h4><strong>${fmt(synchrony(leave.max))}–${fmt(synchrony(leave.min))}<small>% 同步</small></strong><p>每次移除一頁政策，重新正規化後重算，檢視單一頁面對結果的影響。</p></div>` : ''}</div></div>`;
  }

  function renderTemporal() {
    const target=state.role==='primary'&&state.temporalAxis==='target';
    const temporal=arr(target?state.data.temporalTargets:state.data.temporal).find(item=>item.role===state.role);
    const cats=arr(target?state.data.targetCategories:state.data.categories),topicKey=target?'targetTopic':'mainTopic';
    const temporalPurpose=arr(state.data.temporal).find(t=>t.role===state.role),temporalTarget=arr(state.data.temporalTargets).find(t=>t.role===state.role);
    const container = root.querySelector('#cmp-temporal');
    if (!temporal) { container.innerHTML = ''; return; }
    const colors=['#244c41','#cc6042','#b19a52','#7a9c87','#586a87','#9a6b72','#8a9270','#d7956c','#747065','#557f91','#b1b9a3','#b78649'];
    const colorFor=id=>colors[cats.findIndex(c=>c.id===id)%colors.length];
    const documents=arr(state.data.documents?.[state.role]);
    const cut=state.data.meta.timeCut.date;
    const focus=(period,n)=>{
      const docs=documents.filter(d=>period==='pre'?d.date<cut:d.date>=cut);
      const counts=cats.map(c=>({...c,count:docs.filter(d=>d[topicKey]===c.id).length}));
      const maximum=Math.max(0,...counts.map(c=>c.count));
      const leaders=counts.filter(c=>maximum>0&&c.count===maximum);
      return leaders.length ? leaders.map(c=>'「'+esc(c.name)+'」').join('、')+'，'+(leaders.length>1?'各 ':'')+maximum+'／'+n+' 件。' : '這個時期尚無可比較的法案。';
    };
    const donut=(period,n,label,dateLabel)=>{
      const docs=documents.filter(d=>period==='pre'?d.date<cut:d.date>=cut),radius=72,circ=2*Math.PI*radius;let offset=0;
      const groups=cats.map(c=>({...c,count:docs.filter(d=>d[topicKey]===c.id).length})).filter(c=>c.count);
      const arcs=groups.map(c=>{const len=c.count/n*circ,o=offset;offset+=len;return '<circle cx="110" cy="110" r="72" fill="none" stroke="'+colorFor(c.id)+'" stroke-width="34" stroke-dasharray="'+len+' '+circ+'" stroke-dashoffset="'+(-o)+'" transform="rotate(-90 110 110)"><title>'+esc(c.name)+' '+c.count+'件（'+pct(c.count/n*100)+'）</title></circle>';}).join('');
      return '<div class="cmp-pie-panel"><h4>'+label+'</h4><p class="cmp-pie-date">'+dateLabel+'</p><svg viewBox="0 0 220 220" role="img" aria-label="'+esc(label+'，'+n+'件，'+groups.map(c=>c.name+c.count+'件').join('，'))+'">'+arcs+'<text x="110" y="107" text-anchor="middle" class="cmp-pie-total">'+n+'</text><text x="110" y="130" text-anchor="middle" class="cmp-pie-unit">件'+roles[state.role]+'</text></svg><ul>'+groups.map(c=>'<li><i style="background:'+colorFor(c.id)+'"></i><span>'+esc(c.name)+'</span><strong>'+c.count+'<small> ／ '+pct(c.count/n*100)+'</small></strong></li>').join('')+'</ul></div>';
    };
    container.innerHTML = `<div class="cmp-temporal-card">
      <div><p class="cmp-kicker">第二個比較 ／ 提名前 vs. 提名後</p><h3>提名前後，<br>他提的法案重點變了嗎？</h3><p class="cmp-story-intro">把 ${fmt(temporal.nPre+temporal.nPost)} 件${esc(roles[state.role])}分成兩段：<strong>提名前 ${fmt(temporal.nPre)} 件，提名後 ${fmt(temporal.nPost)} 件。</strong><br>左右對照，看看各類法案占多少。</p></div>
      <div class="cmp-temporal-score"><strong>${fmt(synchrony(temporal.score))}<span>%</span></strong><span>主題比例重疊</span></div>
      <p class="cmp-score-explainer">數字越低，兩個時期的提案重點越不同。<span>0% 完全不同 · 100% 分布相同</span></p>
      ${temporalTarget?`<div class="cmp-axis-tabs" aria-label="選擇法案分類方式"><button type="button" data-cmp-temporal-axis="target" aria-pressed="${target}">看法案管什麼</button><button type="button" data-cmp-temporal-axis="purpose" aria-pressed="${!target}">看修法想解決什麼</button></div>`:''}
      <p class="cmp-axis-example">${target?'例如：軍人的法案，歸在「國防／軍職制度」。':'例如：軍人育兒留停的修法，按目的歸在「職場育兒」。'}</p>
      <div class="cmp-focus-pair" aria-label="兩個時期的主要議題"><p><span>提名前，最多的是</span>${focus('pre',temporal.nPre)}</p><p><span>提名後，最多的是</span>${focus('post',temporal.nPost)}</p></div>
      <div class="cmp-pair">${donut('pre',temporal.nPre,'提名前','2024.02.01–2026.05.12')}${donut('post',temporal.nPost,'提名後','2026.05.13–2026.10.20')}</div>
      <p class="cmp-temporal-caution">同一類用同一個顏色。這裡只比較兩期的法律案；兩期長短、會期和議程不同，數字本身不能說明改變原因。</p>
      <details class="cmp-story-method"><summary>這個比例怎麼算？ <span aria-hidden="true">＋</span></summary><div><p>以 2026 年 5 月 13 日正式提名日分段，提名後包含提名當天。兩期共 ${fmt(temporal.nPre+temporal.nPost)} 件${esc(roles[state.role])}，每件法案都算一件；每期各自加總為 100%。</p><p>目前按${target?'「法案管什麼人、什麼事」分類（規範對象／制度領域）':'「修法想解決什麼問題」分類（主要內容目的）'}。兩期使用同一套規則，每件案只放進一個主要類別。</p><p>各類比例取兩期較小的數字，再全部加起來，就是重疊率。例如：同一類在兩期占 30% 和 10%，這一類就貢獻 10% 的重疊。</p><p>重疊率 ${pct(synchrony(temporal.score))} = 100 − 原始相異分數 ${fmt(temporal.score)}。這是原先的「主題同步率」，不是相同法案件數，也不是人格或誠信評分。</p><p>這組只比較提名前後的法律案，和上方「法律案對競選政策」分開計算；上方的期間、套案與複選設定不會改變這組算法。</p></div></details>
      <details><summary>看各類的完整比例 <span aria-hidden="true">＋</span></summary><div class="cmp-temporal-table"><div class="cmp-temporal-row cmp-temporal-head"><span>主題</span><span>提名前</span><span>提名後</span></div>${arr(temporal.rows).filter(row => num(row.prePct) || num(row.postPct)).map(row => `<div class="cmp-temporal-row"><span>${esc(row.name || topicName(row.id))}</span><span>${pct(row.prePct)}</span><span>${pct(row.postPct)}</span></div>`).join('')}</div></details>
    </div>`;
  }

  function renderPolicyRings() {
    const container = root.querySelector('#cmp-policy-rings');
    const view = currentView();
    if (!view) { container.innerHTML = ''; return; }
    const categories = arr(state.data.categories);
    const colors = ['#244c41','#cc6042','#b19a52','#7a9c87','#586a87','#9a6b72','#8a9270','#d7956c','#747065','#557f91','#b1b9a3','#b78649'];
    const rows = categories.map((category, index) => ({...category, ...arr(view.rows).find(row => row.id === category.id), color:colors[index % colors.length]}));
    const policyUnits = view.policyUnits || arr(state.data.documents?.policy).length;
    const unitLabel = state.weighting === 'bundle' ? '組修法套案' : '件法律案';
    const unitShort = state.weighting === 'bundle' ? '組修法套案' : '件' + roles[state.role];
    const arcPath = (radius, startPct, lengthPct) => {
      const point = value => {
        const angle = (value / 100 * 360 - 90) * Math.PI / 180;
        return [150 + radius * Math.cos(angle), 150 + radius * Math.sin(angle)];
      };
      const start = point(startPct), end = point(startPct + lengthPct);
      if (lengthPct >= 99.999999) {
        const middle = point(startPct + lengthPct / 2);
        return `M ${start.join(' ')} A ${radius} ${radius} 0 1 1 ${middle.join(' ')} A ${radius} ${radius} 0 1 1 ${end.join(' ')}`;
      }
      return `M ${start.join(' ')} A ${radius} ${radius} 0 ${lengthPct > 50 ? 1 : 0} 1 ${end.join(' ')}`;
    };
    const actualRing = kind => {
      let offset = 0;
      return rows.map(row => {
        const share = num(kind === 'legislation' ? row.legPct : row.policyPct);
        const start = offset; offset += share;
        if (!share) return '';
        const label = `${row.name}；${kind === 'legislation' ? roles[state.role] : '官網政策'}內圈實際分布 ${pct(share)}。國會實際 ${pct(row.legPct)}，政策實際 ${pct(row.policyPct)}；同類交集 ${pct(Math.min(num(row.legPct),num(row.policyPct)))}，國會基準缺口 ${pct(Math.max(0,num(row.legPct)-num(row.policyPct)))}`;
        return `<path d="${arcPath(87,start,share)}" fill="none" stroke="${row.color}" stroke-width="30" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title></path>`;
      }).join('');
    };
    const baselineRing = kind => {
      let offset = 0;
      return rows.map(row => {
        const baseline = num(row.legPct), start = offset;
        offset += baseline;
        if (!baseline) return '';
        const overlap = Math.min(baseline,num(row.policyPct));
        const filled = kind === 'legislation' ? baseline : overlap;
        const missing = baseline - filled;
        const label = `${row.name}；國會實際 ${pct(baseline)}，政策實際 ${pct(row.policyPct)}；同類交集 ${pct(overlap)}，國會基準缺口 ${pct(baseline-overlap)}`;
        const emptyArc = missing > 1e-9 ? `<g class="cmp-ring-gap" role="img" aria-label="${esc(label)}"><title>${esc(label)}。虛線為國會基準的未交集部分，不是政策占比。</title><path d="${arcPath(112.5,start+filled,missing)}" fill="none" stroke="#9fad92" stroke-width="1.2" stroke-dasharray="2 4"/><path d="${arcPath(129.5,start+filled,missing)}" fill="none" stroke="#9fad92" stroke-width="1.2" stroke-dasharray="2 4"/></g>` : '';
        const fillArc = filled > 1e-9 ? `<path d="${arcPath(121,start,filled)}" fill="none" stroke="${row.color}" stroke-width="17" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title></path>` : '';
        return emptyArc + fillArc;
      }).join('');
    };
    const panel = kind => {
      const isLegislation = kind === 'legislation';
      const label = isLegislation ? `${roles[state.role]}｜${periods[state.period]}` : '競選官網｜政策套案頁';
      const units = isLegislation ? view.nUnits : policyUnits;
      const filled = isLegislation ? 100 : num(view.overlap);
      const summary = `${label}。內圈為自身實際主題分布，合計100%；外圈${isLegislation ? '為完整國會基準100%' : `以國會各主題角度為基準，填色同類交集${pct(filled)}，虛線缺口${pct(100-filled)}`}。${rows.map(row=>row.name+'：'+pct(isLegislation?row.legPct:row.policyPct)).join('；')}`;
      return `<article class="cmp-rings-panel ${isLegislation ? 'cmp-rings-leg' : 'cmp-rings-policy'}"><div class="cmp-rings-panel-heading"><span>${isLegislation ? 'A ／ 國會紀錄' : 'B ／ 競選政策'}</span><h4>${esc(label)}</h4><p>${isLegislation ? `${fmt(view.nDocuments)} 件法律案${state.weighting === 'bundle' ? `，合成 ${fmt(view.nUnits)} 組套案` : ''}` : `${fmt(policyUnits)} 個政策套案頁`} · 每邊實際分布各 100%</p></div><svg viewBox="0 0 300 300" role="img" aria-label="${esc(summary)}"><title>${esc(summary)}</title>${baselineRing(kind)}${actualRing(kind)}<text x="150" y="147" text-anchor="middle" class="cmp-rings-total">${fmt(units)}</text><text x="150" y="170" text-anchor="middle" class="cmp-rings-unit">${esc(isLegislation ? unitShort : '個政策頁')}</text></svg><div class="cmp-rings-fill"><span>${isLegislation ? '外圈：國會基準' : '外圈：同類主題交集'}</span><strong>${pct(filled)}</strong></div><p class="cmp-rings-panel-note">${isLegislation ? '外圈保留國會各主題的位置與角度。' : `沿用左邊的主題位置；虛線缺口合計 ${pct(100-filled)}。`}</p></article>`;
    };
    container.innerHTML = `<section class="cmp-policy-rings-card" aria-labelledby="cmp-policy-rings-title"><div class="cmp-rings-heading"><div><p class="cmp-kicker">回到第一個比較 ／ 換成圓圖看</p><h3 id="cmp-policy-rings-title">立院提案和競選政策，<br>各把重點放在哪裡？</h3><p class="cmp-note">${esc(roles[state.role])} ${fmt(view.nDocuments)} 件法律案，對照官網 ${fmt(policyUnits)} 頁政策。這裡跟隨上方的比較設定。</p></div><div class="cmp-rings-score"><strong>${pct(view.overlap)}</strong><span>兩邊主題比例重疊</span></div></div><div class="cmp-rings-guide"><p><i class="cmp-guide-inner" aria-hidden="true"></i><strong>內圈看重點</strong>：每一類各占多少</p><p><i class="cmp-guide-outer" aria-hidden="true"></i><strong>外圈看重疊</strong>：右邊虛線是沒有重疊的部分</p></div><div class="cmp-rings-pair">${panel('legislation')}${panel('policy')}</div><p class="cmp-rings-caption">想知道官網實際關注什麼，請看右邊的<strong>內圈</strong>。外圈只是幫你對照兩邊重疊多少；<strong>虛線不代表政策缺了幾成</strong>。</p><details class="cmp-reading-help"><summary>外圈為什麼有缺口？ <span aria-hidden="true">＋</span></summary><p>外圈沿用左邊法案的各類位置。每類只填上兩邊較小的比例，其餘留虛線。例如某類法案占 30%、政策占 10%，右外圈就填色 10%、留空 20%。政策獨有的類別仍完整保留在右邊內圈。</p><p>算法：右外圈每類填色 = min（國會比例、政策比例）。填色加總就是主題重疊率。</p></details><div class="cmp-rings-legend" role="table" aria-label="兩個內圈的實際主題分布與國會基準交集"><div class="cmp-rings-legend-row cmp-rings-legend-head" role="row"><span role="columnheader">共用主題 · 同類同色</span><span role="columnheader">${esc(roles[state.role])}<small>共 ${fmt(view.nUnits)} ${unitLabel}</small></span><span role="columnheader">官網政策<small>共 ${fmt(policyUnits)} 頁</small></span><span role="columnheader">右外圈填色<small>同類交集</small></span></div>${rows.map(row=>`<div class="cmp-rings-legend-row" role="row"><span role="cell"><i style="background:${row.color}" aria-hidden="true"></i><button type="button" data-cmp-topic="${esc(row.id)}" title="${esc(row.definition)}">${esc(row.name)}</button></span><span role="cell" class="${num(row.legPct)===0?'cmp-ring-zero':''}">${pct(row.legPct)}</span><span role="cell" class="${num(row.policyPct)===0?'cmp-ring-zero':''}">${pct(row.policyPct)}</span><span role="cell">${pct(Math.min(num(row.legPct),num(row.policyPct)))}</span></div>`).join('')}</div><p class="cmp-rings-axis-note">這兩張圖按<strong>「想解決什麼問題」</strong>分類，所以軍人的育兒修法歸在職場育兒。前面按「法案管什麼」看時，同案則歸國防／軍職制度。${state.coding==='main'?'主類為 0 不等於沒有次要相關內容。':'複選案件已分攤至相關主題。'}</p></section>`;
  }

  function renderLedger() {
    const leg = periodDocs(state.data.documents?.[state.role]).map(doc => ({...doc, ledgerRole:state.role}));
    root.querySelector('#cmp-ledger > summary').innerHTML='逐案分類帳：'+roles[state.role]+' '+fmt(leg.length)+' 件<span aria-hidden="true">＋</span>';
    const policy = arr(state.data.documents?.policy).map(doc => ({...doc, ledgerRole:'policy'}));
    let docs = state.ledgerType === 'legislation' ? leg : state.ledgerType === 'policy' ? policy : [...leg,...policy];
    if (state.ledgerTopic) docs = docs.filter(doc => state.coding==='main'?doc.mainTopic===state.ledgerTopic:arr(doc.topics).includes(state.ledgerTopic));
    const query = state.search.trim().toLocaleLowerCase('zh-TW');
    if (query) docs = docs.filter(doc => `${doc.id || ''} ${doc.title || ''}`.toLocaleLowerCase('zh-TW').includes(query));
    root.querySelector('#cmp-ledger-count').textContent = `符合 ${fmt(docs.length)} 筆，顯示 ${fmt(Math.min(state.visible,docs.length))} 筆。法律案角色：${roles[state.role]}；期間：${periods[state.period]}。`;
    root.querySelector('#cmp-ledger-list').innerHTML = docs.length ? docs.slice(0,state.visible).map(doc => {
      const url = safeUrl(doc.sourceUrl || doc.url);
      const isPolicy = doc.ledgerRole === 'policy';
      return `<article class="cmp-ledger-item"><div class="cmp-ledger-meta"><span class="cmp-record-role ${isPolicy ? 'cmp-record-policy' : ''}">${esc(isPolicy ? '競選政策頁' : roles[state.role])}</span><span>${esc(doc.date || (isPolicy ? '官網快照' : '日期未載'))}</span><code>${esc(doc.id)}</code></div><h4>${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(doc.title)} <span aria-hidden="true">↗</span></a>` : esc(doc.title)}</h4><div class="cmp-ledger-tags"><span class="cmp-main-tag">主要目的：${esc(topicName(doc.mainTopic))}</span>${arr(doc.topics).filter(topic => topic !== doc.mainTopic).map(topic => `<span>${esc(topicName(topic))}</span>`).join('')}</div><p class="cmp-ledger-rationale">${esc(doc.rationale || '此筆尚未附分類理由，請核對來源。')}</p>${doc.groupId ? `<p class="cmp-ledger-group">套案群組：${esc(doc.groupLabel || doc.groupId)} <code>${esc(doc.groupId)}</code></p>` : ''}${url ? `<a class="cmp-record-source" href="${esc(url)}" target="_blank" rel="noopener noreferrer">閱讀${isPolicy ? '官網政策原頁' : '立法院原案'} ↗</a>` : ''}</article>`;
    }).join('') : '<p class="cmp-empty">沒有符合條件的紀錄。可清除搜尋或改選主題。</p>';
    root.querySelector('[data-cmp-more]').hidden = state.visible >= docs.length;
  }

  function renderMethod() {
    const meta = state.data.meta || {};
    const metric = meta.metric || {};
    root.querySelector('#cmp-method').innerHTML = `<div class="cmp-method-content"><p><strong>主題同步率</strong> = 100 − 原始相異分數 = 100 × Σ min(pᵢ,qᵢ)。0% 代表沒有同類主題權重交集，100% 代表同分布；不是人格同步、相關係數或欺騙機率。</p><p><strong>${esc(metric.label || '主題分布差異')}</strong>：${esc(metric.formula || '100 × ½ × Σ |立法主題比例 − 政策主題比例|')}（p、q 為 0–1 之間、各自合計 1 的主題比例）。0 分表示在此分類下同分布；100 分表示沒有主題權重交集。</p><p>法律案與競選政策頁是不同資料單位。主方法對每件法律案、每個政策套案頁各指定一個主要目的；複選時則將每份文件的權重平均分給其主題。多法拆案的套案等權計算另列為敏感度。</p><p>本區僅對 AI 輔助逐案編碼完成的主提案與共同提案計分；連署案尚未使用同一套分類完成編碼，因此不提供其差異分數。</p><p class="cmp-method-links">${sourceLink(metric.source,'分布距離方法來源')}${meta.cutoff ? `<span>資料截止：${esc(meta.cutoff)}</span>` : ''}<a href="./data/comparison.json" download>下載本區 JSON ↓</a></p>${arr(meta.limitations).length ? `<ul>${arr(meta.limitations).map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : ''}<div class="cmp-codebook"><h4>共用主題定義</h4>${arr(state.data.categories).map(category => `<p><strong>${esc(category.name)}</strong><span>${esc(category.definition || '')}</span></p>`).join('')}</div></div>`;
  }

  async function init() {
    root = document.getElementById('comparison');
    if (!root) return;
    root.innerHTML = '<div class="wrap"><p class="cmp-note" role="status">正在讀取主題比較與逐案分類…</p></div>';
    try {
      const response = await fetch('./data/comparison.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data.views) || !Array.isArray(data.categories) || !data.documents) throw new Error('比較資料格式不完整');
      state.data = data;
      shell();
      render();
    } catch (error) {
      root.classList.add('section','cmp-section');
      root.innerHTML = '<div class="wrap"><p class="cmp-empty" role="alert">主題比較資料暫時無法載入。請重新整理，或下載逐案資料後核對。</p></div>';
      console.error('主題比較載入失敗', error);
    } finally { document.dispatchEvent(new CustomEvent('records:ready',{detail:'comparison'})); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
