/* No analytics, automatic embeds, local drafts, contact exports, or persistent sessions. */
(() => {
  'use strict';
  const callback=globalThis.__reviewCallback;delete globalThis.__reviewCallback;
  const R=globalThis.RecordsReview,$=id=>document.getElementById(id);
  const statusText={pending:'待審核',needs_info:'待補資料',approved:'已核准',rejected:'未採用'};
  const errors={not_configured:'工作台尚未連線。管理員資料庫與登入設定完成後才會開放；目前沒有讀取任何投稿。',access_denied:'這個帳號沒有管理員權限。私人內容已清空。',session_expired:'登入已到期，私人內容已清空。請重新登入。',login_link_invalid:'登入連結無效或已過期，請重新寄送。',verifier_missing:'找不到原分頁的登入驗證資料。請回到寄信的分頁，重新寄送並在同一分頁開啟郵件連結。',storage_unavailable:'瀏覽器未允許暫存登入驗證資料，無法安全完成登入。請允許此分頁的暫存功能後重試。',invalid_email:'請輸入有效的 Email。',invalid_public_game:'請檢查公開標題、簡介、GitHub 儲存庫、完整提交編號與授權；封面只接受本站已檢核圖檔路徑。',not_approved:'請先把遊戲設為「已核准」，再建立公開預覽。',approval_required:'請先核准遊戲並勾選人工檢核確認，再發布。',source_mismatch:'儲存庫必須和原投稿一致；原稿已有完整提交編號時也不能更換，未提供時才可補齊已核對的完整編號。',publication_incomplete:'請補齊素材權利說明，並勾選已人工核對權利，再重新建立公開預覽。',version_conflict:'另一位管理員已更新這則投稿。已重新讀取最新版本，請核對後再操作；你的修改沒有覆蓋其他人的變更。',rate_limited:'請稍候至少 60 秒再試；郵件服務也可能有寄送額度限制。',repo_verification_failed:'無法確認這是公開 GitHub 儲存庫中的指定完整提交，尚未發布。請核對儲存庫與提交編號。',repo_verification_unavailable:'GitHub 核對服務目前無法使用，尚未發布。請稍後重試。',not_found:'這則投稿已不存在或無法讀取。',invalid_response:'伺服器回覆無法核對，請重新讀取。',invalid_request:'資料格式無法核對，尚未發布。請重新讀取投稿並檢查補齊內容。',request_timeout:'連線逾時，請稍後重新讀取。',signup_disabled:'帳號尚未完成信箱邀請確認。請先開啟原邀請或確認郵件，完成後再寄送登入連結；這裡不開放自行註冊。',email_not_confirmed:'信箱尚未確認。請先完成原邀請或確認郵件，再回來登入。',over_email_send_rate_limit:'郵件寄送已達服務限制。請稍後再試；必要時請管理員檢查寄信額度。',over_request_rate_limit:'登入請求已達服務限制，請稍候再試。',email_address_not_authorized:'目前寄信服務不允許此收件地址。請管理員確認收件權限或寄信服務設定。',email_provider_disabled:'郵件登入目前未啟用，請管理員檢查登入服務設定。',validation_failed:'登入資料未通過驗證。請檢查 Email 格式；若仍失敗，請管理員核對登入設定。',otp_disabled:'這個工作台不建立新帳號。請先由管理員完成帳號建立、邀請與授權，再回來登入。',otp_expired:'登入連結已失效，請重新寄送並在原分頁開啟。',flow_state_expired:'登入驗證已逾時，請重新寄送連結。',flow_state_not_found:'找不到這次登入驗證，請重新寄送並在原分頁開啟。',bad_code_verifier:'登入驗證與原分頁不符，請重新寄送並在同一分頁開啟。',temporarily_unavailable:'目前無法完成操作。請稍後重試；本頁不顯示私人錯誤細節。'};
  let client=null,uiGeneration=0,listGeneration=0,detailGeneration=0,mutationTicket=0,items=[],nextOffset=0,current=null,mutationBusy=false,mailUntil=0,preview=null;
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(cls)n.className=cls;return n;};
  const message=text=>{$('message').textContent=text;$('message').hidden=!text;};
  const date=value=>{const d=new Date(value);return Number.isFinite(d.getTime())?d.toLocaleString('zh-TW',{hour12:false}):'未提供';};
  const safeURL=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}};
  const showError=error=>{if(error?.code!=='stale_request')message(errors[error?.code]||errors.temporarily_unavailable);};
  function clearPrivate(){uiGeneration++;listGeneration++;detailGeneration++;mutationTicket++;items=[];current=null;preview=null;nextOffset=0;mutationBusy=false;$('items').replaceChildren();$('detail').replaceChildren(el('p','選一則投稿，查看來源與審核紀錄。','empty'));$('list-count').textContent='';$('more').hidden=true;$('desk').hidden=true;$('login').hidden=false;$('email').value='';}
  function sessionChanged(state){if(!state.authorized){clearPrivate();if(state.reason&&state.reason!=='checking_access')message(errors[state.reason]||'已登出，此頁的私人內容已清空。');}else{$('login').hidden=true;$('desk').hidden=false;$('session-hint').textContent=`管理員權限已核對 · 本分頁登入最晚 ${date(state.expiresAt)} 到期`;}}
  const provided=value=>value===undefined||value===null||typeof value==='string'&&!value.trim()?'未提供／待核對':value;
  function link(value,label){const url=safeURL(value);if(!url)return el('span',provided(value));const a=el('a',label||url);a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.referrerPolicy='no-referrer';return a;}
  function field(list,label,value,{url=false}={}){list.append(el('dt',label));const dd=el('dd');dd.append(url?link(value):el('span',value===true?'是':value===false?'否':provided(value)));list.append(dd);}
  function active(){return client?.checkExpiry()===true;}
  function renderItems(){
    const holder=$('items');holder.replaceChildren();$('list-count').textContent=`已載入 ${items.length} 則`;
    for(const item of items){const b=el('button',undefined,'item');b.type='button';b.setAttribute('aria-current',String(item.id===current?.id));b.append(el('strong',item.title||'未提供標題'),el('span',`${R.SUBJECTS[R.subjectId(item)]} · ${item.kind==='quote'?'原話線索':'社群遊戲'} · ${statusText[item.status]||'未知狀態'}`,'badge'));b.append(el('small',`${date(item.createdAt)} · v${item.version}${item.hasContact?' · 有私人聯絡方式':''}${item.published?' · 已公開':''}`));b.addEventListener('click',()=>loadDetail(item.id));holder.append(b);}
    if(!items.length)holder.append(el('p','這個篩選條件目前沒有投稿。','empty'));
  }
  async function loadList(append=false){
    if(!active())return;const generation=++listGeneration,epoch=uiGeneration;$('refresh').disabled=true;$('more').disabled=true;
    if(!append){items=[];nextOffset=0;current=null;preview=null;detailGeneration++;mutationTicket++;mutationBusy=false;$('detail').replaceChildren(el('p','選一則投稿，查看來源與審核紀錄。','empty'));renderItems();}
    try{
      const result=await client.call('admin_list',{status:$('filter-status').value,kind:$('filter-kind').value,offset:append?nextOffset:0,limit:20});
      if(generation!==listGeneration||epoch!==uiGeneration||!active())return;
      if(!Array.isArray(result.items)||result.items.some(x=>!R.UUID.test(x?.id||'')||!['quote','game'].includes(x.kind)||!statusText[x.status]||!Number.isInteger(x.version)))throw new R.ReviewError('invalid_response');
      items=append?[...items,...result.items.filter(x=>!items.some(y=>y.id===x.id))]:result.items;nextOffset=Number.isInteger(result.nextOffset)?result.nextOffset:items.length;$('more').hidden=result.hasMore!==true;renderItems();message('');
    }catch(error){if(generation===listGeneration&&epoch===uiGeneration)showError(error);}
    finally{if(generation===listGeneration&&epoch===uiGeneration){$('refresh').disabled=false;$('more').disabled=false;}}
  }
  async function loadDetail(id,{notice=''}={}){
    if(!active())return;const generation=++detailGeneration,epoch=uiGeneration;mutationTicket++;mutationBusy=false;current=null;preview=null;$('detail').replaceChildren(el('p','正在讀取私人詳情…','empty'));
    try{const result=await client.call('admin_detail',{id});if(generation!==detailGeneration||epoch!==uiGeneration||!active())return;if(result.item?.id!==id||!result.item.payload||!statusText[result.item.status]||!Number.isInteger(result.item.version))throw new R.ReviewError('invalid_response');current=result.item;renderItems();renderDetail();if(notice)message(notice);}
    catch(error){if(generation===detailGeneration&&epoch===uiGeneration){$('detail').replaceChildren(el('p','無法讀取這則投稿。','empty'));showError(error);}}
  }
  function renderPayload(box,item){
    const p=item.payload,list=el('dl',undefined,'fields');
    field(list,'原投稿對象（固定）',R.SUBJECTS[R.subjectId(item)]);
    if(item.kind==='quote'){
      field(list,'投稿原話',p.quote);field(list,'來源',p.sourceUrl,{url:true});field(list,'來源日期',p.dateUnknown?'日期不確定':p.sourceDate);field(list,'原文位置',p.locator);field(list,'前後文',p.context);
    }else{
      field(list,'遊戲名稱',p.title);field(list,'遊戲簡介',p.summary);field(list,'GitHub',p.repoUrl,{url:true});field(list,'指定提交',p.commitSha);field(list,'第三方試玩',p.gameUrl,{url:true});field(list,'截圖（手動開啟）',p.screenshotUrl,{url:true});field(list,'程式授權',p.license);field(list,'素材權利說明',p.assetRights);field(list,'外部服務',p.externalServices);field(list,'權利確認',p.rightsConfirmed);
    }
    field(list,'補充說明',p.note);field(list,'署名同意',p.creditConsent===true?'同意公開署名':'未同意；不公開署名');if(p.creditConsent===true)field(list,'同意公開名稱',p.creditName||'未填');box.append(list);
    const privacy=el('section',undefined,'section private');privacy.append(el('h3','私人聯絡方式 · 不會出現在公開預覽'));
    privacy.append(el('p',item.contact?`${item.contact.kind==='email'?'Email':'聯絡方式'}：${item.contact.value}`:'未提供，或已超過聯絡資料保留期間。'));box.append(privacy);
  }
  function renderDetail(){
    const item=current;if(!item)return;const box=$('detail');box.replaceChildren();
    const top=el('div',undefined,'detail-top'),head=el('div');head.append(el('h2',item.title||'投稿詳情'),el('small',`${item.id} · v${item.version} · 更新 ${date(item.updatedAt)}`));top.append(head,el('span',statusText[item.status],'badge'));box.append(top);renderPayload(box,item);
    const form=el('form',undefined,'section moderation');form.id='moderation-form';form.append(el('h3','審核判定'));
    const statusLabel=el('label','狀態'),status=el('select');status.id='moderation-status';for(const [value,name]of Object.entries(statusText)){const o=el('option',name);o.value=value;status.append(o);}status.value=item.status;statusLabel.append(status);form.append(statusLabel);
    const noteLabel=el('label','私人審核備註'),note=el('textarea');note.id='moderation-note';note.maxLength=1000;note.value=item.moderatorNote||'';noteLabel.append(note);form.append(noteLabel);
    form.append(el('p',item.kind==='quote'?'核准只代表完成這則投稿的審核，不會自動加入現有原話庫或猜題。':'核准後仍須完成下方公開預覽，並另外按下「正式發布遊戲」。','notice'));
    const save=el('button','儲存審核判定');save.type='submit';save.disabled=mutationBusy;form.append(save);form.addEventListener('submit',event=>{event.preventDefault();mutate('admin_update',{status:status.value,note:note.value.trim()});});box.append(form);
    if(item.kind==='game')renderPublish(box,item);
    const history=el('section',undefined,'section');history.append(el('h3','審核操作紀錄'));const entries=el('ol',undefined,'history');
    for(const event of (Array.isArray(item.audit)?item.audit:[])){const li=el('li');li.append(el('strong',`${date(event.createdAt)} · ${event.action} · v${event.version}`),el('span',`${statusText[event.fromStatus]||'—'} → ${statusText[event.toStatus]||'—'}${event.note?'\n'+event.note:''}`));entries.append(li);}if(!entries.childNodes.length)entries.append(el('li','尚無審核操作。'));history.append(entries);box.append(history);
  }
  function renderPublish(box,item){
    const section=el('section',undefined,'section');section.append(el('h3','遊戲公開預覽與人工發布'));
    if(item.published){section.append(el('p',`目前已公開 · ${date(item.published.publishedAt)} · 發布版本 ${item.published.version}`,'notice'));const retractLabel=el('label','撤下原因（私人紀錄）'),retractNote=el('textarea');retractNote.maxLength=1000;retractLabel.append(retractNote);section.append(retractLabel);const retract=el('button','確認撤下公開遊戲','danger');retract.type='button';retract.disabled=mutationBusy;retract.addEventListener('click',()=>{if(!retractNote.value.trim()){message('請填寫撤下原因，再確認操作。');return;}if(confirm('確定撤下公開遊戲？私人投稿與審核紀錄仍保留。'))mutate('admin_retract',{note:retractNote.value.trim()});});section.append(retract);}
    if(item.status!=='approved'){section.append(el('p','這則遊戲尚未核准。完成上方審核後，才能建立公開預覽。','notice'));box.append(section);return;}
    if(item.published){section.append(el('p','若需更新公開內容，請先撤下，重新核對後再發布。','notice'));box.append(section);return;}
    section.append(el('p','請補齊並人工核對固定程式版本、授權、素材權利與外部服務。原稿未提供的資料仍是待核對；填寫並不代表原投稿本來已具備。發布時伺服器會再核對公開 GitHub 儲存庫與指定提交，這不代表程式已通過完整安全審查。','notice'));
    const fields=el('div',undefined,'publish-fields'),inputs={},p=item.payload,previewHolder=el('div');
    const invalidate=()=>{preview=null;previewHolder.replaceChildren();};
    const originalSubject=R.subjectId(item),subjectGroup=el('fieldset',undefined,'section'),subjectInputs=[];subjectGroup.append(el('legend','遊戲相關人物（至少保留原投稿對象）'));
    for(const [id,name]of Object.entries(R.SUBJECTS)){const label=el('label',undefined,'confirm'),input=el('input');input.type='checkbox';input.value=id;input.dataset.subject=id;input.checked=id===originalSubject;input.disabled=id===originalSubject;input.addEventListener('change',invalidate);label.append(input,document.createTextNode(name+(id===originalSubject?'（原投稿對象，必留）':'')));subjectGroup.append(label);subjectInputs.push(input);}section.append(subjectGroup);
    const fixedCommit=R.sourceCommit(item)!==null;
    const defs=[['title','公開名稱',p.title,100],['license','公開授權名稱（必填）',p.license,120],['summary','公開簡介',p.summary,1200,true],['repoUrl','投稿指定 GitHub 儲存庫（不可改）',p.repoUrl,2048],['commitSha',fixedCommit?'投稿指定完整提交編號（不可改）':'補齊已核對的完整提交編號（必填）',p.commitSha,40],['gameUrl','第三方試玩網址（可留白）',p.gameUrl,2048],['coverPath','本站已檢核封面路徑（可留白）','',120],['externalServices','會使用的外部服務（必填；已確認未使用請填無）',p.externalServices,1000,true]];
    for(const [key,title,value,max,wide]of defs){const label=el('label',title,wide?'wide':undefined),input=el(wide?'textarea':'input');input.value=value||'';input.maxLength=max;input.dataset.field=key;input.autocomplete='off';if(key==='repoUrl'||key==='commitSha'&&fixedCommit)input.readOnly=true;for(const event of ['input','change'])input.addEventListener(event,invalidate);label.append(input);fields.append(label);inputs[key]=input;}
    section.append(fields,el('p','原稿有提交編號時不得更換；未提供時可補齊已核對的 40 字元編號。封面只能使用 /assets/community/ 中已人工加入的 PNG／JPG 圖檔；留白使用預設畫面，不自動載入投稿截圖。','notice'));
    const evidence=el('div',undefined,'section private');evidence.append(el('h3','私人素材權利核對 · 不會放進公開預覽'));
    const rightsLabel=el('label','素材權利說明（必填，最多 1,200 字）'),rightsText=el('textarea');rightsText.dataset.evidence='assetRights';rightsText.maxLength=1200;rightsText.value=p.assetRights||'';rightsText.autocomplete='off';rightsLabel.append(rightsText);evidence.append(rightsLabel);
    const rightsConfirm=el('label',undefined,'confirm'),rightsCheck=el('input');rightsCheck.type='checkbox';rightsCheck.dataset.evidence='rightsConfirmed';rightsCheck.checked=false;rightsConfirm.append(rightsCheck,document.createTextNode('我已人工核對素材權利，並確認上方說明完整。'));evidence.append(rightsConfirm,el('p','可參考投稿者已提供的說明，但仍需重新人工確認。這份核對快照由伺服器私人保存，不改寫原稿，也不放進公開清單。','notice'));
    for(const input of [rightsText,rightsCheck])for(const event of ['input','change'])input.addEventListener(event,invalidate);
    section.append(evidence);
    // Unsaved moderation edits must also discard the old publication decision.
    for(const event of ['input','change'])$('moderation-form').addEventListener(event,invalidate);
    const snapshot=()=>{
      const values=Object.fromEntries(Object.entries(inputs).map(([key,input])=>[key,input.value]));values.subjectIds=subjectInputs.filter(input=>input.checked).map(input=>input.value);
      return {values:R.publicGame(item,values),evidence:R.reviewEvidence(item,{assetRights:rightsText.value,rightsConfirmed:rightsCheck.checked})};
    };
    const previewButton=el('button','建立公開預覽','secondary');previewButton.type='button';
    previewButton.addEventListener('click',()=>{
      try{
        const draft=snapshot(),view=R.publicPreview(item,draft.values);preview={id:item.id,version:item.version,values:draft.values,reviewEvidence:draft.evidence};previewHolder.replaceChildren();const card=el('div',undefined,'preview');card.append(el('h3',view.title),el('p',view.summary),el('small',view.creditName?`作者同意公開署名：${view.creditName}`:'未公開作者署名'));
        const list=el('ul');for(const text of [`相關人物：${view.subjectIds.map(id=>R.SUBJECTS[id]).join('／')}`,`授權：${view.license}`,`原始碼：${view.repoUrl}`,`提交：${view.commitSha}`,`試玩：${view.gameUrl||'尚未提供'}`,`外部服務：${view.externalServices}`,`封面：${view.coverPath||'預設畫面'}`])list.append(el('li',text));card.append(list,el('small','以上是會公開的欄位；不包含素材權利核對快照、私人聯絡方式、投稿補充說明或審核備註。'));
        const label=el('label',undefined,'confirm'),check=el('input');check.type='checkbox';label.append(check,document.createTextNode('我已人工核對指定程式版本、內容、素材與外部服務，並確認以上欄位可以公開。'));card.append(label);
        const publish=el('button','正式發布遊戲','danger');publish.type='button';publish.disabled=true;check.addEventListener('change',()=>{publish.disabled=!check.checked||mutationBusy;});publish.addEventListener('click',()=>{
          if(!check.checked||preview?.id!==current?.id||preview.version!==current.version)return;
          try{
            const latest=snapshot();if(JSON.stringify(latest.values)!==JSON.stringify(preview.values)||JSON.stringify(latest.evidence)!==JSON.stringify(preview.reviewEvidence)){invalidate();message('補齊資料已變更，請重新建立公開預覽並確認。');return;}
            mutate('admin_publish',{reviewConfirmed:true,publicGame:preview.values,reviewEvidence:preview.reviewEvidence});
          }catch(error){invalidate();showError(error);}
        });card.append(publish);previewHolder.append(card);message('公開預覽已建立。核對內容並勾選確認後，才可正式發布；修改資料會使這份預覽失效。');
      }catch(error){invalidate();showError(error);}
    });section.append(previewButton,previewHolder);box.append(section);
  }
  async function mutate(action,extra){
    if(mutationBusy||!current||!active())return;const item=current,epoch=uiGeneration,generation=detailGeneration,ticket=++mutationTicket;mutationBusy=true;for(const b of $('detail').querySelectorAll('button'))b.disabled=true;
    try{
      const result=await client.call(action,{id:item.id,expectedVersion:item.version,...extra});if(epoch!==uiGeneration||generation!==detailGeneration||!active())return;
      if(result.item?.id!==item.id||!Number.isInteger(result.item.version)||result.item.version<=item.version||!statusText[result.item.status])throw new R.ReviewError('invalid_response');
      const summary=result.item;const index=items.findIndex(x=>x.id===item.id);if(index>=0)items[index]={...items[index],...summary};mutationBusy=false;renderItems();
      await loadDetail(item.id,{notice:action==='admin_publish'?'遊戲已發布到社群清單。':action==='admin_retract'?'公開遊戲已撤下。':'審核判定已儲存。原話不會自動加入題庫。'});
    }catch(error){if(epoch!==uiGeneration||generation!==detailGeneration)return;mutationBusy=false;if(error.code==='version_conflict'){await loadDetail(item.id,{notice:errors.version_conflict});}else{renderDetail();showError(error);}}
    finally{if(epoch===uiGeneration&&ticket===mutationTicket)mutationBusy=false;}
  }
  $('login-form').addEventListener('submit',async event=>{event.preventDefault();if(!client?.enabled||Date.now()<mailUntil)return;$('send-link').disabled=true;try{await client.sendLink($('email').value,new URL('/review/',location.origin).href);$('email').value='';mailUntil=Date.now()+60000;message('若帳號已建立且可收信，請查看一次性登入郵件。請複製連結並在寄信的原分頁開啟；這裡不會建立新帳號。');}catch(error){showError(error);}finally{$('send-link').disabled=Date.now()<mailUntil;}});
  $('logout').addEventListener('click',()=>{client?.signOut();});$('refresh').addEventListener('click',()=>loadList());$('more').addEventListener('click',()=>loadList(true));for(const id of ['filter-status','filter-kind'])$(id).addEventListener('change',()=>loadList());
  // Navigation to the one-use email URL must retain its short-lived PKCE verifier.
  // Credentials/private DOM are still cleared; explicit signout removes the verifier too.
  window.addEventListener('pagehide',()=>{client?.clear('signed_out',{preserveVerifier:true});clearPrivate();});window.addEventListener('pageshow',event=>{if(event.persisted){client?.clear('signed_out',{preserveVerifier:true});message('返回此頁時已清空私人資料，請重新登入。');}});
  setInterval(()=>{client?.checkExpiry();if(client?.enabled&&Date.now()>=mailUntil)$('send-link').disabled=false;},1000);
  (async()=>{
    try{
      const response=await fetch('/contribute/config.json?v=17',{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok)throw new Error();const settings=await response.json();client=new R.Client({settings,onChange:sessionChanged});
      if(!client.enabled){clearPrivate();message(errors.not_configured);return;}$('email').disabled=false;$('send-link').disabled=false;
      if(callback){message('正在核對管理員權限…');try{await client.authenticate(callback);await loadList();}catch(error){showError(error);}}
      else message('請以已授權的管理員帳號登入。登入連結不會建立新帳號。');
    }catch{message('目前無法讀取工作台設定，尚未讀取任何投稿。');}
  })();
})();
