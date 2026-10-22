/* One source card and at most one player. Opening a card is not verification. */
(() => {
  'use strict';
  const scriptURL = document.currentScript?.src || location.href;
  const manifestURL = new URL('./data/statement-media-v41.json', scriptURL).href;
  const resolverURL = 'https://wggebwlqsfxuwaocfpsf.supabase.co/functions/v1/arcade-api';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const lowPower = () => Boolean(navigator.connection?.saveData || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2));
  let selectionCore = null, subject = '', sourceVersion = '', ids = [], quotes = new Map(), media = new Map(), opened = new Set();
  let registered = false, persistent = true, manifestPromise, apiPromise, hlsPromise;
  let overlay, panel, tilt, origin, activeQuote = null, player = null, playerReady = false, hlsPlayer = null, video = null;
  let generation = 0, loopTimer = 0, mediaTimer = 0, animation = null, frame = 0, orientation = null, inertElements = [];
  let previousOverflow = '', lastPointer = null, lastTilt = {x:0,y:0}, muted = true, closing = false, resolverAbort = null, expanded = false, ownsFullscreen = false;

  function safeHttps(value) {
    try { const u = new URL(String(value || '')); return u.protocol === 'https:' && !u.username && !u.password ? u.href : null; } catch { return null; }
  }
  function youtubeId(value) {
    try {
      const u = new URL(value), host = u.hostname.toLowerCase().replace(/^www\./, '');
      const id = host === 'youtu.be' ? u.pathname.slice(1).split('/')[0] : ['youtube.com','m.youtube.com','youtube-nocookie.com'].includes(host) ? (u.searchParams.get('v') || /^\/(?:embed|shorts|live)\/([^/]+)/.exec(u.pathname)?.[1]) : '';
      return /^[A-Za-z0-9_-]{11}$/.test(id || '') ? id : null;
    } catch { return null; }
  }
  function normalizeMedia(item, quote) {
    item = item || {};
    const sourceUrl = safeHttps(item.sourceUrl) || safeHttps(quote.url);
    const id = /^[A-Za-z0-9_-]{11}$/.test(item.youtubeId || '') ? item.youtubeId : null;
    const known = [item.sourceUrl,item.videoUrl,item.fullVideoUrl,quote.videoUrl,quote.fullVideoUrl,quote.url].some(value => youtubeId(value) === id);
    const hlsUrl = item.provider === 'hls' && item.manifestVerified === true ? safeHttps(item.hlsUrl) : null;
    const officialClip = sourceUrl && /^https:\/\/ivod\.ly\.gov\.tw\/Play\/Clip\/1M\/\d+$/.test(sourceUrl);
    const resolved = item.provider==='ivod-resolved' && item.resolverUrl===resolverURL && item.resolverQuoteId===quote.id && officialClip;
    const type = quote.medium === 'written' ? 'article' : resolved ? 'ivod-resolved' : hlsUrl ? 'hls' : item.type === 'youtube' && id && known ? 'youtube' : 'external';
    const verified = ['youtube','hls'].includes(type) && item.verificationStatus === 'verified-clip' && Number.isFinite(item.verifiedStart) && Number.isFinite(item.verifiedEnd) && item.verifiedStart >= 0 && item.verifiedEnd > item.verifiedStart;
    const credit = item.publicCredit;
    return {
      type, sourceUrl, resolverQuoteId:resolved?quote.id:null, evidenceSourceUrl:safeHttps(item.evidenceSourceUrl), sourceEvidenceUrls:(Array.isArray(item.sourceEvidenceUrls)?item.sourceEvidenceUrls:[]).slice(0,8).map(safeHttps).filter(Boolean), hlsUrl:type==='hls'?hlsUrl:null, videoUrl:safeHttps(item.videoUrl), fullVideoUrl:safeHttps(item.fullVideoUrl), youtubeId: type === 'youtube' ? id : null,
      verifiedStart: verified ? item.verifiedStart : null, verifiedEnd: verified ? item.verifiedEnd : null, verified,
      thumbnailUrl: safeHttps(item.thumbnailUrl),
      label: ['youtube','hls','ivod-resolved'].includes(type) ? (verified ? '已定位影片片段' : ['hls','ivod-resolved'].includes(type)?(item.sourceVideoScope==='full-member-speech'?'官方整段本人發言，原句起迄待定位':'官方完整來源影片，原句起迄待定位'):item.sourceVideoScope === 'publisher-news-report' ? '新聞來源影片，原句起迄待定位' : '完整影片，片段待定位') : type === 'article' ? '本人文章原文卡' : '原話文字卡・另開原站',
      locatorNote: String(item.locatorNote || quote.videoAvailabilityNote || ''),
      credit: credit && credit.approved === true && typeof credit.name === 'string' && credit.name.trim() ? {name:credit.name.trim().slice(0,100),url:safeHttps(credit.url)} : null
    };
  }
  function validateResolvedMedia(value,m,q) {
    const item=value?.item;
    if(!item||item.version!=='statement-media-v26'||item.quoteId!==q.id||item.provider!=='hls'||item.sourceExtracted!==true||item.sourceUrl!==m.sourceUrl||item.sourceVideoScope!=='official-public-source-full-video'||item.verifiedStart!==null||item.verifiedEnd!==null) return null;
    const href=safeHttps(item.hlsUrl);if(!href)return null;
    const u=new URL(href);
    if(u.hostname!=='ivod-lyvod.cdn.hinet.net'||u.port||u.search||u.hash||!/^\/vod_1\/_definst_\/mp4:1MClips\/[a-f0-9]{64,256}\.mp4\/playlist\.m3u8$/.test(u.pathname))return null;
    return {...m,type:'hls',hlsUrl:href,verified:false,verifiedStart:null,verifiedEnd:null};
  }
  function storageKey() { return `records:statement-collection:v1:${subject}`; }
  function readCollection(value) {
    try { const d = JSON.parse(value); return d?.version === 1 && d.subjectId === subject && Array.isArray(d.opened) ? new Set(d.opened.filter(id => ids.includes(id))) : new Set(); } catch { return new Set(); }
  }
  function progress(values = opened) { const count = ids.filter(id => values.has(id)).length; return {count,total:ids.length,complete:ids.length > 0 && count === ids.length}; }
  function saveOpened(id) {
    opened.add(id);
    try { localStorage.setItem(storageKey(),JSON.stringify({version:1,subjectId:subject,opened:ids.filter(id => opened.has(id))})); } catch { persistent = false; }
    updateCollection();
  }
  function updateCollection() {
    const value = progress();
    document.querySelectorAll('[data-statement-collection]').forEach(el => {
      el.textContent = value.complete ? `本期 ${value.total} 張已全部開啟` : `已開啟 ${value.count}／${value.total} 張`;
      el.dataset.complete = String(value.complete);
    });
    document.querySelectorAll('[data-statement-open]').forEach(el => {
      const seen = opened.has(el.dataset.statementOpen);
      el.dataset.opened = String(seen);
      const badge = el.querySelector('.stmt-media-opened');
      if (badge) badge.textContent = seen ? '已開啟' : '開啟閃卡';
    });
    const note = document.getElementById('statement-collection-note');
    if (note) note.textContent = persistent ? '開啟紀錄僅存本機，不代表已觀看或查證。' : '此瀏覽器無法儲存；只記錄本次開啟，不代表已查證。';
  }
  function entryContent(q) {
    const m = media.get(q.id) || normalizeMedia(null,q);
    const image = m.thumbnailUrl ? `<img src="${esc(m.thumbnailUrl)}" loading="lazy" decoding="async" alt="" referrerpolicy="no-referrer">` : `<span class="stmt-media-paper" aria-hidden="true"><span>“</span>${esc(String(q.quote || '').slice(0,28))}</span>`;
    return `${image}<span class="stmt-media-kind">${['youtube','hls','ivod-resolved'].includes(m.type) ? '▶ 影片' : m.type === 'article' ? '文 文章' : '↗ 原文'}</span><span class="stmt-media-opened">${opened.has(q.id) ? '已開啟' : '開啟閃卡'}</span>`;
  }
  function entry(q) {
    return `<button type="button" class="stmt-media-entry" data-statement-open="${esc(q.id)}" data-opened="${opened.has(q.id)}" aria-haspopup="dialog" aria-label="開啟原話閃卡：${esc(q.title)}">${entryContent(q)}</button>`;
  }
  function hydrate(root = document) {
    root.querySelectorAll('[data-statement-open]').forEach(el => {
      const q = quotes.get(el.dataset.statementOpen);
      if (q) el.innerHTML = entryContent(q);
    });
    updateCollection();
  }
  async function loadManifest() {
    if (manifestPromise) return manifestPromise;
    manifestPromise = fetch(manifestURL,{cache:'no-cache'}).then(r => { if (!r.ok) throw Error('media_unavailable'); return r.json(); }).then(d => {
      if (d.version !== 'v41' || d.subjectId !== subject || d.sourceVersion !== sourceVersion || d.selectionVersion !== selectionCore?.VERSION || !Array.isArray(d.items)) throw Error('media_source_mismatch');
      const found = new Set();
      for (const item of d.items) {
        if (!ids.includes(item.quoteId) || found.has(item.quoteId)) continue;
        found.add(item.quoteId); media.set(item.quoteId,normalizeMedia(item,quotes.get(item.quoteId)));
      }
      hydrate();
    }).catch(() => { /* Keep exact text/source cards when reviewed media is unavailable. */ });
    return manifestPromise;
  }
  function register(options) {
    const core = options.core || window.RecordsQuizShareV41;
    if (!core || options.subjectId !== core.SUBJECT || options.sourceVersion !== core.SOURCE_VERSION) return false;
    selectionCore = core; subject = options.subjectId; sourceVersion = options.sourceVersion;
    quotes = new Map(options.quotes.filter(q => core.isQuizEligible(q)).map(q => [q.id,q]));
    ids = core.CURATED_IDS.filter(id => quotes.has(id));
    try { opened = readCollection(localStorage.getItem(storageKey())); } catch { persistent = false; opened = new Set(); }
    registered = true; updateCollection(); loadManifest(); return true;
  }

  function ensureOverlay() {
    if (overlay) return;
    const native = typeof HTMLDialogElement !== 'undefined' && typeof HTMLDialogElement.prototype.showModal === 'function';
    overlay = document.createElement(native ? 'dialog' : 'div');
    overlay.className = 'stmt-flash-overlay'; overlay.id = 'statement-flash-dialog';
    overlay.setAttribute('aria-labelledby','statement-flash-title'); overlay.setAttribute('aria-describedby','statement-flash-disclaimer');
    if (!native) { overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.dataset.fallback='true';overlay.hidden=true; }
    overlay.innerHTML = `<div class="stmt-flash-panel"><div class="stmt-flash-tilt"><header class="stmt-flash-header"><span class="stmt-flash-kicker">原話閃卡</span><button type="button" class="stmt-flash-close" data-flash-close aria-label="關閉原話閃卡">✕</button></header><div class="stmt-flash-drag" tabindex="0" aria-label="拖曳這裡讓卡片微傾；方向鍵也可操作"><span aria-hidden="true">⋮⋮</span> 拖曳卡片，換個角度讀</div><div class="stmt-flash-scroll"><div class="stmt-flash-meta" id="statement-flash-meta"></div><h2 id="statement-flash-title" tabindex="-1"></h2><div class="stmt-flash-media" id="statement-flash-media"></div><div class="stmt-flash-player-controls" id="statement-flash-player-controls" hidden><button type="button" data-flash-play hidden>按下播放</button><button type="button" data-flash-mute aria-pressed="true">開啟聲音</button><button type="button" data-flash-fullscreen>全螢幕影片</button></div><p class="stmt-flash-media-note" id="statement-flash-media-note" role="status"></p><blockquote id="statement-flash-quote"></blockquote><p id="statement-flash-context"></p><details class="stmt-flash-evidence"><summary>前後文與證據位置 ＋</summary><p id="statement-flash-evidence"></p><p id="statement-flash-limit"></p></details><nav class="stmt-flash-links" id="statement-flash-links" aria-label="原話來源"></nav><p class="stmt-flash-credit" id="statement-flash-credit" hidden></p><button type="button" class="stmt-flash-sensor" data-flash-sensor>啟用手機感應微傾</button></div><footer class="stmt-flash-footer"><strong data-statement-collection aria-live="polite"></strong><p id="statement-flash-disclaimer">開啟紀錄僅存本機，不代表已觀看或查證。</p></footer></div></div>`;
    const footer=overlay.querySelector('.stmt-flash-footer');
    const contribute=document.createElement('a');contribute.className='stmt-flash-contribute';contribute.href='/contribute/?type=quote';contribute.textContent='補充影片／申請發現者署名';footer.append(contribute);
    const contributionNote=document.createElement('p');contributionNote.textContent='補上原始影片與時間點，經人工核對採用後，可標註自願公開署名的發現者。聯絡方式不公開。';footer.append(contributionNote);
    document.body.append(overlay);panel=overlay.querySelector('.stmt-flash-panel');tilt=overlay.querySelector('.stmt-flash-tilt');
    decorateTilt();resetTilt();
    overlay.querySelector('[data-flash-close]').addEventListener('click',close);
    overlay.addEventListener('cancel',event => {event.preventDefault();if(expanded)toggleFullscreen();else close();});
    overlay.addEventListener('click',event => { if (event.target === overlay) close(); });
    overlay.addEventListener('keydown',trapFocus);
    overlay.querySelector('[data-flash-play]').addEventListener('click',event=>{if(!playerReady)return;try{if(video){video.play().then(()=>{event.currentTarget.hidden=true;}).catch(()=>setMediaNote('請使用影片內的播放鍵，或開啟原站來源。'));}else{player.playVideo();event.currentTarget.hidden=true;}}catch{}});
    overlay.querySelector('[data-flash-mute]').addEventListener('click',() => {
      if (!playerReady) return;
      try { muted = !muted; if(video)video.muted=muted;else muted ? player.mute() : player.unMute(); updateMuteButton(); } catch {}
    });
    overlay.querySelector('[data-flash-fullscreen]').addEventListener('click',toggleFullscreen);
    overlay.querySelector('[data-flash-sensor]').addEventListener('click',enableSensor);
    bindTiltControls(overlay.querySelector('.stmt-flash-drag'));
  }
  function decorateTilt() {
    const layers=['stmt-flash-foil','stmt-flash-glare'].map(name=>{const layer=document.createElement('span');layer.className=name;layer.setAttribute('aria-hidden','true');return layer;});
    tilt.prepend(...layers);
  }
  function bindTiltControls(handle) {
    handle.addEventListener('pointerdown',event => { if (!activeQuote || expanded || reduceMotion.matches || lowPower()) {resetTilt();return;} lastPointer={id:event.pointerId,x:event.clientX,y:event.clientY,handle};handle.setPointerCapture?.(event.pointerId); });
    handle.addEventListener('pointermove',event => { if (lastPointer?.id !== event.pointerId) return;queueTilt((event.clientY-lastPointer.y)/12,(event.clientX-lastPointer.x)/12); });
    const release=() => resetTilt();
    handle.addEventListener('pointerup',release);handle.addEventListener('pointercancel',release);handle.addEventListener('lostpointercapture',release);
    handle.addEventListener('blur',release);
    handle.addEventListener('keydown',event => {
      if(event.key==='Home'){event.preventDefault();resetTilt();return;}
      const delta={ArrowUp:[-3,0],ArrowDown:[3,0],ArrowLeft:[0,-3],ArrowRight:[0,3]}[event.key];
      if (!delta || reduceMotion.matches || lowPower()) return;
      event.preventDefault();queueTilt(lastTilt.x+delta[0],lastTilt.y+delta[1]);
    });
    handle.addEventListener('keyup',event=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key))resetTilt();});
  }
  function updateMuteButton() {
    const button=overlay.querySelector('[data-flash-mute]');button.textContent=muted?'開啟聲音':'靜音';button.setAttribute('aria-pressed',String(muted));button.setAttribute('aria-label',muted?'目前靜音，按下開啟聲音':'目前有聲音，按下靜音');
  }
  function setExpanded(value) {
    expanded=Boolean(value);if(!overlay)return;
    overlay.dataset.expanded=String(expanded);
    const button=overlay.querySelector('[data-flash-fullscreen]');button.textContent=expanded?'回到卡片':'放大影片';button.setAttribute('aria-pressed',String(expanded));
    resetTilt(true);
    if(expanded){animation?.cancel();animation=null;}
  }
  async function toggleFullscreen() {
    if(!activeQuote)return;
    if(expanded){
      if(document.fullscreenElement&&overlay.contains(document.fullscreenElement))try{await document.exitFullscreen();}catch{}
      else if(video?.webkitDisplayingFullscreen&&video.webkitExitFullscreen)try{video.webkitExitFullscreen();}catch{}
      setExpanded(false);return;
    }
    setExpanded(true);
    const scroll=overlay.querySelector('.stmt-flash-scroll');scroll.scrollTop=0;
    try{
      if(panel.requestFullscreen)await panel.requestFullscreen();
      else if(video?.webkitEnterFullscreen)video.webkitEnterFullscreen();
      // The same expanded panel remains usable when the browser has no fullscreen API.
    }catch{ /* CSS expansion is the complete fallback, with the same live player. */ }
  }
  function trapFocus(event) {
    if (event.key === 'Escape') {event.preventDefault();if(expanded)toggleFullscreen();else close();return;}
    if (event.key !== 'Tab') return;
    const focusable=[...overlay.querySelectorAll('button:not([disabled]),a[href],summary,[tabindex="0"],iframe')].filter(el => !el.hidden && !el.closest('[hidden]'));
    if (!focusable.length) return;
    const first=focusable[0],last=focusable.at(-1);
    if (event.shiftKey && (document.activeElement===first || document.activeElement===document.getElementById('statement-flash-title'))) {event.preventDefault();last.focus();}
    else if (!event.shiftKey && document.activeElement===last) {event.preventDefault();first.focus();}
  }
  function setMediaNote(value) { document.getElementById('statement-flash-media-note').textContent=value; }
  function sourceLinks(q,m) {
    const values=[{url:m.sourceUrl,label:'讀原始來源'},{url:q.url,label:'原文與逐字稿來源'},{url:m.evidenceSourceUrl,label:'原始紀錄來源'},{url:m.videoUrl,label:'到原站看來源影片'},{url:m.fullVideoUrl,label:'完整來源影片'},{url:q.videoUrl,label:q.videoLabel||'到原站看影片'},{url:q.fullVideoUrl,label:q.fullVideoLabel||'完整影片'}];
    const labels=new Map([
      ['https://50th.itri.org.tw/history/origin/46/','工研院：1973年成立沿革'],
      ['https://50th.itri.org.tw/history/semiconductors/1/','工研院：RCA第一批受訓名單'],
      ['https://50th.itri.org.tw/leaders/','工研院：張忠謀院長任期'],
      ['https://50th.itri.org.tw/history/semiconductors/2/','工研院：聯電與台積電衍生史']
    ]);
    const evidence=[...(Array.isArray(q.sourceEvidenceUrls)?q.sourceEvidenceUrls:[]),...(Array.isArray(m.sourceEvidenceUrls)?m.sourceEvidenceUrls:[])].slice(0,16);
    values.push(...evidence.map(value=>({url:value,label:labels.get(safeHttps(value))||'補充核對來源'})));
    const seen=new Set();
    return values.filter(s => {s.url=safeHttps(s.url);if(!s.url||seen.has(s.url))return false;seen.add(s.url);return true;}).map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.label)} ↗</a>`).join('');
  }
  async function open(id,trigger) {
    if (!registered || !quotes.has(id)) return;
    if (activeQuote) await close(false);
    ensureOverlay();stopMedia();generation++;closing=false;
    const token=generation,q=quotes.get(id),m=media.get(id)||normalizeMedia(null,q);
    activeQuote=q;origin=trigger||document.activeElement;setExpanded(false);
    document.getElementById('statement-flash-title').textContent=q.title;
    document.getElementById('statement-flash-meta').textContent=`${q.date} · ${q.medium==='written'?'本人文章':'口語發言'} · ${m.label}`;
    document.getElementById('statement-flash-quote').textContent=`「${q.quote}」`;
    document.getElementById('statement-flash-context').textContent=q.frontContext||q.context||'';
    document.getElementById('statement-flash-evidence').textContent=[q.context,q.evidenceLocator,m.locatorNote].filter(Boolean).join('\n\n');
    document.getElementById('statement-flash-limit').textContent=q.inferenceLimit ? `判讀範圍：${q.inferenceLimit}` : '';
    document.getElementById('statement-flash-links').innerHTML=sourceLinks(q,m);
    const credit=document.getElementById('statement-flash-credit');credit.hidden=!m.credit;
    credit.innerHTML=m.credit?`發現者：${m.credit.url?`<a href="${esc(m.credit.url)}" target="_blank" rel="noopener noreferrer">${esc(m.credit.name)}</a>`:esc(m.credit.name)}`:'';
    const box=document.getElementById('statement-flash-media');box.dataset.type=m.type;
    box.innerHTML=['youtube','hls','ivod-resolved'].includes(m.type)?'<div class="stmt-flash-loading">準備原站播放器…</div>':`<div class="stmt-flash-text-card"><span>${m.type==='article'?'本人文章':'原話文字'}</span><p>${esc(q.quote)}</p><small>${m.type==='article'?'閱讀文章原文與完整脈絡':'此來源暫無可嵌入影片，請由下方連結開啟原站。'}</small></div>`;
    document.getElementById('statement-flash-player-controls').hidden=true;
    overlay.querySelector('[data-flash-play]').hidden=true;
    setMediaNote(['youtube','hls','ivod-resolved'].includes(m.type) ? `${m.label}${m.verified?' · 依已核起訖循環；也可到原站看完整影片。':' · 循環播放來源整段，不是這句話的已定位剪輯。'}` : m.locatorNote);
    overlay.querySelector('.stmt-flash-evidence').open=false;
    const sensor=overlay.querySelector('[data-flash-sensor]');sensor.hidden=reduceMotion.matches||lowPower()||!window.DeviceOrientationEvent;sensor.disabled=false;sensor.textContent='啟用手機感應微傾';
    previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
    overlay.dataset.lowPower=String(lowPower());
    const from=origin?.getBoundingClientRect?.();
    if (overlay.showModal) overlay.showModal(); else {overlay.hidden=false;inertElements=[...document.body.children].filter(el=>el!==overlay&&!el.inert);inertElements.forEach(el=>el.inert=true);}
    overlay.querySelector('.stmt-flash-scroll').scrollTop=0;
    saveOpened(id);document.getElementById('statement-flash-title').focus({preventScroll:true});
    animateFrom(from);
    if (m.type==='youtube') mountPlayer(q,m,token);
    if (m.type==='hls') mountHls(q,m,token);
    if (m.type==='ivod-resolved') mountResolved(q,m,token);
  }
  function animateFrom(from) {
    if (!from?.width || reduceMotion.matches || lowPower() || !panel.animate) return;
    const to=panel.getBoundingClientRect();
    animation?.cancel();
    animation=panel.animate([{transform:`translate(${from.left+from.width/2-to.left-to.width/2}px,${from.top+from.height/2-to.top-to.height/2}px) scale(${Math.max(.12,from.width/to.width)},${Math.max(.12,from.height/to.height)})`,opacity:.45},{transform:'none',opacity:1}],{duration:360,easing:'cubic-bezier(.2,.75,.2,1)',fill:'none'});
    const current=animation;current.finished.catch(()=>{}).finally(()=>{current.cancel();if(animation===current)animation=null;});
  }
  function loadYouTube() {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (apiPromise) return apiPromise;
    apiPromise=new Promise((resolve,reject)=>{
      const previous=window.onYouTubeIframeAPIReady;
      const timer=setTimeout(()=>reject(Error('youtube_timeout')),12000);
      window.onYouTubeIframeAPIReady=()=>{clearTimeout(timer);try{previous?.();}catch{}resolve(window.YT);};
      let script=document.getElementById('statement-youtube-api');
      if(!script){script=document.createElement('script');script.id='statement-youtube-api';script.src='https://www.youtube.com/iframe_api';script.async=true;script.addEventListener('error',()=>{clearTimeout(timer);reject(Error('youtube_unavailable'));});document.head.append(script);}
    });
    return apiPromise;
  }
  async function mountPlayer(q,m,token) {
    startMediaWatchdog(token);
    try {
      const YT=await loadYouTube();if(token!==generation||!activeQuote)return;
      const box=document.getElementById('statement-flash-media');box.replaceChildren();
      muted=true;updateMuteButton();
      const vars={autoplay:1,mute:1,playsinline:1,controls:1,rel:0,enablejsapi:1,origin:location.origin,loop:1,playlist:m.youtubeId};
      if(m.verified){vars.start=Math.floor(m.verifiedStart);vars.end=Math.ceil(m.verifiedEnd);}
      const embedURL=new URL(`https://www.youtube-nocookie.com/embed/${m.youtubeId}`);for(const [key,value]of Object.entries(vars))embedURL.searchParams.set(key,String(value));
      const iframe=document.createElement('iframe');iframe.id='statement-youtube-player';iframe.setAttribute('referrerpolicy','strict-origin-when-cross-origin');iframe.title=`${q.title}：原站 YouTube 影片`;iframe.setAttribute('allow','autoplay; encrypted-media; picture-in-picture; fullscreen');iframe.setAttribute('allowfullscreen','');iframe.src=embedURL.href;box.append(iframe);
      setMediaNote(`${m.label} · 正在等待 YouTube 播放器；若無法載入，可由下方連結開啟原站。`);
      player=new YT.Player(iframe,{host:'https://www.youtube-nocookie.com',videoId:m.youtubeId,width:'100%',height:'100%',playerVars:vars,events:{
        onReady:event=>{
          if(token!==generation||player!==event.target){try{event.target.destroy();}catch{}return;}
          clearTimeout(mediaTimer);mediaTimer=0;
          playerReady=true;event.target.mute();if(m.verified)event.target.seekTo(m.verifiedStart,true);event.target.playVideo();
          document.getElementById('statement-flash-player-controls').hidden=false;
          setMediaNote(`${m.label}${m.verified?' · 依已核起訖循環；也可到原站看完整影片。':' · 循環播放完整來源，並非這句話的已定位剪輯。'}`);
          if(m.verified)loopTimer=setInterval(()=>{try{const time=player?.getCurrentTime?.();if(playerReady&&player.getPlayerState()===1&&(time>=m.verifiedEnd-.12||time<m.verifiedStart-.5)){player.seekTo(m.verifiedStart,true);player.playVideo();}}catch{}},250);
        },
        onStateChange:event=>{if(token===generation&&event.data===0){event.target.seekTo(m.verified?m.verifiedStart:0,true);event.target.playVideo();}},
        onAutoplayBlocked:()=>{if(token===generation&&activeQuote){overlay.querySelector('[data-flash-play]').hidden=false;setMediaNote(`${m.label} · 瀏覽器暫停了自動播放，請按「按下播放」或播放器內的播放鍵。`);}},
        onError:event=>{if(token===generation&&activeQuote){generation++;stopMedia();box.innerHTML='<div class="stmt-flash-loading">原站無法嵌入此影片。</div>';setMediaNote(`YouTube 暫時無法在這裡播放${event?.data?`（代碼 ${event.data}）`:''}；可從下方影片連結開啟原站，原話與脈絡仍可閱讀。`);}}
      }});
    } catch {if(token===generation&&activeQuote){generation++;stopMedia();document.getElementById('statement-flash-media').innerHTML='<div class="stmt-flash-loading">播放器暫時無法載入。</div>';setMediaNote('可從下方來源連結開啟原站影片。');}}
  }
  function startMediaWatchdog(token) {
    if(mediaTimer)return;
    mediaTimer=setTimeout(()=>{if(token!==generation||!activeQuote||playerReady)return;generation++;stopMedia();document.getElementById('statement-flash-media').innerHTML='<div class="stmt-flash-loading">播放器等候逾時。</div>';setMediaNote('影片未在 10 秒內就緒，已停止嵌入。請按下方影片連結到原站播放；原話與脈絡仍可閱讀。');},10000);
  }
  async function mountResolved(q,m,token) {
    startMediaWatchdog(token);
    const controller=new AbortController();resolverAbort=controller;
    try {
      const endpoint=new URL(resolverURL);endpoint.searchParams.set('action','media');endpoint.searchParams.set('quoteId',q.id);
      const response=await fetch(endpoint.href,{credentials:'omit',cache:'no-store',redirect:'error',signal:controller.signal});
      if(token!==generation||!activeQuote)return;
      if(!response.ok)throw Error('media_source_unavailable');
      const text=await response.text();if(text.length>16384)throw Error('media_source_oversize');
      const resolved=validateResolvedMedia(JSON.parse(text),m,q);if(!resolved)throw Error('media_source_mismatch');
      if(token!==generation||!activeQuote)return;
      await mountHls(q,resolved,token);
    } catch {
      if(token!==generation||!activeQuote)return;
      generation++;stopMedia();document.getElementById('statement-flash-media').innerHTML='<div class="stmt-flash-loading">官方來源暫時無法讀取。</div>';setMediaNote('沒有取得可用的即時串流網址；請由下方連結開啟官方原站。原文與證據位置仍可閱讀。');
    } finally {if(resolverAbort===controller)resolverAbort=null;}
  }
  function loadHlsLibrary() {
    if(window.Hls)return Promise.resolve(window.Hls);
    if(hlsPromise)return hlsPromise;
    hlsPromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/hls.js@1.7.3/dist/hls.min.js';
      script.integrity='sha384-cciJ0zi8d1uMKC2zJd7jvPY4HQt7W4ByUI/FlMkltvBi31aW61rcpVBhpmW8/NwX';script.crossOrigin='anonymous';script.async=true;
      const timer=setTimeout(()=>reject(Error('hls_timeout')),12000);
      script.addEventListener('load',()=>{clearTimeout(timer);window.Hls?resolve(window.Hls):reject(Error('hls_unavailable'));});
      script.addEventListener('error',()=>{clearTimeout(timer);reject(Error('hls_unavailable'));});document.head.append(script);
    });
    return hlsPromise;
  }
  async function mountHls(q,m,token) {
    startMediaWatchdog(token);
    const box=document.getElementById('statement-flash-media');
    const element=document.createElement('video');video=element;
    element.controls=true;element.playsInline=true;element.muted=true;element.loop=!m.verified;element.preload='none';element.autoplay=true;
    element.setAttribute('playsinline','');element.setAttribute('aria-label',`${q.title}：官方整段來源影片`);box.replaceChildren(element);
    const fail=()=>{if(token!==generation||!activeQuote||video!==element)return;generation++;stopMedia();box.innerHTML='<div class="stmt-flash-loading">原站串流暫時無法播放。</div>';setMediaNote('可由下方連結開啟官方來源；此處不以無法播放推定原句真偽。');};
    element.addEventListener('error',fail);
    element.addEventListener('loadedmetadata',()=>{
      if(token!==generation||!activeQuote||video!==element)return;
      clearTimeout(mediaTimer);mediaTimer=0;
      playerReady=true;muted=element.muted;updateMuteButton();document.getElementById('statement-flash-player-controls').hidden=false;
      if(m.verified)element.currentTime=m.verifiedStart;
      element.play().catch(()=>{if(token===generation&&activeQuote){overlay.querySelector('[data-flash-play]').hidden=false;setMediaNote(`${m.label} · 請按「按下播放」或影片內的播放鍵。`);}});
    });
    element.addEventListener('volumechange',()=>{if(token===generation&&activeQuote){muted=element.muted;updateMuteButton();}});
    element.addEventListener('webkitbeginfullscreen',()=>{if(token===generation&&activeQuote){ownsFullscreen=true;setExpanded(true);}});
    element.addEventListener('webkitendfullscreen',()=>{if(token===generation&&activeQuote){ownsFullscreen=false;setExpanded(false);}});
    if(m.verified){element.addEventListener('timeupdate',()=>{if(token===generation&&element.currentTime>=m.verifiedEnd)element.currentTime=m.verifiedStart;});element.addEventListener('ended',()=>{if(token===generation){element.currentTime=m.verifiedStart;element.play().catch(()=>{});}});}
    try{
      const native=element.canPlayType('application/vnd.apple.mpegurl')&&('ManagedMediaSource' in window||!/Chrome|Chromium|Edg|OPR/.test(navigator.userAgent||''));
      if(native){element.src=m.hlsUrl;element.load();return;}
      const Hls=await loadHlsLibrary();if(token!==generation||!activeQuote)return;
      if(!Hls.isSupported()){if(element.canPlayType('application/vnd.apple.mpegurl')){element.src=m.hlsUrl;element.load();}else fail();return;}
      hlsPlayer=new Hls({enableWorker:true,backBufferLength:30,maxBufferLength:30});
      hlsPlayer.on(Hls.Events.ERROR,(_,data)=>{if(data?.fatal)fail();});hlsPlayer.loadSource(m.hlsUrl);hlsPlayer.attachMedia(element);
    }catch{fail();}
  }
  function stopMedia() {
    clearInterval(loopTimer);loopTimer=0;clearTimeout(mediaTimer);mediaTimer=0;resolverAbort?.abort();resolverAbort=null;playerReady=false;
    try {player?.stopVideo?.();}catch{}try{player?.destroy?.();}catch{}player=null;
    const oldVideo=video;video=null;try{oldVideo?.pause();}catch{}try{hlsPlayer?.destroy();}catch{}hlsPlayer=null;
    if(oldVideo){try{oldVideo.removeAttribute('src');oldVideo.load();}catch{}}
    if(overlay)document.getElementById('statement-flash-player-controls').hidden=true;
  }
  function foilState(x,y) {
    const clamp=value=>Math.max(-8,Math.min(8,Number.isFinite(value)?value:0));
    x=clamp(x);y=clamp(y);
    const power=Math.min(1,Math.hypot(x,y)/8);
    return {x,y,foilX:50+y*6.25,foilY:50+x*6.25,power,angle:power?(Math.atan2(x,y)*180/Math.PI+360)%360:0};
  }
  function writeFoil(state) {
    if(!tilt)return;
    const values={'--foil-x':`${state.foilX.toFixed(2)}%`,'--foil-y':`${state.foilY.toFixed(2)}%`,'--foil-power':state.power.toFixed(3),'--foil-angle':`${state.angle.toFixed(2)}deg`};
    for(const [name,value] of Object.entries(values))tilt.style.setProperty(name,value);
    tilt.dataset.foilActive=String(state.power>0);
  }
  function resetTilt(stopSensor=false) {
    cancelAnimationFrame(frame);frame=0;
    const capture=lastPointer;lastPointer=null;lastTilt={x:0,y:0};
    try{if(capture?.handle.hasPointerCapture?.(capture.id))capture.handle.releasePointerCapture(capture.id);}catch{}
    if(tilt){tilt.style.transform='';writeFoil(foilState(0,0));}
    if(stopSensor&&orientation){window.removeEventListener('deviceorientation',orientation);orientation=null;}
    if(stopSensor&&overlay){const button=overlay.querySelector('[data-flash-sensor]');button.disabled=expanded;button.textContent='啟用手機感應微傾';button.hidden=reduceMotion.matches||lowPower()||!window.DeviceOrientationEvent;}
  }
  function queueTilt(x,y) {
    if(!activeQuote||closing||expanded||reduceMotion.matches||lowPower()){resetTilt(true);return;}
    const state=foilState(x,y);lastTilt={x:state.x,y:state.y};
    if(frame)return;
    const token=generation;
    frame=requestAnimationFrame(()=>{
      frame=0;
      if(token!==generation||!activeQuote||closing||expanded||reduceMotion.matches||lowPower()){resetTilt(true);return;}
      const value=foilState(lastTilt.x,lastTilt.y);
      tilt.style.transform=`perspective(1200px) rotateX(${-value.x}deg) rotateY(${value.y}deg)`;
      writeFoil(value);
    });
  }
  async function enableSensor() {
    const button=overlay.querySelector('[data-flash-sensor]'), token=generation;
    const Sensor=window.DeviceOrientationEvent;
    if(!Sensor||expanded||reduceMotion.matches||lowPower()){resetTilt(true);return;}
    button.disabled=true;
    try {
      // Permission is requested only inside this explicit user click handler.
      if(typeof Sensor.requestPermission==='function'&&await Sensor.requestPermission()!=='granted')throw Error('permission_denied');
      if(token!==generation||!activeQuote||expanded||reduceMotion.matches||lowPower())return;
      orientation=event=>{if(Number.isFinite(event.beta)&&Number.isFinite(event.gamma))queueTilt((event.beta-35)/8,event.gamma/8);};
      window.addEventListener('deviceorientation',orientation,{passive:true});button.textContent='手機感應已啟用';
    } catch {button.textContent='感應未啟用，仍可拖曳卡片';button.disabled=false;}
  }
  async function close(restoreFocus=true) {
    if(!activeQuote||closing)return;
    if(video?.webkitDisplayingFullscreen&&video.webkitExitFullscreen)try{video.webkitExitFullscreen();}catch{}
    closing=true;generation++;stopMedia();animation?.cancel();animation=null;resetTilt(true);
    document.getElementById('statement-flash-media').replaceChildren();
    if(document.fullscreenElement&&overlay.contains(document.fullscreenElement))try{await document.exitFullscreen();}catch{}
    ownsFullscreen=false;setExpanded(false);
    if(overlay.close)overlay.close();else{overlay.hidden=true;inertElements.forEach(el=>el.inert=false);inertElements=[];}
    document.body.style.overflow=previousOverflow;activeQuote=null;closing=false;
    if(restoreFocus&&origin?.isConnected)origin.focus({preventScroll:true});
  }
  document.addEventListener('click',event=>{const trigger=event.target.closest?.('[data-statement-open]');if(trigger)open(trigger.dataset.statementOpen,trigger);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&activeQuote)close(false);});
  document.addEventListener('fullscreenchange',()=>{
    if(!overlay)return;
    const own=Boolean(document.fullscreenElement&&overlay.contains(document.fullscreenElement));
    if(own){ownsFullscreen=true;setExpanded(true);}
    else if(ownsFullscreen){ownsFullscreen=false;setExpanded(false);}
  });
  window.addEventListener('pagehide',()=>{if(activeQuote)close(false);});
  window.addEventListener('storage',event=>{if(registered&&event.key===storageKey()){opened=readCollection(event.newValue);updateCollection();}});
  reduceMotion.addEventListener('change',()=>{animation?.cancel();animation=null;resetTilt(true);});
  navigator.connection?.addEventListener?.('change',()=>{if(overlay)overlay.dataset.lowPower=String(lowPower());if(lowPower()){animation?.cancel();animation=null;}resetTilt(true);});
  window.RecordsStatementCards=Object.freeze({version:'v41',register,entry,hydrate,open,close,utils:Object.freeze({safeHttps,youtubeId,normalizeMedia,validateResolvedMedia,progress,sourceLinks})});
})();
