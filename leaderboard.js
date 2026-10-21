/* Local scores always work; public submission is optional and explicitly chosen. */
(() => {
  'use strict';
  const host=document.getElementById('arcade-leaderboard');if(!host)return;
  if(!document.querySelector('link[data-arcade-scores]')){const link=document.createElement('link');link.rel='stylesheet';link.href='/leaderboard.css?v=13';link.dataset.arcadeScores='';document.head.append(link);}
  const isShared=Boolean(document.querySelector('[data-score-share]'));
  const sharedParams=new URLSearchParams(location.search),hasSharedId=isShared&&sharedParams.has('id'),sharedId=sharedParams.get('id')||'';
  const scoreKey='record-arcade-scores-v2',nameKey='record-arcade-name-v1';
  const cleanName=value=>[...String(value??'').normalize('NFKC').replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,'').replace(/\s+/g,' ').trim()].slice(0,16).join('');
  const validName=value=>[...value].length>=2&&[...value].length<=16&&!/[<>\u200b\u200e\u200f\ud800-\udfff]/u.test(value);
  const integer=(v,max)=>Number.isInteger(v)&&v>=0&&v<=max;
  const validScore=s=>s&&s.version==='red-notes-v2'&&integer(s.score,200000)&&integer(s.hits,400)&&integer(s.shots,400)&&s.hits<=s.shots&&integer(s.maxCombo,s.hits)&&integer(s.durationMs,41000)&&s.durationMs>=39000;
  const node=(tag,className,value)=>{const el=document.createElement(tag);if(className)el.className=className;if(value!==undefined)el.textContent=value;return el;};
  let stored={best:null,recent:null},nickname='玩家',storageAvailable=true;
  try{const saved=JSON.parse(localStorage.getItem(scoreKey)||'null');if(saved){if(validScore(saved.best))stored.best=saved.best;if(validScore(saved.recent))stored.recent=saved.recent;}nickname=cleanName(localStorage.getItem(nameKey)||'玩家');}catch{storageAvailable=false;}
  if(!validName(nickname))nickname='玩家';
  let current=isShared?null:stored.recent,activeRun=null,sharedValid=false,blob=null,renderNumber=0;
  let api=null,apiConfigured=false,finishTrace=null,registeredItem=null,topGeneration=0,publicTimer=null;
  const finishedRuns=new Set();
  if(isShared&&!hasSharedId){
    const params=new URLSearchParams(location.search);
    const rawName=params.get('name')||'',rawScore=params.get('score')||'',rawCombo=params.get('combo')||'';
    if(location.search.length<=512&&rawName.length<=64&&/^\d{1,6}$/.test(rawScore)&&/^\d{1,3}$/.test(rawCombo)){
      const name=cleanName(rawName),score=Number(rawScore),combo=Number(rawCombo);
      if(validName(name)&&integer(score,200000)&&score%100===0&&integer(combo,400)){
        nickname=name;current={version:'red-notes-v2',score,maxCombo:combo,shared:true};sharedValid=true;
      }
    }
  }
  const section=node('div','arcade-score-section');host.append(section);
  section.append(node('p','arcade-score-eyebrow',isShared?'PLAYER SHARED / SCORE CARD':'MY SCORE / LOCAL BROWSER'));
  section.append(node('h3','',isShared?'這是我的紅紙鈔成績。':'這一局，值得留一張。'));
  const intro=node('p','',isShared?(hasSharedId?'正在透過公開紀錄編號核對這筆成績。':'玩家分享，未經排行榜檢核。'):'完成 40 秒挑戰後，輸入暱稱，把成績做成圖片分享。');section.append(intro);
  const shareState=isShared?node('p','arcade-shared-state',hasSharedId?'公開成績讀取中…':'玩家自行分享，未經排行榜檢核。'):null;if(shareState)section.append(shareState);
  const summary=node('div','arcade-score-summary');
  const recentBox=node('div'),bestBox=node('div');recentBox.append(node('span','','本機最近一局'));const recentValue=node('strong','','—');recentBox.append(recentValue);bestBox.append(node('span','','本機最佳'));const bestValue=node('strong','','—');bestBox.append(bestValue);summary.append(recentBox,bestBox);summary.hidden=isShared;section.append(summary);
  const body=node('div','arcade-score-body'),editor=node('div','arcade-score-editor'),preview=node('div','arcade-score-preview');body.append(editor,preview);section.append(body);
  const label=node('label','','成績卡暱稱');label.htmlFor='arcade-player-name';const input=node('input');input.id='arcade-player-name';input.type='text';input.maxLength=32;input.autocomplete='nickname';input.value=nickname;input.setAttribute('aria-describedby','arcade-name-hint');editor.append(label,input);
  const hint=node('p','arcade-score-hint','2–16 個字。暱稱可重複；本機成績不會自動公開。');hint.id='arcade-name-hint';editor.append(hint);
  const status=node('p','arcade-score-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');editor.append(status);
  const buttons=node('div','arcade-score-buttons'),share=node('button','','分享我的成績'),download=node('button','secondary','下載成績圖');share.type=download.type='button';buttons.append(share,download);editor.append(buttons);
  const copy=node('button','arcade-score-copy','複製挑戰連結 ↗');copy.type='button';editor.append(copy);
  const fallback=node('input','arcade-score-link-fallback');fallback.type='text';fallback.readOnly=true;fallback.hidden=true;fallback.setAttribute('aria-label','可複製的挑戰連結');editor.append(fallback);
  const publishBox=node('div','arcade-score-publish'),publish=node('button','','公開登錄這局成績');publish.type='button';publish.disabled=true;
  const publishNotice=node('p','arcade-score-publish-notice','按下公開登錄，才會傳送本局遊戲紀錄，並公開暱稱、分數、命中、最高連擊及登錄時間。排行榜顯示近 30 日；舊資料隨後續開局分批清理。同名可重複。');
  const publicStatus=node('p','arcade-score-status');publicStatus.setAttribute('role','status');publicStatus.setAttribute('aria-live','polite');
  publishBox.append(publishNotice,publish,publicStatus);publishBox.hidden=isShared;editor.append(publishBox);
  const canvas=node('canvas','arcade-score-canvas');canvas.width=1200;canvas.height=630;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','紅紙鈔掉面具成績卡');preview.append(canvas);
  preview.append(node('p','arcade-score-caption','個人成績請分享圖片；連結預覽使用遊戲封面。'));
  const global=node('div','arcade-score-global-panel'),globalHead=node('div','arcade-score-global-heading'),globalTitle=node('h4','','公開排行榜 Coming soon'),globalBadge=node('span','','尚未連線');globalHead.append(globalTitle,globalBadge);
  const globalNote=node('p','arcade-score-global-note','時間／規則基本檢核，不代表真人或每次 3D 命中都已驗證。暱稱可重複，不是帳號。');
  const refresh=node('button','arcade-score-refresh','重新整理排行榜 ↻');refresh.type='button';refresh.disabled=true;
  const topStatus=node('p','arcade-score-status','公開排行榜尚未連線。本機遊戲與成績圖仍可使用。');topStatus.setAttribute('role','status');
  const topList=node('ol','arcade-score-top');global.append(globalHead,globalNote,refresh,topStatus,topList);section.append(global);
  const ctx=canvas.getContext('2d');
  function round(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}}
  function fit(value,maxSize,maxWidth){let size=maxSize;while(size>20){ctx.font=`750 ${size}px "Microsoft JhengHei",system-ui,sans-serif`;if(ctx.measureText(value).width<=maxWidth)break;size-=1;}return size;}
  function draw(){
    if(!ctx){status.textContent='這個瀏覽器無法產生成績圖，但仍可玩遊戲。';share.disabled=download.disabled=true;return;}
    const name=cleanName(input.value)||'玩家',result=current;
    ctx.clearRect(0,0,1200,630);ctx.fillStyle='#152534';ctx.fillRect(0,0,1200,630);
    const g=ctx.createLinearGradient(750,0,1200,630);g.addColorStop(0,'#293b49');g.addColorStop(1,'#192636');ctx.fillStyle=g;ctx.fillRect(750,0,450,630);
    ctx.strokeStyle='#39545c';ctx.lineWidth=1;for(let y=364;y<630;y+=44){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(1200,y);ctx.stroke();}
    ctx.textBaseline='top';ctx.fillStyle='#efb49a';ctx.font='750 17px system-ui,sans-serif';ctx.fillText('PAPER NOTE ARCADE / PERSONAL SCORE',62,53);
    ctx.fillStyle='#f8eedc';ctx.font='800 35px "Microsoft JhengHei",system-ui,sans-serif';ctx.fillText('紅紙鈔掉面具',60,100);
    const nameText=name+' 的挑戰';fit(nameText,35,650);ctx.fillStyle='#cad7ca';ctx.fillText(nameText,62,174);
    ctx.fillStyle='#f6c387';ctx.font='850 118px ui-monospace,Consolas,monospace';ctx.fillText(result?result.score.toLocaleString('en-US'):'READY?',57,225);
    ctx.fillStyle='#f5ead7';ctx.font='750 25px "Microsoft JhengHei",system-ui,sans-serif';ctx.fillText(result?`最高 ${result.maxCombo} 連擊`:'40 秒，撒出你的連擊。',64,368);
    ctx.fillStyle='#a9c1b6';ctx.font='400 18px "Microsoft JhengHei",system-ui,sans-serif';ctx.fillText(registeredItem?'已登錄・時間／規則基本檢核':result?.shared?'玩家分享，未經排行榜檢核':'本機遊戲成績，未經公開排行榜檢核',64,421);
    ctx.fillStyle='#f5bd85';ctx.beginPath();ctx.arc(967,250,109,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#172a35';ctx.beginPath();ctx.arc(967,218,111,Math.PI,0);ctx.lineTo(1078,208);ctx.lineTo(855,208);ctx.fill();
    ctx.strokeStyle='#203c46';ctx.lineWidth=6;for(const x of [905,984]){ctx.beginPath();ctx.roundRect(x,229,66,51,16);ctx.stroke();}ctx.beginPath();ctx.moveTo(971,247);ctx.lineTo(984,247);ctx.stroke();
    ctx.strokeStyle='#9e6450';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(937,307);ctx.quadraticCurveTo(967,331,1000,307);ctx.stroke();
    ctx.fillStyle='#ed8b51';ctx.beginPath();ctx.moveTo(906,357);ctx.lineTo(968,387);ctx.lineTo(1030,357);ctx.lineTo(989,425);ctx.lineTo(964,407);ctx.lineTo(946,452);ctx.closePath();ctx.fill();
    for(const [x,y,angle] of [[810,150,-.2],[1054,359,.2],[812,434,-.1]]){ctx.save();ctx.translate(x,y);ctx.rotate(angle);round(0,0,112,62,4,'#b7394a','#f1ad90');ctx.strokeStyle='#f1ad90';ctx.strokeRect(9,9,94,44);ctx.font='800 30px system-ui';ctx.fillStyle='#f8d4b3';ctx.fillText('?',44,11);ctx.restore();}
    ctx.fillStyle='#101e29';ctx.fillRect(0,527,1200,103);ctx.strokeStyle='#4a6265';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(60,528);ctx.lineTo(1140,528);ctx.stroke();
    ctx.fillStyle='#d3dfd4';ctx.font='750 21px "Microsoft JhengHei",system-ui';ctx.fillText('你能超過我嗎？',62,556);ctx.font='600 15px system-ui';ctx.fillStyle='#9fb9ae';ctx.fillText('PUWA-TAIPEI.GITHUB.IO/GAME',744,563);
    canvas.setAttribute('aria-label',result?`${name}的紅紙鈔掉面具成績：${result.score}分，最高${result.maxCombo}連擊。${registeredItem?'伺服器已登錄，僅時間與規則基本檢核。':'玩家分享，未經排行榜檢核。'}`:'紅紙鈔掉面具：完成遊戲後產生成績卡。');
    const serial=++renderNumber;blob=null;
    canvas.toBlob(value=>{if(serial!==renderNumber)return;blob=value;updateButtons();},'image/png');
    updateButtons();
  }
  function updateButtons(){const enabled=Boolean(current&&blob&&validName(cleanName(input.value)));share.disabled=download.disabled=copy.disabled=!enabled;}
  function summaryValues(){recentValue.textContent=stored.recent?stored.recent.score.toLocaleString('zh-TW'):'—';bestValue.textContent=stored.best?stored.best.score.toLocaleString('zh-TW'):'—';}
  function challengeURL(){const link=new URL('/game/share/','https://puwa-taipei.github.io');if(registeredItem){link.searchParams.set('id',registeredItem.id);}else{link.searchParams.set('name',cleanName(input.value));link.searchParams.set('score',String(current.score));link.searchParams.set('combo',String(current.maxCombo));}return link.href;}
  function saveImage(){if(!blob)return;const objectURL=URL.createObjectURL(blob),a=node('a');a.href=objectURL;a.download='red-notes-'+current.score+'.png';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(objectURL),60000);}
  async function copyChallenge(){const link=challengeURL();try{await navigator.clipboard.writeText(link);status.textContent='挑戰連結已複製。個人成績圖可另外下載或分享。';}catch{fallback.hidden=false;fallback.value=link;fallback.focus();fallback.select();status.textContent='請複製下方挑戰連結。';}}
  input.addEventListener('input',()=>{const clean=cleanName(input.value);if([...input.value].length>16)input.value=clean;nickname=clean;if(validName(clean)){try{localStorage.setItem(nameKey,clean);}catch{storageAvailable=false;}status.textContent=current?'暱稱已放進圖片，現在可以分享。':'先完成一局，再把成績做成卡片。';}else status.textContent='暱稱需要 2–16 個字，請使用一般文字。';fallback.hidden=true;draw();updatePublic();});
  download.addEventListener('click',()=>{saveImage();status.textContent='已下載成績圖。把圖片傳給朋友即可。';});
  copy.addEventListener('click',copyChallenge);
  share.addEventListener('click',async()=>{
    if(!current||!blob||!validName(cleanName(input.value)))return;
    const file=new File([blob],'red-notes-'+current.score+'.png',{type:'image/png'}),link=challengeURL();
    try{
      if(navigator.share&&navigator.canShare?.({files:[file]})){
        await navigator.share({files:[file],title:'紅紙鈔掉面具｜我的成績',text:`${cleanName(input.value)}撒出 ${current.score} 分、最高 ${current.maxCombo} 連擊。你能超過我嗎？`,url:link});
        status.textContent='已開啟裝置分享。';
      }else{saveImage();await copyChallenge();status.textContent=fallback.hidden?'成績圖已下載、挑戰連結已複製。把圖片與連結傳給朋友！':'成績圖已下載。請複製下方連結，一起傳給朋友。';}
    }catch(error){status.textContent=error?.name==='AbortError'?'已取消這次分享。':'這個裝置暫時無法分享檔案；請下載成績圖，再複製挑戰連結。';}
  });
  document.addEventListener('arcade:start',e=>{if(isShared||e.detail?.game!=='red-notes')return;activeRun=e.detail.runId;current=null;finishTrace=null;registeredItem=null;input.disabled=false;blob=null;status.textContent='這局進行中。完成 40 秒後，產生新的成績卡。';fallback.hidden=true;draw();if(api?.enabled)api.start(activeRun).catch(publicError);updatePublic();});
  document.addEventListener('arcade:finish',e=>{
    const result=e.detail;if(isShared||result?.game!=='red-notes'||!validScore(result)||finishedRuns.has(result.runId)||activeRun!==result.runId)return;
    finishedRuns.add(result.runId);activeRun=null;
    finishTrace=structuredClone(result);if(api?.enabled)api.finish(finishTrace);
    const record={version:result.version,score:result.score,hits:result.hits,shots:result.shots,maxCombo:result.maxCombo,durationMs:result.durationMs,endedAt:result.endedAt,runId:result.runId};
    stored.recent=record;if(!stored.best||record.score>stored.best.score)stored.best=record;current=record;
    try{localStorage.setItem(scoreKey,JSON.stringify(stored));}catch{storageAvailable=false;}
    status.textContent=`這局 ${result.score.toLocaleString()} 分！${storageAvailable?'成績保存在這個瀏覽器。':'瀏覽器未允許儲存；仍可直接下載或分享這一局。'}`;summaryValues();draw();updatePublic();
  });
  function publicError(error){if(error?.code==='stale_run')return;updatePublic();}
  function updatePublic(){
    clearTimeout(publicTimer);publish.disabled=true;
    if(!apiConfigured){publicStatus.textContent='公開登錄尚未連線；仍可下載或分享本機成績圖。';return;}
    if(isShared){publishBox.hidden=true;return;}
    const state=api.getState();publish.textContent='公開登錄這局成績';
    if(state.phase==='submitted'){publish.textContent='這局已登錄';publicStatus.textContent='這筆成績已公開登錄，僅通過時間／規則基本檢核。新的一局可使用其他暱稱。';return;}
    if(state.phase==='submitting'){publicStatus.textContent='正在登錄這局成績，請稍候。';return;}
    if(state.phase==='expired'){publicStatus.textContent='這局的登錄期限已過，開始新的一局即可再試。本機圖片仍可分享。';return;}
    if(state.phase==='unavailable'){publicStatus.textContent='這局暫時無法公開登錄，本機成績仍保留。開始新的一局可重新連線。';return;}
    if(state.phase==='starting'||state.phase==='playing'){publicStatus.textContent='這局進行中，完成 40 秒後可自行選擇是否公開登錄。';return;}
    if(!finishTrace||!state.hasTrace){publicStatus.textContent='開始新的一局，完成後可選擇公開登錄。舊本機成績仍可做成圖片。';return;}
    if(state.waitMs>0){publicStatus.textContent=`這局已完成，約 ${Math.ceil(state.waitMs/1000)} 秒後可公開登錄。`;publicTimer=setTimeout(updatePublic,250);return;}
    if(!validName(cleanName(input.value))){publicStatus.textContent='先輸入 2–16 個字的暱稱，再公開登錄。';return;}
    publish.disabled=!state.canSubmit;
    if(state.error){publish.textContent='重試公開登錄這局';publicStatus.textContent='尚未收到成功登錄的確認。你可重新整理排行榜核對，或自行重試；本機成績圖照常使用。';}
    else publicStatus.textContent='這局已完成。按下按鈕才會把暱稱與成績公開。';
  }
  async function loadTop(){
    if(!api?.enabled)return;
    const generation=++topGeneration;refresh.disabled=true;topStatus.textContent='正在讀取近 30 日成績…';
    try{
      const rows=await api.getTop();if(generation!==topGeneration)return;
      topList.replaceChildren();globalBadge.textContent='已連線';
      rows.forEach((row,index)=>{const item=node('li'),rank=node('span','arcade-score-rank',String(index+1).padStart(2,'0')),name=node('a','arcade-score-top-name',row.nickname),points=node('strong','',row.score.toLocaleString('zh-TW')),meta=node('small','',`最高 ${row.maxCombo} 連擊 · ${new Date(row.createdAt).toLocaleDateString('zh-TW',{timeZone:'Asia/Taipei'})}`);name.href='/game/share/?id='+encodeURIComponent(row.id);item.append(rank,name,points,meta);topList.append(item);});
      topStatus.textContent=rows.length?'近 30 日 TOP 20。同名暱稱可以有不同局成績。':'近 30 日還沒有可顯示的成績。完成一局後，可選擇留下第一筆。';
    }catch{if(generation!==topGeneration)return;globalBadge.textContent=topList.children.length?'上次取得的清單':'暫時無法讀取';topStatus.textContent=topList.children.length?'目前無法更新，下面保留上次取得的清單。請稍後重新整理；本機成績圖仍可分享。':'排行榜暫時無法讀取，請稍後重新整理。本機成績圖仍可分享。';}
    finally{if(generation===topGeneration)refresh.disabled=false;}
  }
  refresh.addEventListener('click',loadTop);
  publish.addEventListener('click',async()=>{
    if(isShared||!api?.enabled||publish.disabled)return;
    try{
      const item=await api.submit(cleanName(input.value));
      if(api.getState().phase!=='submitted'||api.getState().item?.id!==item.id)return;
      registeredItem=item;input.value=item.nickname;input.disabled=true;
      current={...current,score:item.score,hits:item.hits,maxCombo:item.maxCombo};finishTrace=null;
      status.textContent='這局已登錄。分享連結會帶出這筆公開成績；預覽仍使用遊戲封面。';draw();updatePublic();loadTop();
    }catch(error){publicError(error);}
  });
  function loadNetwork(){return new Promise((resolve,reject)=>{if(window.RecordsArcadeNetwork){resolve(window.RecordsArcadeNetwork);return;}const script=document.createElement('script');script.src='/game/arcade-network.js?v=26';script.onload=()=>window.RecordsArcadeNetwork?resolve(window.RecordsArcadeNetwork):reject(new Error('network unavailable'));script.onerror=()=>reject(new Error('network unavailable'));document.head.append(script);});}
  async function initializeNetwork(){
    try{
      const [library,config]=await Promise.all([loadNetwork(),fetch('/game/arcade-config.json?v=26',{cache:'no-cache',credentials:'omit'}).then(response=>{if(!response.ok)throw new Error('config unavailable');return response.json();})]);
      api=new library.Client({apiUrl:config.apiUrl,onChange:updatePublic});apiConfigured=api.enabled;
      if(!apiConfigured){if(hasSharedId){status.textContent='這筆公開成績需要排行榜連線，目前尚未啟用。仍可直接挑戰新的一局。';shareState.textContent='排行榜尚未啟用，這筆公開成績目前無法核對。';}updatePublic();return;}
      globalTitle.textContent='公開排行榜 · 近 30 日 TOP 20';globalBadge.textContent='連線中';refresh.disabled=false;
      hint.textContent='2–16 個字，暱稱可重複。按公開登錄才公開暱稱與成績；本機圖片分享可獨立使用。';
      if(activeRun)api.start(activeRun).catch(publicError);
      updatePublic();loadTop();
      if(hasSharedId){
        status.textContent='正在讀取這筆公開登錄成績…';
        const item=await api.getScore(sharedId);registeredItem=item;nickname=item.nickname;input.value=item.nickname;input.disabled=true;
        current={version:item.version,score:item.score,hits:item.hits,maxCombo:item.maxCombo,shared:true};sharedValid=true;
        intro.textContent='伺服器已登錄這筆成績，僅通過時間／規則基本檢核；不代表真人或每次 3D 命中已驗證。';
        section.querySelector('.arcade-score-eyebrow').textContent='PUBLIC SCORE / TIME & RULES BASIC';status.textContent='這是透過公開紀錄編號取得的成績。';shareState.textContent=`已登錄 · ${item.score.toLocaleString('zh-TW')} 分 · 最高 ${item.maxCombo} 連擊 · ${new Date(item.createdAt).toLocaleDateString('zh-TW',{timeZone:'Asia/Taipei'})} · 時間／規則基本檢核`;draw();
      }
    }catch(error){
      if(hasSharedId){status.textContent=error?.status===404?'這筆成績不存在、已過期或目前未公開。':'目前無法取得這筆公開成績，請稍後再試。';shareState.textContent=status.textContent;intro.textContent='公開成績尚未能核對，未使用網址中的其他分數代替。';}
      updatePublic();
    }
  }
  summaryValues();
  if(isShared){status.textContent=hasSharedId?'正在準備讀取公開成績…':sharedValid?'玩家分享，未經排行榜檢核。':'連結中的成績資料不完整，請直接開始新挑戰。';if(!sharedValid&&!hasSharedId){intro.textContent='這個分享連結沒有有效的成績。開始新挑戰，做出自己的成績卡。';}const challenge=node('a','arcade-share-challenge','換我挑戰一局 →');challenge.href='/game/red-notes/';host.after(challenge);}
  else status.textContent=current?'這是上一次保存在本機的成績。開始新局後，將改用新成績。':'先完成一局。成績只存在這個瀏覽器，不會自動公開。';
  draw();initializeNetwork();
})();
