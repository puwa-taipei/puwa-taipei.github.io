import {createVillage} from './scene.js?v=44';
const RECORDS_URL=new URL('./records.json',import.meta.url);
const SHARE_MAP_URL=new URL('./island-share-map.json',import.meta.url);
// BEGIN_ISLAND_SHARE_CORE: pure functions also exercised by private Node tests.
const VILLAGE_URL='https://puwa.taipei/village/';
function validateIslandShareMap(data,rows){
  if(!data||data.schemaVersion!==1||data.villageUrl!==VILLAGE_URL||!/^[a-f0-9]{64}$/.test(data.recordsSha256)||!Array.isArray(data.entries)||data.entries.length!==rows.length)throw new Error('短網址索引格式不符');
  const ids=new Set(rows.map(row=>row.id)),codes=new Set(),routes=new Map();
  if(ids.size!==rows.length)throw new Error('紀錄編號重複');
  for(const row of data.entries){
    if(!row||typeof row.id!=='string'||!ids.has(row.id)||routes.has(row.id)||typeof row.code!=='string'||!/^\d{2}$/.test(row.code)||Number(row.code)<1||Number(row.code)>rows.length||codes.has(row.code)||row.path!==`/v/${row.code}.html`||row.imagePath!==`/v/${row.code}.jpg`)throw new Error('短網址與紀錄不符');
    codes.add(row.code);routes.set(row.id,{code:row.code,path:row.path,imagePath:row.imagePath});
  }
  return routes;
}
function islandShareUrl(id,routes){
  const url=new URL(VILLAGE_URL),route=routes?.get(id);
  if(route&&/^\/v\/\d{2}\.html$/.test(route.path))return new URL(route.path,VILLAGE_URL).href;
  if(typeof id==='string'&&id)url.hash=`island=${encodeURIComponent(id)}`;
  return url.href;
}
function initialIslandId(hash,initialId,rows){
  const ids=new Set(rows.map(row=>row.id)),requested=new URLSearchParams(String(hash||'').replace(/^#/,'' )).get('island');
  return ids.has(requested)?requested:ids.has(initialId)?initialId:null;
}
// END_ISLAND_SHARE_CORE
let shareRoutes=new Map();
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons={play:'M7 4l12 8-12 8z',share:'M8 12l8-7M8 12l8 7M7 12a2 2 0 1 0 0 .1M18 4a2 2 0 1 0 0 .1M18 20a2 2 0 1 0 0 .1',scan:'M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5M5 12h14',smile:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M8 9h.1M16 9h.1M8 14q4 5 8 0',home:'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',search:'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14M15 15l6 6',network:'M6 5h4v4H6zM16 15h4v4h-4zM4 16h4v4H4zM8 9v3h10v3M6 16v-4',clock:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 7v5l3 2',pause:'M8 5v14M16 5v14',layers:'M3 9l9-6 9 6-9 6zM3 14l9 6 9-6',music:'M9 17V5l11-2v12M9 8l11-2M9 17a3 3 0 1 0-3 3q3 0 3-3M20 15a3 3 0 1 0-3 3q3 0 3-3',grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',drag:'M7 12V7a1.5 1.5 0 0 1 3 0v4-7a1.5 1.5 0 0 1 3 0v7-5a1.5 1.5 0 0 1 3 0v6-2a1.5 1.5 0 0 1 3 0v6q0 6-6 6-4 0-6-4l-4-5q-1-2 1-2z',list:'M8 6h13M8 12h13M8 18h13M3 6h.1M3 12h.1M3 18h.1'};
$$('[data-icon]').forEach(el=>el.innerHTML=`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[el.dataset.icon]||icons.grid}"/></svg>`);
const regions={rhetoric:'言語與修辭',security:'國安與風險',parliament:'國會與程序',defense:'國防與軍購',media:'媒體與科技',accountability:'立場與問責'};
let entries=[],village,mode='xray',selected=null,search='',year='all',tab='zones',page=0,paused=matchMedia('(prefers-reduced-motion:reduce)').matches,bird=false,connections=false,tour=-1,sound=false,audioCtx,gain,toastTimer;
let timeOfDay='dusk',following=false,tourTimer=null,tourPlaying=false,yearTimer=null,recordYears=[];
let districtTransitionId=0,districtNavigating=false;
const PAGE_SIZE=10;
const districtNumber=index=>String(index+1).padStart(2,'0');
function notify(msg){clearTimeout(toastTimer);$('#toast').textContent=msg;$('#toast').classList.add('show');toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3300)}
function matches(e){return(year==='all'||e.date?.startsWith(year))&&(!search||`${e.name} ${e.title} ${e.quote} ${e.fact} ${e.context} ${regions[e.region]||''}`.toLowerCase().includes(search.toLowerCase()))}
function filtered(){return entries.filter(matches)}
function showSheet(open){const wasOpen=$('#sidebar').classList.contains('open');$('#sidebar').classList.toggle('open',open);$('#mobile-index').setAttribute('aria-expanded',String(open));$('#sheet-scrim').hidden=!open;const mobile=innerWidth<=760;$('#sidebar').inert=mobile&&!open;$('#sidebar').setAttribute('aria-hidden',String(mobile&&!open));$('.map-shell').inert=mobile&&open;$('.masthead').inert=mobile&&open;$('#mobile-index').inert=mobile&&open;if(mobile){if(open&&!wasOpen)$('#mobile-close').focus();else if(!open&&wasOpen)$('#mobile-index').focus()}}
function syncDistrictNavigation(total=Math.ceil(filtered().length/PAGE_SIZE)){
  const previous=(page-1+total)%total,next=(page+1)%total;
  for(const [id,index,direction,arrow] of [['district-prev',previous,'左','←'],['district-next',next,'右','→']]){
    const button=$(`#${id}`);button.hidden=total<=1;button.disabled=districtNavigating;
    if(total>1){button.querySelector('.district-nav-label').textContent=`第 ${districtNumber(index)} 區 ${arrow}`;button.setAttribute('aria-label',`沿道路前往${direction}側第 ${districtNumber(index)} 區`)}
  }
  $$('[data-page]').forEach(b=>b.disabled=districtNavigating);
  $('.map-shell').classList.toggle('district-changing',districtNavigating);
  $('#district-pager').setAttribute('aria-busy',String(districtNavigating));
}
function cancelDistrictNavigation(){const wasNavigating=districtNavigating;districtTransitionId++;districtNavigating=false;syncDistrictNavigation();return wasNavigating}
function drawScene({enterFromSky=false,navigationToken=null}={}){
  if(navigationToken!==districtTransitionId)cancelDistrictNavigation();
  const all=filtered(),total=Math.ceil(all.length/PAGE_SIZE);page=Math.max(0,Math.min(page,total-1));
  const part=all.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE),previous=(page-1+total)%total,next=(page+1)%total;
  village?.destroy();$('#stage').replaceChildren();
  if(!part.length){$('#stage').innerHTML='<div class="loading">這個條件沒有對應島嶼。請調整搜尋或年份。</div>';village=null}
  else{try{
    village=createVillage($('#stage'),{zones:part.map(e=>({...e,globalNumber:entries.indexOf(e)+1})),district:{index:page,count:total,previous:previous+1,next:next+1},onDistrictChange:direction=>setDistrict(page+direction),enterFromSky,onSelect:id=>select(id),onHeroClick:toggleFollowing,onReady:info=>{if(!info.webgl)notify('此裝置未啟用 3D，可使用島嶼按鈕和文字清單瀏覽。')}});
    village.setMode(mode);village.setPaused(paused);village.setConnections(connections);village.setBirdView(bird);village.setTimeOfDay?.(timeOfDay);if(selected&&part.some(e=>e.id===selected))village.focus(selected);village.setFollowing?.(following)
  }catch(err){console.error(err);$('#stage').innerHTML='<div class="loading">3D 顯示暫時無法啟動，請使用紀錄清單繼續閱讀。</div>';village=null}}
  $('#district-pager').innerHTML=`<span>${total?'村落分區':'沒有符合分區'}</span><div>${Array.from({length:total},(_,i)=>`<button aria-label="第 ${i+1} 區，${i*PAGE_SIZE+1} 至 ${Math.min((i+1)*PAGE_SIZE,all.length)} 島" aria-pressed="${i===page}" data-page="${i}">${districtNumber(i)}</button>`).join('')}</div>`;
  $$('[data-page]').forEach(b=>b.onclick=()=>setDistrict(+b.dataset.page));syncDistrictNavigation(total);
  if(!districtNavigating)$('#district-status').textContent=total?`目前第 ${districtNumber(page)} 區，共 ${total} 區。`:'目前沒有符合篩選的村落分區。';
}
async function setDistrict(index){
  const total=Math.ceil(filtered().length/PAGE_SIZE);if(districtNavigating||total<=1)return;
  const target=(index%total+total)%total;if(target===page)return;
  clearTimeout(searchTimer);const token=++districtTransitionId;districtNavigating=true;
  stopYearPlayback();endTour();setFollowing(false);selected=null;history.replaceState(null,'',location.pathname+location.search);showSheet(false);renderList();syncDistrictNavigation(total);
  $('#district-status').textContent=`紅熊升空，前往第 ${districtNumber(target)} 區…`;
  try{
    await village?.depart?.();if(token!==districtTransitionId)return;
    page=target;drawScene({enterFromSky:true,navigationToken:token});$('#district-status').textContent=`第 ${districtNumber(page)} 區，紅熊正在降臨…`;
    await village?.whenSettled?.();if(token!==districtTransitionId)return;
    $('#district-status').textContent=`已抵達第 ${districtNumber(page)} 區，共 ${total} 區。`;
  }catch(err){console.error('村落分區轉場失敗',err);if(token===districtTransitionId){page=target;drawScene();notify('已切換村落分區。')}}
  finally{if(token===districtTransitionId){districtNavigating=false;syncDistrictNavigation()}}
}
$('#district-prev').onclick=()=>setDistrict(page-1);$('#district-next').onclick=()=>setDistrict(page+1);
function verification(e){if(e.pending)return '待核素材';if(/nownews|udn\.com|tvbs|chinatimes|ettoday|news\./i.test(e.primary?.url||''))return '媒體引述';return /未.*(驗證|核實)|source-site|puwa/i.test(e.verification||'')?'資料站轉引':e.primary?.url?.includes('ivod.ly.gov.tw')?'官方逐字稿':/媒體|media/i.test(e.verification||'')?'媒體引述':'原文紀錄'}
function sourceLink(s,fallback){return s?.url?`<a class="source-link" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(fallback||s.label||'查看來源')} <span aria-hidden="true">↗</span></a>`:''}
function detail(e){return `<div class="record-body"><div class="record-date">${esc(e.date||'日期未詳')} <span class="badge">${verification(e)}</span></div>${e.pending?'<p class="pending-note">待核素材：以下是來源站整理的轉載字幕；發言日期與原聲尚未獨立核實。</p>':''}<blockquote>「${esc(e.quote)}」</blockquote><span class="text-label">這段話的紀錄</span><p>${esc(e.fact)}</p><span class="text-label">一起讀的前後文</span><p>${esc(e.context)}</p><div class="comment-box"><span class="text-label">村內觀點／評論</span><p>${esc(e.commentary)}</p></div>${sourceLink(e.primary,'查看原始紀錄')}${e.videoUrl?sourceLink({url:e.videoUrl},'觀看影音來源'):''}${sourceLink(e.responseSource,'查看後續回應／對照')}${(e.supportingSources||[]).map(s=>sourceLink(s)).join('')}${sourceLink(e.source,'回到 puwa 原話檔案')}<details><summary>核對範圍與來源編號</summary><p>${esc(e.limit||'依 puwa 原話檔案整理，未獨立核聽原聲；請以原始完整紀錄為準。')}</p><div class="record-id">${esc(e.source?.recordId||e.id)}</div><p>島名為本站諷刺標題；引號內才是原話摘錄。精選內容不代表發言的整體比例。</p></details><button class="share-record" data-share="${esc(e.id)}">複製這座島的連結 ↗</button></div>`}
function renderList(){const all=filtered();$('#index-count').textContent=`${entries.length} 座原話島嶼 ／ ${all.length===entries.length?'33 個事件・每則附出處':`${all.length} 則符合篩選`}`;$('#mobile-count').textContent=`${all.length} 座島`;
$('#tab-zones').setAttribute('aria-selected',String(tab==='zones'));$('#tab-relations').setAttribute('aria-selected',String(tab==='relations'));
if(!all.length){$('#records').innerHTML='<div class="empty"><strong>這裡還沒有島。</strong>找不到符合條件的紀錄。試試較短的關鍵字，或選擇全部年份。<button id="clear-filters">清除搜尋與篩選</button></div>';$('#clear-filters').onclick=clearFilters;return}
if(tab==='relations'){const groups=Object.entries(regions).map(([id,name])=>({name,rows:all.filter(e=>e.region===id)})).filter(g=>g.rows.length>0);$('#records').innerHTML='<div class="relation-intro">弧線串起本區的同議題島嶼；橋路連接島嶼、相鄰分區與紅熊巡遊路線。議題分類不代表事件因果或已證實矛盾。</div>'+groups.map(g=>`<div class="relation-row"><h3>${g.name}</h3><p>從不同時間的發言交叉閱讀，保留各自的脈絡。</p><div class="relation-links">${g.rows.map(e=>`<button data-select="${esc(e.id)}">${esc(e.name)}</button>`).join('<span>↔</span>')}</div></div>`).join('')}
else $('#records').innerHTML=all.map(e=>`<article class="island ${selected===e.id?'selected':''}" data-record="${esc(e.id)}"><button class="island-heading" data-select="${esc(e.id)}" aria-expanded="${selected===e.id}"><span class="island-number">${String(entries.indexOf(e)+1).padStart(2,'0')}</span><span><span class="island-name">${esc(e.name)}</span><span class="island-tag">${esc(regions[e.region]||'公開發言')} <span>· ${e.pending?'待核素材':esc(e.date?.slice(0,4)||'紀錄')}</span></span></span><span class="island-arrow">↗</span></button>${selected===e.id?detail(e):''}</article>`).join('');
$$('[data-select]').forEach(b=>b.onclick=()=>select(b.dataset.select));$$('[data-share]').forEach(b=>b.onclick=()=>share(b.dataset.share));}
function select(id,{sheet=true,focus=true,fromTour=false,keepTour=false,preserveUrl=false}={}){const entry=entries.find(e=>e.id===id);if(!entry)return;const interruptedDistrict=cancelDistrictNavigation();if(!fromTour){stopYearPlayback();if(keepTour)pauseTour();else endTour()}setFollowing(false);const filtersReset=!matches(entry);if(filtersReset){search='';year='all';$('#search').value='';syncYear()};const idx=filtered().findIndex(e=>e.id===id),nextPage=Math.floor(idx/PAGE_SIZE);const rebuild=interruptedDistrict||filtersReset||page!==nextPage;selected=id;page=nextPage;tab='zones';renderList();if(rebuild)drawScene();else if(focus)village?.focus(id);if(!preserveUrl)history.replaceState(null,'',`#island=${encodeURIComponent(id)}`);if(sheet)showSheet(true);const row=$(`[data-record="${CSS.escape(id)}"]`);if(row){const sc=$('#records');sc.scrollTop+=row.getBoundingClientRect().top-sc.getBoundingClientRect().top;}if(innerWidth>760&&!fromTour)row?.querySelector('.island-heading')?.focus({preventScroll:true})}
function clearFilters(){stopYearPlayback();endTour();setFollowing(false);search='';year='all';selected=null;page=0;$('#search').value='';syncYear();drawScene();renderList()}
function syncYear(){$$('[data-year]').forEach(b=>{const active=b.dataset.year===year;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))})}
function setFollowing(enabled){following=Boolean(enabled);document.body.classList.toggle('following',following);village?.setFollowing?.(following);$('#follow-toggle').setAttribute('aria-pressed',String(following));$('#follow-toggle span:last-child').textContent=following?'停止追蹤':'追蹤紅熊'}
function toggleFollowing(){if(cancelDistrictNavigation())drawScene();stopYearPlayback();endTour();setFollowing(!following);if(following){selected=null;renderList();showSheet(false)}notify(following?'鏡頭跟隨大紅熊巡遊；再點一次停止追蹤。':'已停止追蹤，可自由旋轉村落。')}
function setTimeOfDay(next){timeOfDay=next;$$('[data-time]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.time===next)));village?.setTimeOfDay?.(next)}
function setMode(next){mode=next;document.body.classList.toggle('mask-mode',mode==='mask');$('#mode-xray').classList.toggle('active',mode==='xray');$('#mode-mask').classList.toggle('active',mode==='mask');$('#mode-xray').setAttribute('aria-pressed',String(mode==='xray'));$('#mode-mask').setAttribute('aria-pressed',String(mode==='mask'));$('#mode-status').textContent=mode==='xray'?'SEE-THROUGH ON':'DEEP-FAKE ON';$('#mode-caption').innerHTML=mode==='xray'?'紙團、紅錢、黑水互攻。<span>透明紅腹下的爭吵。</span>':'笑眼、愛心、飛吻互送。<span>暖色假面下的示好。</span>';village?.setMode(mode)}
async function share(id=selected){const url=new URL(islandShareUrl(id,shareRoutes));try{await navigator.clipboard.writeText(url.href);notify('連結已複製，可以分享了。')}catch{showInfo(`<p class="eyebrow">SHARE THE VILLAGE</p><h2>分享這座村</h2><p>長按或選取以下連結複製：</p><input class="share-input" readonly value="${esc(url.href)}" aria-label="可複製的分享網址">`)}}
function showInfo(html){pauseTour();stopYearPlayback();$('#info-content').innerHTML=html;$('#info-dialog').showModal()}
const about=`<p class="eyebrow">ABOUT THE MASKED BEAR VILLAGE</p><h2>把包裝打開，<br>讓紀錄說話。</h2><p>「假面紅熊村」是一件針對公眾人物沈伯洋的政治諷刺作品。島名、熊的表情與「假面」是創作者的評論；每座島另外呈現公開原話、背景與來源，讓讀者自行判斷。</p><h3>透視與假面</h3><p>透視模式使用印刷紙鈔、紅色液體與透明熊體，表達對政治包裝的質疑。這些都是虛構視覺隱喻，不是當事人收賄、接受境外資金、暴力或犯罪的證據。Deep-fake 是本作的假面模式名稱，並未使用真人換臉、聲音模仿或偽造影像。</p><h3>資料從哪裡來</h3><p>主要選題入口為 <a href="https://puwa.taipei/#statements" target="_blank" rel="noopener noreferrer">puwa.taipei 國會紀錄觀測</a> 的精選原話。資料整理日：2026-10-23。來源包含立法院逐字稿、本人文章與媒體直接引述；每則另標核對範圍。未獨立核實之處保留資料站歸因，不把選題或分類當作人格證明。</p><h3>如何閱讀這座村</h3><p>政治立場改變、不同場景發言或強烈修辭，未必自行構成說謊。對照時應檢視時間、對象、條件與完整論述。這是精選爭議展覽，不代表全部發言的比例；弧形關聯線只表示共同主題；橋路連接島嶼與村落分區，也是紅熊的巡遊路線。</p><h3>設計致意</h3><p>互動地圖受 <a href="https://taiwan-no.one/lumama/" target="_blank" rel="noopener noreferrer">台中恐怖島</a> 啟發；透視與旋轉展示參考 <a href="https://april-zhu.com/colorfigures" target="_blank" rel="noopener noreferrer">April Zhu 的 Colorfigures</a>。模型與網頁程式為本作重新製作。3D 引擎使用 <a href="/village/vendor/THREE-LICENSE.txt" target="_blank">Three.js（MIT）</a>。</p><p class="colophon">無追蹤分析、無帳號、無自動播放音效。網站不代表上述來源或當事人的立場。</p>`;
const help=`<p class="eyebrow">HOW TO EXPLORE</p><h2>先看一眼，<br>再查一句。</h2><div class="guide-grid"><div><strong>01 旋轉與縮放</strong>拖曳地圖轉動視角；滑鼠滾輪、雙指或 ＋／− 調整距離。</div><div><strong>02 走進一座島</strong>點島上標籤或清單，閱讀原話、背景和來源。手機可從底部展開清單。</div><div><strong>03 切換兩種面孔</strong>透視模式看見印刷紙鈔與紅色液體，島上紅熊會丟紙團、紅錢、潑黑水；假面模式改為暖笑、送愛心與飛吻。暫停鈕同時停止島間互動。</div><div><strong>04 不只看一張臉</strong>用搜尋、年份播放和議題關聯，對照不同時間的公開說法。導覽可自動逐島或暫停閱讀。</div></div><p>點大紅熊或「追蹤紅熊」讓鏡頭跟隨巡遊；選島或回全景可停止追蹤。清晨、白天、黃昏與深夜切換村落光線。「暫停」只暫停村落動畫，導覽與年份播放各有自己的暫停鈕。村落道路延伸到左右相鄰分區；點地圖兩側的「第幾區」按鈕或道路出口切換，也可使用上方分區編號。切區時紅熊先升空，再於新村落降落，帶出煙塵與短暫震動。落地後沿橋路逐島巡查、停留張望；每輪打亂訪查順序。最後一區與第一區相連，可沿道路繞村一圈。按 Escape 關閉視窗或手機清單；所有紀錄都能透過鍵盤閱讀。</p>`;
$('#about-open').onclick=$('#method-open').onclick=()=>showInfo(about);$('#help-open').onclick=()=>showInfo(help);
$$('.dialog-close').forEach(b=>b.onclick=()=>b.closest('dialog').close());$$('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close()}}));
$('#mode-xray').onclick=()=>setMode('xray');$('#mode-mask').onclick=()=>setMode('mask');$('#share').onclick=()=>share();$('#mobile-index').onclick=()=>showSheet(true);$('#mobile-close').onclick=$('#sheet-scrim').onclick=()=>showSheet(false);
$('#home').onclick=()=>{const interruptedDistrict=cancelDistrictNavigation();stopYearPlayback();endTour();setFollowing(false);selected=null;history.replaceState(null,'',location.pathname+location.search);if(interruptedDistrict)drawScene();village?.reset();bird=false;$('#bird-toggle').setAttribute('aria-pressed','false');renderList();showSheet(false)};
$('#follow-toggle').onclick=toggleFollowing;$$('[data-time]').forEach(b=>b.onclick=()=>setTimeOfDay(b.dataset.time));
$('#zoom-in').onclick=()=>village?.zoom(1);$('#zoom-out').onclick=()=>village?.zoom(-1);
$('#pause-toggle').setAttribute('aria-pressed',String(paused));$('#pause-toggle span:last-child').textContent=paused?'繼續':'暫停';$('#pause-toggle').onclick=()=>{paused=!paused;village?.setPaused(paused);$('#pause-toggle').setAttribute('aria-pressed',String(paused));$('#pause-toggle span:last-child').textContent=paused?'繼續':'暫停'};
$('#bird-toggle').onclick=()=>{bird=!bird;village?.setBirdView(bird);$('#bird-toggle').setAttribute('aria-pressed',String(bird))};
$('#relations-toggle').onclick=()=>{connections=!connections;village?.setConnections(connections);$('#relations-toggle').setAttribute('aria-pressed',String(connections));if(connections){tab='relations';renderList();notify('弧線串起同議題島嶼；橋路是村落巡遊路線。')}};
$('#timeline-toggle').onclick=()=>{const show=$('#timeline').hidden;$('#timeline').hidden=!show;$('#timeline-toggle').setAttribute('aria-pressed',String(show));if(!show)stopYearPlayback()};
function stopYearPlayback(){clearInterval(yearTimer);yearTimer=null;$('#timeline-play').setAttribute('aria-pressed','false');$('#timeline-play').setAttribute('aria-label','播放已收錄年份');$('#timeline-play').textContent='▶ 播放'}
function setYear(next,{automatic=false}={}){if(!automatic){stopYearPlayback();endTour()}year=next;selected=null;page=0;syncYear();drawScene();renderList()}
function bindYearButtons(){$$('[data-year]').forEach(b=>b.onclick=()=>{setYear(b.dataset.year);notify(year==='all'?'顯示全部年份':`已篩選 ${year} 年紀錄`)})}
$('#timeline-play').onclick=()=>{if(yearTimer){stopYearPlayback();return}if(!recordYears.length)return;endTour();const available=recordYears.filter(y=>entries.some(e=>e.date?.startsWith(y)&&(!search||`${e.name} ${e.title} ${e.quote} ${e.fact} ${e.context} ${regions[e.region]||''}`.toLowerCase().includes(search.toLowerCase()))));if(!available.length){notify('目前搜尋沒有可播放的年份。');return}const advance=()=>setYear(available[(available.indexOf(year)+1)%available.length],{automatic:true});advance();yearTimer=setInterval(advance,4000);$('#timeline-play').setAttribute('aria-pressed','true');$('#timeline-play').setAttribute('aria-label','暫停年份播放');$('#timeline-play').textContent='Ⅱ 暫停';notify('每 4 秒切換一個已收錄年份。')};
$('#tab-zones').onclick=()=>{tab='zones';renderList()};$('#tab-relations').onclick=()=>{tab='relations';renderList()};let searchTimer;$('#search').addEventListener('input',e=>{const interruptedDistrict=cancelDistrictNavigation();stopYearPlayback();endTour();search=e.target.value.trim();selected=null;page=0;renderList();clearTimeout(searchTimer);if(interruptedDistrict)drawScene();else searchTimer=setTimeout(drawScene,220)});
$('#overview-open').onclick=()=>{pauseTour();stopYearPlayback();$('#overview-grid').innerHTML=entries.map((e,i)=>`<button class="overview-card" data-overview="${esc(e.id)}"><small>ISLAND ${String(i+1).padStart(2,'0')} / ${e.pending?'待核素材':esc(e.date?.slice(0,4)||'ARCHIVE')}</small><strong>${esc(e.name)}</strong><span>「${esc(e.quote)}」</span><em>打開紀錄 ↗</em></button>`).join('');$$('[data-overview]').forEach(b=>b.onclick=()=>{$('#overview-dialog').close();select(b.dataset.overview)});$('#overview-dialog').showModal()};
function syncTourPlayback(){$('#tour-play').textContent=tourPlaying?'暫停':'繼續';$('#tour-play').setAttribute('aria-pressed',String(tourPlaying));$('#tour-play').setAttribute('aria-label',tourPlaying?'暫停自動導覽':'繼續自動導覽')}
function pauseTour(){clearTimeout(tourTimer);tourTimer=null;tourPlaying=false;syncTourPlayback()}
function endTour(){pauseTour();tour=-1;$('#tour-bar').hidden=true;document.body.classList.remove('touring')}
function scheduleTour(){clearTimeout(tourTimer);if(tourPlaying&&tour>=0)tourTimer=setTimeout(()=>stepTour(1),8000)}
function showTour(){const e=entries[tour];if(!e)return;$('#tour-bar').hidden=false;document.body.classList.add('touring');$('#tour-step').textContent=`${String(tour+1).padStart(2,'0')} / ${entries.length} 座島 · ${e.pending?'待核素材':e.date||'日期未詳'}`;$('#tour-title').textContent=e.name;$('#tour-quote').textContent=`「${e.quote}」`;$('#tour-context').textContent=e.context||e.fact||'';$('#tour-prev').disabled=tour===0;$('#tour-next').textContent=tour===entries.length-1?'完成 ✓':'下一站 →';select(e.id,{sheet:false,fromTour:true});showSheet(false);syncTourPlayback();scheduleTour()}
function stepTour(delta){if(tour<0)return;if(tour+delta>=entries.length){endTour();notify('導覽完成。你可以繼續搜尋與對照紀錄。');return}tour=Math.max(0,tour+delta);showTour()}
$('#tour-start').onclick=()=>{if(!entries.length)return;clearFilters();$('#timeline').hidden=true;$('#timeline-toggle').setAttribute('aria-pressed','false');tour=0;tourPlaying=true;showTour();notify('每 8 秒走訪一座島；可暫停閱讀完整紀錄。')};$('#tour-prev').onclick=()=>stepTour(-1);$('#tour-next').onclick=()=>stepTour(1);$('#tour-end').onclick=endTour;$('#tour-play').onclick=()=>{if(tour<0)return;if(tourPlaying)pauseTour();else{tourPlaying=true;showSheet(false);syncTourPlayback();scheduleTour()}};$('#tour-read').onclick=()=>{if(tour>=0)select(entries[tour].id,{sheet:true,keepTour:true})};
$('#sound-toggle').onclick=async()=>{try{if(!audioCtx){audioCtx=new(window.AudioContext||window.webkitAudioContext)();gain=audioCtx.createGain();gain.gain.value=0;gain.connect(audioCtx.destination);[110,164.81,220,261.63].forEach((f,i)=>{const osc=audioCtx.createOscillator(),g=audioCtx.createGain();osc.type='sine';osc.frequency.value=f;g.gain.value=.08/(i+1);osc.connect(g);g.connect(gain);osc.start()})}sound=!sound;await audioCtx.resume();gain.gain.setTargetAtTime(sound?.3:0,audioCtx.currentTime,.4);$('#sound-toggle').setAttribute('aria-pressed',String(sound));notify(sound?'環境音已開啟':'環境音已關閉')}catch{notify('這個瀏覽器未提供音訊播放。')}};
document.addEventListener('visibilitychange',()=>{if(document.hidden){pauseTour();stopYearPlayback()}if(audioCtx)document.hidden?audioCtx.suspend():sound&&audioCtx.resume()});document.addEventListener('keydown',e=>{if(e.key==='Escape')showSheet(false);if(e.key==='Tab'&&innerWidth<=760&&$('#sidebar').classList.contains('open')){const focusable=[...$('#sidebar').querySelectorAll('button,input,a,summary')].filter(el=>el.offsetParent!==null);const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});matchMedia('(max-width:760px)').addEventListener('change',()=>showSheet(false));
window.addEventListener('hashchange',()=>{if(!entries.length)return;const id=initialIslandId(location.hash,document.body.dataset.initialIsland,entries);if(id&&id!==selected)select(id,{preserveUrl:true})});
async function init(){try{const [res,mapRes]=await Promise.all([fetch(RECORDS_URL),fetch(SHARE_MAP_URL).catch(()=>null)]);if(!res.ok)throw new Error('資料無法載入');entries=await res.json();try{if(!mapRes?.ok)throw new Error('短網址索引無法載入');shareRoutes=validateIslandShareMap(await mapRes.json(),entries);document.body.dataset.shareRoutes='ready'}catch{document.body.dataset.shareRoutes='fallback';notify('短網址暫時無法載入，仍可閱讀紀錄與分享原始連結。')}recordYears=[...new Set(entries.map(e=>e.date?.slice(0,4)).filter(y=>/^\d{4}$/.test(y)))].sort();$('#timeline>div').innerHTML='<button data-year="all" class="active" aria-pressed="true">全部</button>'+recordYears.map(y=>`<button data-year="${y}" aria-pressed="false">${y}</button>`).join('');bindYearButtons();$('.edition').innerHTML=`VOL. 04 <i>／</i> ${entries.length} 座島，兩種面孔`;$('#overview-dialog h2').textContent=`${entries.length} 座島，${entries.length} 種追問。`;drawScene();renderList();showSheet(false);const id=initialIslandId(location.hash,document.body.dataset.initialIsland,entries);if(id)select(id,{preserveUrl:!location.hash&&document.body.dataset.initialIsland===id})}catch(err){console.error(err);$('#records').innerHTML='<div class="empty"><strong>資料暫時無法載入。</strong>請重新整理，或直接查看 <a href="https://puwa.taipei/#statements">puwa 原話檔案</a>。</div>';$('#loading')?.remove()}}
init();
