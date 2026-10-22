'use strict';

(() => {
  const host = document.getElementById('keywords');
  if (!host) return;
  const scriptURL = document.currentScript?.src || location.href;
  const dataURL = new URL('./data/speeches.json', scriptURL).href;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const format = value => Number(value || 0).toLocaleString('zh-TW');
  const compactLists = matchMedia('(max-width:700px)');
  const batchSize = () => compactLists.matches ? 2 : 8;
  const state = {data:null,word:'中國',committee:'',from:'2024-02-01',to:'2026-10-20',limit:batchSize(),resultsExpanded:true,cloudMode:'cloud',cloudIndex:null,cloudScope:null,cloudUnsupported:false};
  const $ = id => document.getElementById(`speech-${id}`);
  let timer;

  host.classList.add('speech-corpus');
  host.innerHTML = `<div class="section-heading"><div><p class="section-number">04 ／ 直接查本人說過的話</p><h2>不憑印象。<br>讓文字可以被搜尋。</h2></div><p class="section-deck">委員會質詢、院會發言與討論。<br>只計沈伯洋本人，逐次讀回上下文。</p></div>
    <p class="speech-scope-label">本人發言逐字稿 · 全部可取得語料</p>
    <div id="speech-loading" class="speech-loading" role="status">正在讀取官方發言紀錄…</div>
    <div id="speech-ready" hidden>
      <div class="speech-filters"><label>期間<select id="speech-period"><option value="all">全部期間</option><option value="pre">正式提名前</option><option value="post">正式提名後</option><option value="2024">2024年</option><option value="2025">2025年</option><option value="2026">2026年</option><option value="custom">自訂日期</option></select></label><label>委員會／院會<select id="speech-committee"><option value="">全部單位</option></select></label><label>從<input id="speech-from" type="date" min="2024-02-01" max="2026-10-20" value="2024-02-01"></label><label>至<input id="speech-to" type="date" min="2024-02-01" max="2026-10-20" value="2026-10-20"></label></div>
      <p id="speech-filter-error" class="speech-error" hidden>開始日期不能晚於結束日期。</p>
      <div class="speech-denominator" aria-live="polite"><p id="speech-scope">計數範圍載入中…</p><span id="speech-chars"></span></div><p id="speech-available-through" class="small-note"></p>
      <section class="speech-keyword-index" aria-labelledby="speech-cloud-title">
        <div class="speech-cloud-heading"><div><p class="speech-cloud-eyebrow">先看常出現的詞，再讀原文</p><h3 id="speech-cloud-title">他常說到哪些詞？</h3><p>字越大，出現越多。點一個詞，就能看次數和上下文。</p></div><div class="speech-cloud-modes" role="group" aria-label="關鍵詞顯示方式"><button type="button" data-speech-cloud-mode="cloud" aria-pressed="true">文字雲</button><button type="button" data-speech-cloud-mode="rank" aria-pressed="false">次數排行</button></div></div>
        <p id="speech-cloud-status" class="speech-cloud-status" role="status">正在整理目前範圍的關鍵詞；下方搜尋可先使用。</p>
        <ol id="speech-cloud-words" class="speech-word-list" aria-label="依出現次數排序的高頻詞組"></ol>
        <p class="speech-cloud-note">依目前日期與單位範圍統計，不隨下方搜尋詞縮小。這是自動分詞後的高頻詞組，不是議題投入比例；提到一個詞，也不等於支持或反對。</p>
        <details class="speech-cloud-method"><summary>文字雲怎麼產生？ <span aria-hidden="true">＋</span></summary><div><p>先用瀏覽器內建中文分詞（Intl.Segmenter，zh-Hant）找出 2–8 字的連續漢字詞組，再排除下列通用停用詞。候選來自全部可取得的本人發言，沒有依政治立場或特定議題挑詞。英文、數字、單字與較長詞組不進文字雲，仍可用下方搜尋。</p><p>分詞只用來找候選詞；顯示次數仍按原文逐輪、區分字形、非重疊精確字串計數，和點詞後的搜尋相同。各詞可能互相包含，因此次數不能相加當成發言總量。顯示目前範圍次數最多的 40 個候選詞；同次數按詞序排列。字級以平方根比例縮放至 18–48px，顏色不另代表立場或主題。</p><p>中文切詞可能把人名、複合詞切開，也會隨瀏覽器分詞資料版本不同。這是探索入口，不是完整語意分析；可自行輸入任何想核對的字詞。</p><p><strong>完整停用詞：</strong><span id="speech-cloud-stopwords"></span></p></div></details>
      </section>
      <div class="speech-search-layout"><div><label class="input-label" for="speech-input">輸入想核對的字詞</label><form id="speech-form" class="keyword-form"><input id="speech-input" type="search" maxlength="60" value="中國" autocomplete="off" placeholder="例如：中國、臺灣、大罷免、賴清德" aria-describedby="speech-count-rule"><button type="submit" aria-label="搜尋本人發言">↗</button></form>
      <div class="quick-keywords speech-quick"><button type="button" data-speech-word="中國">中國</button><button type="button" data-speech-word="臺灣">臺灣</button><button type="button" data-speech-word="大罷免">大罷免</button><button type="button" data-speech-word="賴清德">賴清德</button><button type="button" data-speech-word="認知作戰">認知作戰</button><button type="button" data-speech-word="普發現金">普發現金</button></div>
      <p id="speech-count-rule" class="small-note">精確字串、逐輪次計數；「中共」不併入「中國」。不含官員回答、其他委員或法案文本。</p></div>
      <div class="speech-metrics" aria-live="polite"><div><span>本人說過</span><strong id="speech-occurrences">—</strong><span>次精確字串</span></div><div><span>至少出現一次</span><strong id="speech-hits">—</strong><span>個發言片段</span></div></div></div>
      <div class="speech-result-heading"><h3 id="speech-result-title" tabindex="-1">命中上下文</h3><span id="speech-result-meta"></span><button id="speech-toggle-results" class="speech-list-toggle" type="button" aria-expanded="true" aria-controls="speech-results-panel">收起上下文 −</button></div><div id="speech-results-panel"><div id="speech-results"></div><div class="compact-list-controls speech-result-actions"><button id="speech-more" class="speech-more" type="button" hidden>載入更多片段 ↓</button><button id="speech-reset-results" type="button" hidden>收回前幾個片段 ↑</button></div></div>
      <details class="speech-method"><summary>語料覆蓋與計數方法 <span>＋</span></summary><div><p id="speech-coverage"></p><p>以立法院具名 iVOD 目錄為範圍，納入全部可取得、可歸屬本人的逐字稿，普通政策發言也在分母裡。這不是他所有院內外發言，片段數也不等於出席天數；缺漏不以零次發言推定。</p><p>只擷取明確署名「沈委員伯洋」及「主席（沈委員伯洋）」的輪次；未具名主席、官員、別位委員和書面附錄不計入。出現次數包含本人引述他人、反問、機關或政黨名稱，需讀上下文判斷立場。</p><p>字數為本人文字的 Unicode 字元數，含標點及英文、排除空白。命中計數為區分字形、連續精確字串、非重疊，不跨發言輪次接詞。影片時間顯示整段發言的會議時鐘起訖，未逐句對時。</p><div class="speech-coverage-scroll"><table class="speech-coverage-table"><thead><tr><th>單位</th><th>可收錄</th><th>目錄片段</th><th>缺漏</th></tr></thead><tbody id="speech-coverage-table"></tbody></table></div><details class="speech-missing"><summary>檢視未計入的片段與原因</summary><ul id="speech-missing-list"></ul></details><div class="speech-source-links"><a href="https://ivod.ly.gov.tw/Demand/ListLgltVideo/7049" target="_blank" rel="noopener noreferrer">官方具名影片目錄 ↗</a><a id="speech-download" download="shen-speeches.json">下載完整本人語料 JSON ↓</a></div></div></details>
    </div>`;

  const count = (text,word) => {
    if (!word) return 0;
    let total = 0, from = 0, index;
    while((index = text.indexOf(word,from)) !== -1) {total++;from=index+word.length;}
    return total;
  };
  const highlight = (text,word) => word ? text.split(word).map(escape).join(`<mark>${escape(word)}</mark>`) : escape(text);
  const inScope = speech => speech.date >= state.from && speech.date <= state.to && (!state.committee || speech.committee === state.committee);

  // This list removes conversational/function words, never a political topic.
  const cloudStopwords = new Set(('我們 你們 他們 她們 這個 那個 這些 那些 這樣 那樣 這裡 那裡 現在 今天 昨天 明天 目前 剛剛 剛才 等等 真的 當然 其實 所以 因為 但是 不過 然後 而且 如果 就是 不是 也是 還是 都是 只是 可是 以及 或者 還有 另外 一個 兩個 一些 一下 一點 一種 一定 一樣 一直 一起 之後 之前 之間 時候 什麼 為什麼 怎麼 如何 這麼 那麼 可以 可能 應該 必須 需要 能夠 不能 不要 沒有 已經 還沒 還要 還會 不會 會不會 是不是 有沒有 知道 覺得 認為 希望 想要 看到 看看 聽到 講到 說到 請問 請教 謝謝 感謝 對不起 沒關係 主席 委員 部長 院長 處長 局長 次長 主委 署長 議員 同仁 大家 各位 這次 那次 這邊 那邊 本來 後來 最後 首先 第二 第三 第一 以上 以下 相關 針對 關於 對於 有關 透過 進行 部分 方面 情況 問題 事情 東西 事實 基本上 事實上 所謂').split(/\s+/));

  // Common discourse markers and demonstrative fragments from automatic cuts.
  ['有一','這一','這件','這件事','比較','非常','提到','來講','是在','這是','裡面','會有','很多','是不','之類','到底','也有','一次','我想','的是','是有','畢竟','直接','不管','下來','出來','自己','起來','大概','當中','有些','就是說','這樣子','的話','能不能','有什麼','要不要','再來','對不對','這種','那種','這一個','那一個','可能會','不管是','他的','她的','它的','你的','我的','我們的','你們的','他們的','來的','接下來','不知','不知道'].forEach(word=>cloudStopwords.add(word));

  function prepareCloudIndex(data) {
    if (typeof Intl.Segmenter !== 'function') {
      state.cloudUnsupported = true;
      renderCloud(data.speeches.filter(inScope), state.from <= state.to);
      return;
    }
    const segmenter = new Intl.Segmenter('zh-Hant', {granularity:'word'});
    const vocabulary = new Set();
    for (const speech of data.speeches) {
      for (const turn of speech.turns) {
        for (const part of segmenter.segment(turn.text)) {
          const word = part.segment;
          if (part.isWordLike && /^[\p{Script=Han}]{2,8}$/u.test(word) && !cloudStopwords.has(word)) vocabulary.add(word);
        }
      }
    }
    // Group by first UTF-16 code unit. Inspecting every start offset preserves
    // substring semantics (e.g. 中國 inside 中國人), unlike token counts alone.
    const byFirst = new Map();
    for (const word of vocabulary) {
      const first = word[0];
      if (!byFirst.has(first)) byFirst.set(first, []);
      byFirst.get(first).push(word);
    }
    const index = new Map();
    for (const speech of data.speeches) {
      const totals = new Map();
      for (const turn of speech.turns) {
        const ends = new Map();
        for (let offset = 0; offset < turn.text.length; offset++) {
          const options = byFirst.get(turn.text[offset]);
          if (!options) continue;
          for (const word of options) {
            if ((ends.get(word) || 0) <= offset && turn.text.startsWith(word, offset)) {
              totals.set(word, (totals.get(word) || 0) + 1);
              ends.set(word, offset + word.length);
            }
          }
        }
      }
      index.set(speech.id, totals);
    }
    state.cloudIndex = index;
    state.cloudScope = null;
    renderCloud(data.speeches.filter(inScope), state.from <= state.to);
  }

  function renderCloud(selected, valid) {
    const scope = [state.from,state.to,state.committee,valid].join('|');
    if (state.cloudUnsupported) {
      $('cloud-status').textContent = '這個瀏覽器不支援中文分詞，無法產生文字雲；下方搜尋與原文仍可正常使用。';
      $('cloud-words').innerHTML = '';
      host.querySelectorAll('[data-speech-cloud-mode]').forEach(button=>button.disabled=true);
      return;
    }
    if (!state.cloudIndex || state.cloudScope === scope) return;
    state.cloudScope = scope;
    const totals = new Map();
    for (const speech of selected) {
      for (const [word,hits] of state.cloudIndex.get(speech.id) || []) totals.set(word,(totals.get(word) || 0)+hits);
    }
    const words = [...totals].sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0],'zh-Hant')).slice(0,40);
    const maximum = Math.sqrt(words[0]?.[1] || 0), minimum = Math.sqrt(words[words.length-1]?.[1] || 0);
    $('cloud-status').textContent = !valid ? '日期範圍有誤，請先調整上方篩選。' : !selected.length ? '這個範圍沒有可計數的本人逐字稿；缺漏不當作零次發言。' : words.length ? `目前 ${format(selected.length)} 個可計數片段，顯示 ${format(words.length)} 個高頻詞組。點詞可查原文。` : '目前範圍沒有符合分詞條件的詞組，仍可自行輸入關鍵詞搜尋。';
    $('cloud-words').innerHTML = words.map(([word,hits],i)=>{
      const size = maximum === minimum ? 28 : 18+30*(Math.sqrt(hits)-minimum)/(maximum-minimum);
      return `<li><button type="button" class="speech-word-button" data-speech-word="${escape(word)}" aria-pressed="${word===state.word}" aria-label="${escape(word)}，${format(hits)} 次；搜尋原文" style="--speech-word-size:${size.toFixed(2)}px"><span class="speech-word-rank">${i+1}</span><span class="speech-word-text">${escape(word)}</span><small>${format(hits)}<span class="speech-word-times"> 次</span></small></button></li>`;
    }).join('');
    updateCloudMode();
  }

  function updateCloudMode() {
    $('cloud-words').classList.toggle('speech-word-ranking',state.cloudMode==='rank');
    host.querySelectorAll('[data-speech-cloud-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.speechCloudMode===state.cloudMode)));
  }

  function snippets(speech) {
    if (!state.word) return `<p>${escape(speech.turns[0]?.text.slice(0,180))}${speech.turns[0]?.text.length > 180 ? '…' : ''}</p>`;
    const items = [];
    for(const turn of speech.turns) {
      let from = 0, index;
      while(items.length < 3 && (index = turn.text.indexOf(state.word,from)) !== -1) {
        const start = Math.max(0,index-64), end = Math.min(turn.text.length,index+state.word.length+90);
        items.push(`<p>${start ? '…' : ''}${highlight(turn.text.slice(start,end),state.word)}${end < turn.text.length ? '…' : ''}</p>`);
        from = end;
      }
      if(items.length >= 3) break;
    }
    return items.join('');
  }

  function card(speech) {
    const clock = speech.clockStart ? `${escape(speech.clockStart)}–${escape(speech.clockEnd)}` : '未提供';
    return `<article class="speech-card" data-speech-id="${escape(speech.id)}"><div class="speech-card-meta"><time datetime="${escape(speech.date)}">${escape(speech.date)}</time><span>${escape(speech.committee)}</span><span>${escape(speech.kind)}</span><strong>${state.word ? `命中 ${format(speech.hits)} 次` : `${format(speech.characters)} 字`}</strong></div><details class="speech-meeting-title"${compactLists.matches?'':' open'}><summary><h4><span class="speech-meeting-name">${escape(speech.meetingTitle)}</span><small class="speech-title-action"><span class="list-state-collapsed">看完整會議名稱 ＋</span><span class="list-state-expanded">收起會議名稱 −</span></small></h4></summary></details><div class="speech-snippets">${snippets(speech)}</div><p class="speech-clock">官方發言起迄 ${clock} · 片段長度 ${escape(speech.duration)}<span>此為整段發言時間，非命中句的逐秒定位</span></p><div class="speech-source-links"><a href="${escape(speech.videoUrl)}" target="_blank" rel="noopener noreferrer">看完整發言影片 ↗</a><a href="${escape(speech.transcriptUrl)}" target="_blank" rel="noopener noreferrer">官方逐字稿 ↗</a></div><details class="speech-full"><summary>讀本人全文 · ${format(speech.turns.length)} 個輪次 <span>＋</span></summary><div>${speech.turns.map((turn,index)=>`<p><span class="speech-turn-label">${index+1} ／ ${escape(turn.speaker)}${turn.role==='chair' ? '（主持議事）' : ''}</span>${highlight(turn.text,state.word)}</p>`).join('')}</div></details></article>`;
  }

  function render() {
    if (!state.data) return;
    const valid = state.from <= state.to;
    $('filter-error').hidden = valid;
    const selected = valid ? state.data.speeches.filter(inScope) : [];
    const missing = valid ? state.data.unavailable.filter(inScope) : [];
    renderCloud(selected,valid);
    const matched = selected.map(speech=>({...speech,hits:speech.turns.reduce((n,turn)=>n+count(turn.text,state.word),0)})).filter(speech=>!state.word || speech.hits > 0);
    const occurrenceCount = matched.reduce((n,speech)=>n+speech.hits,0);
    const characters = selected.reduce((n,speech)=>n+speech.characters,0);
    $('occurrences').textContent = state.word ? format(occurrenceCount) : '—';
    $('hits').textContent = state.word ? format(matched.length) : '—';
    $('scope').textContent = `${state.from}—${state.to} · ${state.committee || '全部單位'}：可計數 ${format(selected.length)}／目錄 ${format(selected.length+missing.length)} 個片段；${format(missing.length)} 個缺漏未計數。`;
    $('chars').textContent = `本人全文 ${format(characters)} 字`;
    $('result-title').textContent = state.word ? `「${state.word}」命中上下文` : '全部本人發言';
    $('result-meta').textContent = state.resultsExpanded ? `顯示 ${format(Math.min(state.limit,matched.length))}／${format(matched.length)} 個片段 · 日期由新到舊` : `已收起 · 共 ${format(matched.length)} 個片段 · 日期由新到舊`;
    $('results-panel').hidden = !state.resultsExpanded;
    $('toggle-results').hidden = !matched.length;
    $('toggle-results').textContent = state.resultsExpanded ? '收起上下文 −' : '展開上下文 ＋';
    $('toggle-results').setAttribute('aria-expanded',String(state.resultsExpanded));
    $('results').innerHTML = matched.length ? matched.slice(0,state.limit).map(card).join('') : `<p class="speech-empty">${valid ? '這個範圍的可收錄本人逐字稿沒有精確命中。可換詞或調整期間；缺漏影片尚未計入。' : '請先調整日期範圍。'}</p>`;
    $('more').hidden = matched.length <= state.limit;
    $('more').textContent = `再顯示 ${format(Math.min(batchSize(),Math.max(0,matched.length-state.limit)))} 個片段 ↓`;
    $('reset-results').hidden = Math.min(state.limit,matched.length) <= batchSize();
    $('reset-results').textContent = `收回前 ${format(batchSize())} 個片段 ↑`;
    host.querySelectorAll('[data-speech-word]').forEach(button=>{const active=button.dataset.speechWord===state.word;button.classList.toggle('active',active);if(button.classList.contains('speech-word-button'))button.setAttribute('aria-pressed',String(active));});
  }

  function readFilters() {
    state.word = $('input').value.trim();
    state.committee = $('committee').value;
    state.from = $('from').value || state.data.period.start;
    state.to = $('to').value || state.data.period.end;
    state.limit = batchSize();
    state.resultsExpanded = true;
    render();
  }

  function initialize(data) {
    state.data = data;
    $('loading').hidden = true; $('ready').hidden = false;
    const committees = Object.keys(data.stats.byCommittee);
    $('committee').innerHTML = '<option value="">全部單位</option>'+committees.map(name=>`<option value="${escape(name)}">${escape(name)}</option>`).join('');
    $('coverage').textContent = `官方目錄 ${format(data.stats.listedClips)} 個片段，收錄 ${format(data.stats.includedSpeeches)} 個（${(data.stats.includedSpeeches/data.stats.listedClips*100).toFixed(1)}%），${format(data.stats.unavailableClips)} 個未計入；${format(data.stats.ownTurns)} 個本人發言輪次、${format(data.stats.characters)} 字。目錄範圍 ${data.period.start}—${data.period.end}；可收錄文字目前最新至 ${data.stats.lastIncludedDate}。`;
    $('available-through').textContent = `這份語料可收錄文字為 ${data.stats.firstIncludedDate}—${data.stats.lastIncludedDate}。較新影片尚未取得逐字稿；程序委員會 ${data.stats.byCommittee['程序委員會']?.unavailable || 0} 個片段缺漏，不能當作零次發言。`;
    $('coverage-table').innerHTML = committees.map(name=>{const s=data.stats.byCommittee[name];return `<tr><th>${escape(name)}</th><td>${format(s.included)}</td><td>${format(s.listed)}</td><td>${format(s.unavailable)}</td></tr>`;}).join('');
    const reasons = {'official-endpoint-empty':'官方發言紀錄端點回傳空白','fetch-failed-or-not-fetched':'未取得發言紀錄','no-attributable-shen-turn':'回覆中沒有可歸屬的本人輪次，排除他人發言'};
    $('missing-list').innerHTML = data.unavailable.map(speech=>`<li>${escape(speech.date)} · ${escape(speech.committee)} · <a href="${escape(speech.videoUrl)}" target="_blank" rel="noopener noreferrer">影片 ${escape(speech.ivodId)} ↗</a>：${escape(reasons[speech.status] || speech.status)}</li>`).join('');
    $('download').href = dataURL;
    $('form').addEventListener('submit',event=>{event.preventDefault();readFilters();});
    $('input').addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(readFilters,160);});
    $('committee').addEventListener('change',readFilters);
    ['from','to'].forEach(id=>$(id).addEventListener('change',()=>{$('period').value='custom';readFilters();}));
    $('period').addEventListener('change',()=>{
      const value=$('period').value;
      const ranges={all:[data.period.start,data.period.end],pre:[data.period.start,'2026-05-12'],post:[data.nominationDate,data.period.end],2024:[data.period.start,'2024-12-31'],2025:['2025-01-01','2025-12-31'],2026:['2026-01-01',data.period.end]};
      if(ranges[value]) {[$('from').value,$('to').value]=ranges[value];readFilters();}
    });
    $('cloud-stopwords').textContent = [...cloudStopwords].sort((a,b)=>a.localeCompare(b,'zh-Hant')).join('、');
    host.addEventListener('click',event=>{
      const mode=event.target.closest('[data-speech-cloud-mode]');
      if(mode){state.cloudMode=mode.dataset.speechCloudMode;updateCloudMode();return;}
      const word=event.target.closest('[data-speech-word]');
      if(word){
        $('input').value=word.dataset.speechWord;readFilters();
        if(word.classList.contains('speech-word-button')){
          host.querySelector('.speech-search-layout').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
          $('result-title').focus({preventScroll:true});
        }
      }
    });
    $('more').addEventListener('click',()=>{state.limit+=batchSize();render();});
    $('toggle-results').addEventListener('click',()=>{state.resultsExpanded=!state.resultsExpanded;render();});
    $('reset-results').addEventListener('click',()=>{state.limit=batchSize();state.resultsExpanded=true;render();$('result-title').focus({preventScroll:true});host.querySelector('.speech-result-heading').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});});
    compactLists.addEventListener('change',()=>{state.limit=batchSize();state.resultsExpanded=true;render();});
    render();
    host.dispatchEvent(new CustomEvent('speech-corpus-ready',{detail:{included:data.stats.includedSpeeches,listed:data.stats.listedClips}}));
    setTimeout(()=>{try{prepareCloudIndex(data);}catch{state.cloudUnsupported=true;renderCloud([],true);}},0);
  }

  fetch(dataURL,{cache:'no-cache'}).then(response=>{if(!response.ok)throw new Error(`HTTP ${response.status}`);return response.json();}).then(initialize).catch(()=>{$('loading').textContent='目前無法讀取本人逐字稿，請重新整理後再試。尚未顯示任何字詞次數。';$('loading').classList.add('speech-error');});
})();
