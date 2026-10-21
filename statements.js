(() => {
 'use strict';
 const root=document.getElementById('statements');
 if(!root)return;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const url=s=>{try{const u=new URL(s,location.href);return u.protocol==='https:'?u.href:'#statements';}catch{return '#statements';}};
 const normalize=s=>String(s??'').normalize('NFKC').toLocaleLowerCase('zh-TW');
 const spoken=q=>q.medium!=='written';
 const before=q=>(q.eventDate||q.date).slice(0,10)<'2026-05-13';
 const curationReady=()=>window.RecordsQuizShareCore?.VERSION==='v24'&&Array.isArray(window.RecordsQuizShareCore.CURATED_IDS)&&window.RecordsQuizShareCore.CURATED_IDS.length>=6;
 const eligible=q=>curationReady()&&window.RecordsQuizShareCore.isQuizEligible(q);
 let data=null,period='all',topic='all',medium='all',query='',sort='editorial',shown=12,advancedShown=12;
 root.innerHTML=`<div class="wrap">
  <div class="section-heading"><div><p class="section-number">原話檔案 ／ 強烈用語與爭議說法</p><h2>溫和形象之外，<br>回頭看他的原話。</h2></div><p class="section-deck">姓名挖苦、智商批評、強烈反問。<br>按下來源，讀完整前後文。</p></div>
  <p class="stmt-intro">先看直接辱罵、對人挖苦、強烈反問與具爭議的說法，預設全部時期，與猜題使用同一批精選。一般政策說明、程序發言及補充脈絡收在下方「進階資料」。</p>
  <div class="stmt-library-summary"><p id="stmt-total" aria-live="polite">讀取語料總覽…</p><a href="./downloads/quotes.csv" download>下載全部原話 CSV ↓</a></div>
  <label class="stmt-search-label" for="stmt-search">搜尋原話、人物或議題</label><input id="stmt-search" class="stmt-search" type="search" placeholder="例如：智商、名字、教育、AI" autocomplete="off">
  <div class="stmt-controls">
   <label>時間<select id="stmt-period"><option value="pre">正式提名前</option><option value="post">正式提名起</option><option value="all" selected>全部時期</option></select></label>
   <label>材料<select id="stmt-medium"><option value="all">口語與文章</option><option value="spoken">口語發言</option><option value="written">本人文章</option></select></label>
   <label>主題<select id="stmt-topic"><option value="all">所有主題</option></select></label>
   <label>排序<select id="stmt-sort"><option value="editorial">反差精選優先</option><option value="newest">日期：新到舊</option><option value="oldest">日期：舊到新</option></select></label>
  </div>
  <p id="stmt-count" class="small-note" aria-live="polite">讀取精選紀錄…</p><div id="stmt-list" class="stmt-list"></div><button id="stmt-more" class="stmt-more" type="button" hidden>再顯示 12 則 ↓</button>
  <details id="stmt-advanced" class="stmt-advanced"><summary><span>進階資料 ／ 一般政策與補充脈絡</span><span id="stmt-advanced-count"></span></summary><p class="small-note stmt-advanced-intro">沿用上方搜尋、時間、材料、主題及排序；這些紀錄保留在全庫，不列入精選猜題。</p><div id="stmt-advanced-list" class="stmt-list"></div><button id="stmt-advanced-more" class="stmt-more" type="button" hidden>再顯示 12 則 ↓</button></details>
  <details class="stmt-method"><summary>精選怎麼排？來源與時間點怎麼讀？ ＋</summary><p id="stmt-selection"></p><p>按編輯選題順序，優先看直接辱罵、對人挖苦與具體爭議說法；這是編輯選集，無法當作平日發言比例。<a href="https://www.ftvnews.com.tw/shortvideo/detail/0KgGAxXk1oQ" target="_blank" rel="noopener noreferrer">「暖男船長」的媒體稱呼 ↗</a> 是形象對照來源，並非本人承諾從不批評對手。語氣與政策立場分開看，不用單一片段判定整個人真假。</p><p>「完整發言片段」是官方保留的整段本人發言；「會議時鐘」是會議當時起訖，<strong>不是句內秒數</strong>。已核畫面時間與尚待原音聽校，逐則標示。</p></details>
  <div id="stmt-pairs"></div><details class="stmt-pending"><summary>待核實線索：還缺哪些原始證據？ ＋</summary><div id="stmt-pending-list"></div></details><p class="small-note stmt-footer">提名切點：2026-05-13。同一事件的不同片段共用事件編號；一則原話不等於一個獨立事件。</p>
 </div>`;
 for(const [id,key] of [['stmt-period','period'],['stmt-medium','medium'],['stmt-topic','topic'],['stmt-sort','sort']]){
  document.getElementById(id).addEventListener('change',e=>{
   if(key==='period')period=e.target.value;
   if(key==='medium')medium=e.target.value;
   if(key==='topic')topic=e.target.value;
   if(key==='sort')sort=e.target.value;
   shown=advancedShown=12;render();
  });
 }
 document.getElementById('stmt-search').addEventListener('input',e=>{query=normalize(e.target.value.trim());shown=advancedShown=12;render();});
 document.getElementById('stmt-more').addEventListener('click',()=>{shown+=12;render();});
 document.getElementById('stmt-advanced-more').addEventListener('click',()=>{advancedShown+=12;render();});
 function compare(a,b){
  const dateA=(a.eventDate||a.date).slice(0,10),dateB=(b.eventDate||b.date).slice(0,10);
  if(sort==='oldest')return dateA.localeCompare(dateB)||a.id.localeCompare(b.id);
  if(sort==='newest')return dateB.localeCompare(dateA)||a.id.localeCompare(b.id);
  const rank=q=>eligible(q)?window.RecordsQuizShareCore.curatedRank(q):(q.editorialRank??9999);
  return rank(a)-rank(b)||dateB.localeCompare(dateA)||a.id.localeCompare(b.id);
 }
 function matches(q){
  return (period==='all'||(period==='pre'?before(q):!before(q)))&&
   (medium==='all'||(medium==='spoken'?spoken(q):!spoken(q)))&&
   (topic==='all'||q.topic===topic)&&
   (!query||normalize([q.quote,q.title,q.topic,q.context,q.frontContext,q.venue].join(' ')).includes(query));
 }
 function card(q,advanced=false){
  const videos=[];
  if(q.videoUrl)videos.push(`<a href="${esc(url(q.videoUrl))}" target="_blank" rel="noopener noreferrer">${esc(q.videoLabel||'看原片')}${q.timecode?' · '+esc(q.timecode):''} ↗</a>`);
  if(q.fullVideoUrl&&q.fullVideoUrl!==q.videoUrl)videos.push(`<a href="${esc(url(q.fullVideoUrl))}" target="_blank" rel="noopener noreferrer">${esc(q.fullVideoLabel||'完整影片')} ↗</a>`);
  return `<article class="stmt-card${advanced?' stmt-card-advanced':''}" data-quote-id="${esc(q.id)}">
   <div class="stmt-card-meta"><span>${esc(q.date)}</span><span>${spoken(q)?'口語發言':'本人文章'}</span><span>${esc(q.topic||'政治言論')}</span><span>${advanced?'進階資料':eligible(q)?'精選 '+String(window.RecordsQuizShareCore.curatedRank(q)).padStart(2,'0'):'精選猜題'}</span></div>
   <h3>${esc(q.title)}</h3>${q.frontContext?`<p class="stmt-front-context">${esc(q.frontContext)}</p>`:''}
   <blockquote>「${esc(q.quote)}」</blockquote>${q.contrastReason&&!advanced?`<p class="stmt-contrast"><span>${esc(q.contrastCriterion||'精選理由')}</span>${esc(q.contrastReason)}</p>`:''}
   <p class="stmt-venue">${esc(q.venue)}</p>
   <details><summary>看完整背景與證據位置 ＋</summary><p>${esc(q.context)}</p><p class="stmt-locator">${esc(q.evidenceLocator)}</p>${q.recordingClock?`<p class="stmt-clock">會議時鐘：${esc(q.recordingClock)}${q.videoDuration?' · 整段 '+esc(q.videoDuration):''}<br>${esc(q.recordingClockNote||'整段發言起訖，不是句內秒數。')}</p>`:''}${q.videoAvailabilityNote?`<p class="stmt-locator">${esc(q.videoAvailabilityNote)}</p>`:''}${q.meetingInfoUrl?`<p><a href="${esc(url(q.meetingInfoUrl))}" target="_blank" rel="noopener noreferrer">官方會議資料 ↗</a></p>`:''}${q.inferenceLimit?`<p class="stmt-limit">判讀範圍：${esc(q.inferenceLimit)}</p>`:''}</details>
   <div class="stmt-links"><a href="${esc(url(q.url))}" target="_blank" rel="noopener noreferrer">讀原始來源 ↗</a>${videos.join('')}</div><p class="stmt-source">${esc(q.sourceType)}</p>
  </article>`;
 }
 function updateMore(id,count,limit){const el=document.getElementById(id);el.hidden=limit>=count;el.textContent=`再顯示 ${Math.min(12,Math.max(0,count-limit))} 則 ↓`;}
 function render(){
  const rows=data.quotes.filter(matches).sort(compare);
  const selected=rows.filter(eligible),advanced=rows.filter(q=>!eligible(q));
  const events=new Set(selected.map(q=>q.eventId||q.id));
  document.getElementById('stmt-count').textContent=`精選 ${selected.length} 則，來自 ${events.size} 個事件／文章；顯示 ${Math.min(shown,selected.length)} 則。${period==='pre'?'均早於正式提名。':period==='post'?'均為正式提名起。':'含提名前後。'}`;
  document.getElementById('stmt-list').innerHTML=selected.length?selected.slice(0,shown).map(q=>card(q)).join(''):'<p class="empty-state">'+(curationReady()?'精選中沒有符合紀錄；可改條件，或展開下方進階資料。':'精選清單暫時無法核對，已停止展示精選；請重新整理。原始紀錄仍可在進階資料核對。')+'</p>';
  document.getElementById('stmt-advanced-count').textContent=`${advanced.length} 則符合 · 全庫 ${data.quotes.filter(q=>!eligible(q)).length} 則`;
  document.getElementById('stmt-advanced-list').innerHTML=advanced.length?advanced.slice(0,advancedShown).map(q=>card(q,true)).join(''):'<p class="empty-state">進階資料中沒有符合紀錄。</p>';
  updateMore('stmt-more',selected.length,shown);updateMore('stmt-advanced-more',advanced.length,advancedShown);
 }
 function pairSide(v,i){return `<div><span>${i?'後來的公開說法':'早期公開紀錄'} · ${esc(v.date)}</span>${v.quote?`<blockquote>「${esc(v.quote)}」</blockquote>`:''}<p>${esc(v.summary||'')}</p>${v.locator?`<p class="stmt-locator">${esc(v.locator)}</p>`:''}<a href="${esc(url(v.url))}" target="_blank" rel="noopener noreferrer">查看${i?'近期來源':'早期來源'} ↗</a>${v.videoUrl&&v.videoUrl!==v.url?` · <a href="${esc(url(v.videoUrl))}" target="_blank" rel="noopener noreferrer">${esc(v.videoLabel||'完整影片')}${v.timecode?' · '+esc(v.timecode):''} ↗</a>`:''}</div>`;}
 function pairs(){
  document.getElementById('stmt-pairs').innerHTML=`<div class="stmt-pair-heading"><p class="eyebrow">同一議題，前後放在一起</p><h3>原文寫過什麼，今天又怎麼回答？</h3></div>`+(data.comparisons||[]).map(p=>`<article class="stmt-pair-card"><h4>${esc(p.title)}</h4><div class="stmt-pair-grid">${[p.earlier,p.later].map(pairSide).join('')}</div><p class="stmt-finding"><strong>把問題說清楚：</strong>${esc(p.finding)}</p><details class="stmt-pair-limits"><summary>判讀範圍與延伸來源 ＋</summary><p>${esc(p.limit)}</p>${[p.earlier,p.later].flatMap(v=>v.additionalSources||[]).map(s=>`<p><a href="${esc(url(s.url))}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ↗</a></p>`).join('')}</details></article>`).join('');
  document.getElementById('stmt-pending-list').innerHTML=(data.pending||[]).map(p=>`<article><h4>${esc(p.title)}</h4><p>${esc(p.reason)}</p><p class="small-note">缺少：${esc(p.missing)}</p><a href="${esc(url(p.url))}" target="_blank" rel="noopener noreferrer">查看線索來源 ↗</a>${p.videoUrl?` · <a href="${esc(url(p.videoUrl))}" target="_blank" rel="noopener noreferrer">原片連結 ↗</a>`:''}</article>`).join('');
 }
 fetch('./data/quotes.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('quotes');return r.json();}).then(d=>{
  data=d;
  const selected=d.quotes.filter(eligible).length;
  document.getElementById('stmt-total').textContent=`全庫 ${d.quotes.length} 則 · ${new Set(d.quotes.map(q=>q.eventId||q.id)).size} 個事件／文章 · 精選猜題 ${selected} 則 · 進階 ${d.quotes.length-selected} 則`;
  document.getElementById('stmt-selection').textContent=`目前精選與猜題 ${selected} 則，進階資料 ${d.quotes.length-selected} 則。一般政策與程序說明不列入本期題庫；先前版本的分享卡保留作歷史連結，舊挑戰會重新開局。原始來源仍保留供查核。每輪優先抽出尚未看過、來自不同事件的片段；口語與書面分開標示，未核實的時間點不編造。`;
  const topics=[...new Set(d.quotes.map(q=>q.topic||'政治言論'))];
  document.getElementById('stmt-topic').innerHTML='<option value="all">所有主題</option>'+topics.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');
  render();pairs();
 }).catch(()=>{document.getElementById('stmt-count').textContent='原話資料暫時無法載入，可重新整理或從下方知識庫查看來源。';}).finally(()=>{document.dispatchEvent(new CustomEvent('records:ready',{detail:'statements'}));});
})();
