(() => {
 'use strict';
 const BASE_SOURCE='6423653eb77322ad2d081cbdcdc783a067cff9035b220184a7594ada936763d3';
 const SUPPLEMENT_IDS=new Set(['energy-electricity-20260526-reviewed-v34','abuse-harm-distinction-154805-reviewed-v34','recall-cannot-silent-july2025-reviewed-v34','traffic-ten-years-20260816-reviewed-v34','typhoon-stock-market-decoupling-20261022-reviewed-v39','drunk-driving-news-response-facebook-20130205']);
 function parseSupplement(value){
  const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
  const only=(v,keys)=>{if(!object(v)||Object.keys(v).some(k=>!keys.includes(k)))throw Error('supplement_fields');};
  const text=(v,max=4000)=>{if(typeof v!=='string'||!v.trim()||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v)||/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i.test(v)||/[^\s@]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(v))throw Error('supplement_text');};
  const https=v=>{text(v,2048);const u=new URL(v);if(u.protocol!=='https:'||u.username||u.password||u.port||!u.hostname.includes('.')||/^\d+(?:\.\d+)*$/.test(u.hostname)||/(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(u.hostname))throw Error('supplement_url');};
  const day=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
  only(value,['version','kind','subjectId','baseSourceVersion','reviewedAt','adoptionStatus','selectionNote','counts','quotes','pending']);
  if(value.version!=='v41'||value.kind!=='quote-library-supplement'||value.subjectId!=='shen-pao-yang'||value.baseSourceVersion!==BASE_SOURCE||value.adoptionStatus!=='editorially-adopted'||typeof value.reviewedAt!=='string'||!Number.isFinite(Date.parse(value.reviewedAt)))throw Error('supplement_metadata');
  text(value.selectionNote,1200);only(value.counts,['quotes','events']);
  if(value.counts.quotes!==SUPPLEMENT_IDS.size||value.counts.events!==SUPPLEMENT_IDS.size||!Array.isArray(value.quotes)||value.quotes.length!==SUPPLEMENT_IDS.size)throw Error('supplement_count');
  const fields=['id','eventId','title','speaker','quote','date','datePrecision','eventDate','medium','topic','sourceType','verificationLevel','url','videoUrl','videoLabel','context','evidenceLocator','recordingClock','recordingClockNote','videoAvailabilityNote','inferenceLimit','frontContext','libraryRank','displayTier','featuredEligible','adoptionLabel','supportingUrls','meetingInfoUrl'];
  const required=['id','eventId','title','speaker','quote','date','datePrecision','medium','topic','sourceType','verificationLevel','url','context','evidenceLocator','inferenceLimit','frontContext','adoptionLabel'];
  for(const q of value.quotes){
   only(q,fields);for(const key of required)text(q[key]);
   if(!SUPPLEMENT_IDS.has(q.id)||!/^[a-z0-9][a-z0-9-]{0,120}$/.test(q.eventId)||q.speaker!=='沈伯洋'||!['spoken','written'].includes(q.medium)||!['context','correction'].includes(q.displayTier)||q.featuredEligible!==false||!Number.isInteger(q.libraryRank)||q.libraryRank<1||q.libraryRank>SUPPLEMENT_IDS.size)throw Error('supplement_record');
   if(q.datePrecision==='unknown'){if(Object.prototype.hasOwnProperty.call(q,'eventDate'))throw Error('supplement_unknown_date');}
   else if(q.datePrecision!=='day'||!day(q.eventDate)||q.eventDate!==q.date)throw Error('supplement_date');
   for(const key of ['url','videoUrl','meetingInfoUrl'])if(q[key]!==undefined)https(q[key]);
   for(const key of ['videoLabel','recordingClock','recordingClockNote','videoAvailabilityNote'])if(q[key]!==undefined)text(q[key]);
   if(q.supportingUrls!==undefined){if(!Array.isArray(q.supportingUrls)||q.supportingUrls.length>8)throw Error('supplement_sources');q.supportingUrls.forEach(https);}
  }
  for(const key of ['id','eventId','libraryRank'])if(new Set(value.quotes.map(q=>q[key])).size!==SUPPLEMENT_IDS.size)throw Error('supplement_duplicate');
  if(!Array.isArray(value.pending)||value.pending.length!==0)throw Error('supplement_pending_count');
  return value;
 }
 function quoteDateKey(q){return q.datePrecision==='unknown'?'':String(q.eventDate||q.date||'').slice(0,10);}
 function quoteInPeriod(q,period){const day=quoteDateKey(q);return period==='all'||Boolean(day)&&(period==='pre'?day<'2026-05-13':day>='2026-05-13');}
 if(typeof module==='object'&&module.exports)module.exports={parseSupplement,quoteDateKey,quoteInPeriod};
 const root=typeof document==='object'?document.getElementById('statements'):null;
 if(!root)return;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const url=s=>{try{const u=new URL(s,location.href);return u.protocol==='https:'?u.href:'#statements';}catch{return '#statements';}};
 const normalize=s=>String(s??'').normalize('NFKC').toLocaleLowerCase('zh-TW');
 const spoken=q=>q.medium!=='written';
 const added=q=>SUPPLEMENT_IDS.has(q.id)&&q.featuredEligible===false;
 const dateKey=quoteDateKey;
 const curationReady=()=>window.RecordsQuizShareV41?.VERSION==='v41'&&Array.isArray(window.RecordsQuizShareV41.CURATED_IDS)&&window.RecordsQuizShareV41.CURATED_IDS.length>=6;
 const eligible=q=>curationReady()&&window.RecordsQuizShareV41.isQuizEligible(q);
 // Display-only editorial supplement; archival quotes and source-version pins stay unchanged.
 const comparisonEditorialUpdates = {
  'community-text-and-response': {
   label:'2026-10-21補充核對',
   earlierSummary:'在毒品除罪化不被接受的條件下，文章建議參考國外社區中心提供毒品、乾淨針具及社工協助的做法。',
   summary:'競選官網否認社區發毒的指控，稱早期文字是在談減害，並援引台北既有美沙冬與針具措施說明。但2014年原文章並未提到「美沙冬」。',
   commentary:'以現行美沙冬制度解釋舊文，仍須交代當年的社區中心建議具體提供什麼，以及如何取得與監督。',
   sources:[
    {url:'https://www.thinkingtaiwan.net/content/3055',title:'2014年本人原文章'},
    {url:'https://www.dpp.org.tw/anti_rumor/puma/fact-check-21',title:'競選陣營的說明'},
    {url:'https://www.cna.com.tw/news/aipl/202610050112.aspx',title:'中央社相關報導'}
   ]
  }
 };
 let data=null,dataFailed=false,supplement=null,supplementLoading=false,supplementFailed=false,collection='featured',period='all',topic='all',medium='all',query='',sort='editorial',shown=12;
 root.innerHTML=`<div class="wrap">
  <div class="section-heading"><div><p id="stmt-heading-label" class="section-number">原話檔案 ／ 強烈用語與爭議說法</p><h2 id="stmt-heading-title">溫和形象之外，<br>回頭看他的原話。</h2></div><p id="stmt-heading-deck" class="section-deck">姓名挖苦、智商批評、強烈反問。<br>按下來源，讀完整前後文。</p></div>
  <p id="stmt-intro" class="stmt-intro">先看直接辱罵、對人挖苦、強烈反問與具爭議的說法，預設全部時期，與猜題使用同一批精選。完整原話與補充脈絡仍保留於資料下載。</p>
  <div class="stmt-library-summary"><p id="stmt-total" aria-live="polite">讀取語料總覽…</p><div class="stmt-downloads"><a href="./downloads/quotes.csv" download>既有原話 CSV ↓</a><a href="./data/quote-library-v41.json?v=41" download>本次核對補充 JSON ↓</a></div></div>
  <div class="stmt-set-picker"><label for="stmt-set">選集<select id="stmt-set"><option value="featured">反差精選 38</option><option value="supplement">本次核對補充 ${SUPPLEMENT_IDS.size}</option></select></label><p id="stmt-supplement-status" role="status">正在讀取本次核對補充；既有精選可先閱讀。</p><button id="stmt-supplement-retry" type="button" hidden>重試載入補充</button></div>
  <div id="stmt-flash-collection" class="stmt-collection"><strong data-statement-collection aria-live="polite">本期原話閃卡</strong><p id="statement-collection-note">開啟紀錄僅存本機，不代表已觀看或查證。</p></div>
  <label class="stmt-search-label" for="stmt-search">搜尋原話、人物或議題</label><input id="stmt-search" class="stmt-search" type="search" placeholder="例如：智商、名字、教育、AI" autocomplete="off">
  <div class="stmt-controls">
   <label>時間<select id="stmt-period"><option value="pre">正式提名前</option><option value="post">正式提名起</option><option value="all" selected>全部時期</option></select></label>
   <label>材料<select id="stmt-medium"><option value="all">口語與書面</option><option value="spoken">口語發言</option><option value="written">書面文字</option></select></label>
   <label>主題<select id="stmt-topic"><option value="all">所有主題</option></select></label>
   <label>排序<select id="stmt-sort"><option value="editorial">反差精選優先</option><option value="newest">日期：新到舊</option><option value="oldest">日期：舊到新</option></select></label>
  </div>
  <p id="stmt-count" class="small-note" aria-live="polite">讀取精選紀錄…</p><div id="stmt-list" class="stmt-list"></div><button id="stmt-more" class="stmt-more" type="button" hidden>再顯示 12 則 ↓</button>
  <details class="stmt-method"><summary>精選怎麼排？來源與時間點怎麼讀？ ＋</summary><p id="stmt-selection"></p><p>按編輯選題順序，優先看直接辱罵、對人挖苦與具體爭議說法；這是編輯選集，無法當作平日發言比例。<a href="https://www.ftvnews.com.tw/shortvideo/detail/0KgGAxXk1oQ" target="_blank" rel="noopener noreferrer">「暖男船長」的媒體稱呼 ↗</a> 是形象對照來源，並非本人承諾從不批評對手。語氣與政策立場分開看，不用單一片段判定整個人真假。</p><p>「完整發言片段」是官方保留的整段本人發言；「會議時鐘」是會議當時起訖，<strong>不是句內秒數</strong>。已核畫面時間與尚待原音聽校，逐則標示。</p></details>
  <div id="stmt-pairs"></div><details class="stmt-pending"><summary>待核實線索：還缺哪些原始證據？ ＋</summary><div id="stmt-pending-list"></div></details><p class="small-note stmt-footer">提名切點：2026-05-13。同一事件的不同片段共用事件編號；一則原話不等於一個獨立事件。</p>
 </div>`;
 for(const [id,key] of [['stmt-period','period'],['stmt-medium','medium'],['stmt-topic','topic'],['stmt-sort','sort']]){
  document.getElementById(id).addEventListener('change',e=>{
   if(key==='period')period=e.target.value;
   if(key==='medium')medium=e.target.value;
   if(key==='topic')topic=e.target.value;
   if(key==='sort')sort=e.target.value;
   shown=12;render();
  });
 }
 document.getElementById('stmt-search').addEventListener('input',e=>{query=normalize(e.target.value.trim());shown=12;render();});
 document.getElementById('stmt-more').addEventListener('click',()=>{shown+=12;render();});
 document.getElementById('stmt-set').addEventListener('change',e=>{
  collection=e.target.value==='supplement'?'supplement':'featured';topic='all';shown=12;updateTopics();render();
 });
 document.getElementById('stmt-supplement-retry').addEventListener('click',()=>loadSupplement());
 function sourceRows(){return collection==='supplement'?(supplement?.quotes||[]):(data?.quotes||[]).filter(eligible);}
 function updateTopics(){
  const topics=[...new Set(sourceRows().map(q=>q.topic||'政治言論'))];
  if(!topics.includes(topic))topic='all';
  const select=document.getElementById('stmt-topic');
  select.innerHTML='<option value="all">所有主題</option>'+topics.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');select.value=topic;
 }
 function overview(){
  if(!data)return;
  const selected=data.quotes.filter(eligible).length,extra=supplement?.quotes||[],all=[...data.quotes,...extra];
  document.getElementById('stmt-total').textContent=`全庫 ${all.length} 則（既有 ${data.quotes.length}${supplement?'＋本次核對 '+extra.length:''}） · ${new Set(all.map(q=>q.eventId||q.id)).size} 個事件／文章 · 精選猜題 ${selected} 則`;
  document.getElementById('stmt-selection').textContent=`目前精選與猜題 ${selected} 則，既有資料共 ${data.quotes.length} 則。一般政策與程序說明保留在既有 CSV 下載，不列入本期題庫；本次核對補充另列選集，不加入現行猜題或閃卡。新增半導體歷史敘事另附工研院史料；發言日期與提名期間待核，只列全部時期。先前版本的分享卡與題庫仍保留，舊挑戰使用其對應版本。每輪優先抽出尚未看過、來自不同事件的片段；口語與書面分開標示，未核實的時間點不編造。`;
 }
 function selectionHeading(){
  const supplementView=collection==='supplement';
  document.getElementById('stmt-heading-label').textContent=supplementView?'原話檔案 ／ 本次核對補充':'原話檔案 ／ 強烈用語與爭議說法';
  document.getElementById('stmt-heading-title').innerHTML=supplementView?'把投稿說法，<br>回到來源核對。':'溫和形象之外，<br>回頭看他的原話。';
  document.getElementById('stmt-heading-deck').innerHTML=supplementView?`更正投稿引文，補上政策與公開表述。<br>這 ${supplement?.quotes.length??SUPPLEMENT_IDS.size} 則不列入強烈用語精選、猜題或閃卡。`:'姓名挖苦、智商批評、強烈反問。<br>按下來源，讀完整前後文。';
  document.getElementById('stmt-intro').textContent=supplementView?'本次由投稿核對出的更正與一般政策脈絡。媒體引述、官方逐字稿與未確認事項分開標示；原始發表日期待核者，只列在「全部時期」。':'先看直接辱罵、對人挖苦、強烈反問與具爭議的說法，預設全部時期，與猜題使用同一批精選。完整原話與補充脈絡仍保留於資料下載。';
  document.getElementById('stmt-flash-collection').hidden=supplementView;
 }
 async function loadSupplement(){
  if(supplementLoading)return;
  supplementLoading=true;supplementFailed=false;
  const status=document.getElementById('stmt-supplement-status'),retry=document.getElementById('stmt-supplement-retry');
  status.textContent='正在讀取本次核對補充；既有精選可先閱讀。';retry.hidden=true;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
  try{
   const response=await fetch('./data/quote-library-v41.json?v=41',{cache:'no-cache',credentials:'omit',referrerPolicy:'no-referrer',signal:controller.signal});
   if(!response.ok)throw Error('supplement_unavailable');const raw=await response.text();if(raw.length>64000)throw Error('supplement_size');
   const parsed=parseSupplement(JSON.parse(raw));
   if(data&&parsed.quotes.some(q=>data.quotes.some(old=>old.id===q.id)))throw Error('supplement_overlap');
   supplement=parsed;status.textContent=`本次核對補充 ${parsed.quotes.length} 則已載入；另有 ${parsed.pending.length} 項未核實線索。補充選集不加入目前38題或閃卡。`;
  }catch{
   supplementFailed=true;status.textContent='本次補充暫時無法載入，既有精選仍可閱讀。';retry.hidden=false;
  }finally{
   clearTimeout(timer);supplementLoading=false;overview();updateTopics();render();renderPending();
  }
 }
 function compare(a,b){
  const dateA=dateKey(a),dateB=dateKey(b);
  if((sort==='oldest'||sort==='newest')&&(!dateA||!dateB))return dateA?-1:dateB?1:a.id.localeCompare(b.id);
  if(sort==='oldest')return dateA.localeCompare(dateB)||a.id.localeCompare(b.id);
  if(sort==='newest')return dateB.localeCompare(dateA)||a.id.localeCompare(b.id);
  if(collection==='featured'){
   const leadIds=Array.isArray(data?.editorial?.featuredLeadIds)?data.editorial.featuredLeadIds:[];
   const leadRank=q=>{const index=leadIds.indexOf(q.id);return index<0?Infinity:index;};
   if(leadRank(a)!==leadRank(b))return leadRank(a)-leadRank(b);
  }
  const rank=q=>added(q)?q.libraryRank:eligible(q)?window.RecordsQuizShareV41.curatedRank(q):(q.editorialRank??9999);
  return rank(a)-rank(b)||dateB.localeCompare(dateA)||a.id.localeCompare(b.id);
 }
 function matches(q){
  return quoteInPeriod(q,period)&&
   (medium==='all'||(medium==='spoken'?spoken(q):!spoken(q)))&&
   (topic==='all'||q.topic===topic)&&
   (!query||normalize([q.quote,q.title,q.topic,q.context,q.frontContext,q.venue].join(' ')).includes(query));
 }
 function sourceEvidenceLinks(q){
  const labels=new Map([
   ['https://50th.itri.org.tw/history/origin/46/','工研院：1973年成立沿革'],
   ['https://50th.itri.org.tw/history/semiconductors/1/','工研院：RCA第一批受訓名單'],
   ['https://50th.itri.org.tw/leaders/','工研院：張忠謀院長任期'],
   ['https://50th.itri.org.tw/history/semiconductors/2/','工研院：聯電與台積電衍生史']
  ]);
  const seen=new Set();
  return (Array.isArray(q.sourceEvidenceUrls)?q.sourceEvidenceUrls:[]).slice(0,8).map(value=>{
   try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||seen.has(u.href))return '';seen.add(u.href);return `<a href="${esc(u.href)}" target="_blank" rel="noopener noreferrer">${esc(labels.get(u.href)||'補充核對來源')} ↗</a>`;}catch{return '';}
  }).join('');
 }
 function card(q){
  const supplementRecord=added(q),material=supplementRecord?(q.verificationLevel==='primary-facebook-post'?'本人Facebook原貼':q.verificationLevel==='official-transcript-fulltext'?'官方逐字稿':spoken(q)?'媒體引述口語':'媒體轉引書面'):(spoken(q)?'口語發言':'本人文章');
  const videos=[];
  if(q.videoUrl)videos.push(`<a href="${esc(url(q.videoUrl))}" target="_blank" rel="noopener noreferrer">${esc(q.videoLabel||'看原片')}${q.timecode?' · '+esc(q.timecode):''} ↗</a>`);
  if(q.fullVideoUrl&&q.fullVideoUrl!==q.videoUrl)videos.push(`<a href="${esc(url(q.fullVideoUrl))}" target="_blank" rel="noopener noreferrer">${esc(q.fullVideoLabel||'完整影片')} ↗</a>`);
  return `<article class="stmt-card${supplementRecord?' stmt-card-supplement':''}" data-quote-id="${esc(q.id)}">
   <div class="stmt-card-meta"><span>${esc(q.date)}</span><span>${material}</span><span>${esc(q.topic||'政治言論')}</span><span${supplementRecord?' class="stmt-reviewed-badge"':''}>${supplementRecord?'本次核對':'精選 '+String(window.RecordsQuizShareV41.curatedRank(q)).padStart(2,'0')}</span></div>
   <div class="stmt-card-head"><h3>${esc(q.title)}</h3>${supplementRecord?'':window.RecordsStatementCards?.entry(q)||''}</div>${supplementRecord?`<p class="stmt-adoption-label">${esc(q.adoptionLabel)} · ${q.displayTier==='correction'?'引文更正':'政策與補充脈絡'}</p>`:''}${q.frontContext?`<p class="stmt-front-context">${esc(q.frontContext)}</p>`:''}${q.datePrecision==='unknown'?'<p class="stmt-date-unknown">原始發表日期與提名期間待核；僅列在全部時期。</p>':''}
   <blockquote>「${esc(q.quote)}」</blockquote>${q.contrastReason?`<p class="stmt-contrast"><span>${esc(q.contrastCriterion||'精選理由')}</span>${esc(q.contrastReason)}</p>`:''}
   <p class="stmt-venue">${esc(q.venue)}</p>
   <details><summary>看完整背景與證據位置 ＋</summary><p>${esc(q.context)}</p><p class="stmt-locator">${esc(q.evidenceLocator)}</p>${q.recordingClock?`<p class="stmt-clock">會議時鐘：${esc(q.recordingClock)}${q.videoDuration?' · 整段 '+esc(q.videoDuration):''}<br>${esc(q.recordingClockNote||'整段發言起訖，不是句內秒數。')}</p>`:''}${q.videoAvailabilityNote?`<p class="stmt-locator">${esc(q.videoAvailabilityNote)}</p>`:''}${q.meetingInfoUrl?`<p><a href="${esc(url(q.meetingInfoUrl))}" target="_blank" rel="noopener noreferrer">官方會議資料 ↗</a></p>`:''}${q.inferenceLimit?`<p class="stmt-limit">判讀範圍：${esc(q.inferenceLimit)}</p>`:''}</details>
   <div class="stmt-links"><a href="${esc(url(q.url))}" target="_blank" rel="noopener noreferrer">${supplementRecord&&!['official-transcript-fulltext','primary-facebook-post'].includes(q.verificationLevel)?'讀媒體引述來源':'讀原始來源'} ↗</a>${videos.join('')}${sourceEvidenceLinks(q)}${supplementRecord?(q.supportingUrls||[]).map((link,i)=>`<a href="${esc(url(link))}" target="_blank" rel="noopener noreferrer">補充來源 ${i+1} ↗</a>`).join(''):''}</div><p class="stmt-source">${esc(q.sourceType)}</p>
  </article>`;
 }
 function updateMore(id,count,limit){const el=document.getElementById(id);el.hidden=limit>=count;el.textContent=`再顯示 ${Math.min(12,Math.max(0,count-limit))} 則 ↓`;}
 function render(){
  selectionHeading();
  if(collection==='featured'&&dataFailed){
   document.getElementById('stmt-count').textContent='目前原話資料無法完成版本核對，已停止展示精選。可重新整理或查看資料下載。';
   document.getElementById('stmt-list').innerHTML='<p class="empty-state">精選來源載入或版本核對失敗；這不代表沒有原話紀錄。</p>';
   document.getElementById('stmt-more').hidden=true;return;
  }
  const selected=sourceRows().filter(matches).sort(compare);
  const events=new Set(selected.map(q=>q.eventId||q.id));
  document.getElementById('stmt-count').textContent=`${collection==='supplement'?'本次核對補充':'精選'} ${selected.length} 則，來自 ${events.size} 個事件／文章；顯示 ${Math.min(shown,selected.length)} 則。${collection==='supplement'?(period==='all'?'原始日期待核者也列於此。':'日期待核者不列入此期間。'):period==='pre'?'均早於正式提名。':period==='post'?'均為正式提名起。':'含提名前後。'}`;
  const empty=collection==='supplement'?(supplementLoading?'正在讀取本次核對補充…':supplementFailed?'補充資料暫時無法載入，可按「重試載入補充」，或切回反差精選。':'本次補充沒有符合紀錄；可調整條件。日期待核者只列在全部時期。'):(curationReady()?'精選中沒有符合紀錄；可改條件，或下載既有原話資料核對。':'精選清單暫時無法核對，已停止展示精選；請重新整理，或下載既有原話資料核對。');
  document.getElementById('stmt-list').innerHTML=selected.length?selected.slice(0,shown).map(q=>card(q)).join(''):'<p class="empty-state">'+empty+'</p>';
  updateMore('stmt-more',selected.length,shown);
  if(collection==='featured')window.RecordsStatementCards?.hydrate(document.getElementById('stmt-list'));
 }
 function pairSide(v,i,comparisonId){
  const update=i===1?comparisonEditorialUpdates[comparisonId]:null;
  const earlierUpdate=i===0?comparisonEditorialUpdates[comparisonId]:null;
  const summary=update?update.summary:(earlierUpdate?.earlierSummary||v.summary||'');
  const supplement=update?`<p class="stmt-editorial-comment"><strong>本館評論：</strong>${esc(update.commentary)}</p><div class="stmt-editorial-sources">${update.sources.map(source=>`<a href="${esc(url(source.url))}" target="_blank" rel="noopener noreferrer nofollow">${esc(source.title)} ↗</a>`).join('')}</div>`:'';
  return `<div><span>${i?'後來的公開說法':'早期公開紀錄'} · ${esc(v.date)}</span>${update?`<p class="stmt-editorial-update" data-editorial-update="${esc(comparisonId)}">${esc(update.label)}</p>`:''}${v.quote?`<blockquote>「${esc(v.quote)}」</blockquote>`:''}<p>${esc(summary)}</p>${supplement}${v.locator?`<p class="stmt-locator">${esc(v.locator)}</p>`:''}<a href="${esc(url(v.url))}" target="_blank" rel="noopener noreferrer">查看${i?'近期來源':'早期來源'} ↗</a>${v.videoUrl&&v.videoUrl!==v.url?` · <a href="${esc(url(v.videoUrl))}" target="_blank" rel="noopener noreferrer">${esc(v.videoLabel||'完整影片')}${v.timecode?' · '+esc(v.timecode):''} ↗</a>`:''}</div>`;
 }
 function pairs(){
  document.getElementById('stmt-pairs').innerHTML=`<div class="stmt-pair-heading"><p class="eyebrow">同一議題，前後放在一起</p><h3>原文寫過什麼，今天又怎麼回答？</h3></div>`+(data.comparisons||[]).map(p=>`<article class="stmt-pair-card" data-comparison-id="${esc(p.id)}"><h4>${esc(p.title)}</h4><div class="stmt-pair-grid">${[p.earlier,p.later].map((v,i)=>pairSide(v,i,p.id)).join('')}</div><p class="stmt-finding"><strong>把問題說清楚：</strong>${esc(p.finding)}</p><details class="stmt-pair-limits"><summary>判讀範圍與延伸來源 ＋</summary><p>${esc(p.limit)}</p>${[p.earlier,p.later].flatMap(v=>v.additionalSources||[]).map(s=>`<p><a href="${esc(url(s.url))}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ↗</a></p>`).join('')}</details></article>`).join('');
  renderPending();
 }
 function renderPending(){
  const additional=supplement?.pending||[];
  document.getElementById('stmt-pending-list').innerHTML=[...(data?.pending||[]),...additional].map(p=>`<article>${additional.includes(p)?'<p class="small-note">未核實線索，不列為本人確證原話、猜題或閃卡。</p>':''}<h4>${esc(p.title)}</h4><p>${esc(p.reason)}</p><p class="small-note">缺少：${esc(p.missing)}</p><a href="${esc(url(p.url))}" target="_blank" rel="noopener noreferrer">查看線索來源 ↗</a>${p.videoUrl?` · <a href="${esc(url(p.videoUrl))}" target="_blank" rel="noopener noreferrer">原片連結 ↗</a>`:''}</article>`).join('');
 }
 fetch('./data/quotes-v41.json',{cache:'no-cache'}).then(r=>window.RecordsQuizShareV41.readQuoteResponse(r)).then(({data:d,sourceVersion})=>{
  if(sourceVersion!==window.RecordsQuizShareV41.SOURCE_VERSION)throw Error('quotes_source_mismatch');
  data=d;
  window.RecordsStatementCards?.register({core:window.RecordsQuizShareV41,subjectId:document.body.dataset.subjectId,sourceVersion:window.RecordsQuizShareV41?.SOURCE_VERSION,quotes:d.quotes});
  if(supplement&&supplement.quotes.some(q=>d.quotes.some(old=>old.id===q.id))){supplement=null;supplementFailed=true;document.getElementById('stmt-supplement-status').textContent='補充資料與既有檔案重疊，已停止展示補充。';document.getElementById('stmt-supplement-retry').hidden=false;}
  overview();updateTopics();
  render();pairs();
 }).catch(()=>{dataFailed=true;render();}).finally(()=>{document.dispatchEvent(new CustomEvent('records:ready',{detail:'statements'}));});
 loadSupplement();
})();
