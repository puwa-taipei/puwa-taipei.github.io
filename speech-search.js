'use strict';

(() => {
  const host = document.getElementById('keywords');
  if (!host) return;
  const scriptURL = document.currentScript?.src || location.href;
  const dataURL = new URL('./data/speeches.json', scriptURL).href;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const format = value => Number(value || 0).toLocaleString('zh-TW');
  const state = {data:null,word:'中國',committee:'',from:'2024-02-01',to:'2026-10-20',limit:8};
  const $ = id => document.getElementById(`speech-${id}`);
  let timer;

  host.classList.add('speech-corpus');
  host.innerHTML = `<div class="section-heading"><div><p class="section-number">04 ／ 直接查本人說過的話</p><h2>不憑印象。<br>讓文字可以被搜尋。</h2></div><p class="section-deck">委員會質詢、院會發言與討論。<br>只計沈伯洋本人，逐次讀回上下文。</p></div>
    <p class="speech-scope-label">本人發言逐字稿 · 全部可取得語料</p>
    <div id="speech-loading" class="speech-loading" role="status">正在讀取官方發言紀錄…</div>
    <div id="speech-ready" hidden>
      <div class="speech-search-layout"><div><label class="input-label" for="speech-input">輸入想核對的字詞</label><form id="speech-form" class="keyword-form"><input id="speech-input" type="search" maxlength="60" value="中國" autocomplete="off" placeholder="例如：中國、第五縱隊、兒童、教育" aria-describedby="speech-count-rule"><button type="submit" aria-label="搜尋本人發言">↗</button></form>
      <div class="quick-keywords speech-quick"><button type="button" data-speech-word="中國">中國</button><button type="button" data-speech-word="第五縱隊">第五縱隊</button><button type="button" data-speech-word="兒童">兒童</button><button type="button" data-speech-word="教育">教育</button><button type="button" data-speech-word="幼兒園">幼兒園</button><button type="button" data-speech-word="中共">中共</button></div>
      <p id="speech-count-rule" class="small-note">精確字串、逐輪次計數；「中共」不併入「中國」。不含官員回答、其他委員或法案文本。</p></div>
      <div class="speech-metrics" aria-live="polite"><div><span>本人說過</span><strong id="speech-occurrences">—</strong><span>次精確字串</span></div><div><span>至少出現一次</span><strong id="speech-hits">—</strong><span>個發言片段</span></div></div></div>
      <div class="speech-filters"><label>期間<select id="speech-period"><option value="all">全部期間</option><option value="pre">正式提名前</option><option value="post">正式提名後</option><option value="2024">2024年</option><option value="2025">2025年</option><option value="2026">2026年</option><option value="custom">自訂日期</option></select></label><label>委員會／院會<select id="speech-committee"><option value="">全部單位</option></select></label><label>從<input id="speech-from" type="date" min="2024-02-01" max="2026-10-20" value="2024-02-01"></label><label>至<input id="speech-to" type="date" min="2024-02-01" max="2026-10-20" value="2026-10-20"></label></div>
      <p id="speech-filter-error" class="speech-error" hidden>開始日期不能晚於結束日期。</p>
      <div class="speech-denominator" aria-live="polite"><p id="speech-scope">計數範圍載入中…</p><span id="speech-chars"></span></div><p id="speech-available-through" class="small-note"></p>
      <div class="speech-result-heading"><h3 id="speech-result-title">命中上下文</h3><span id="speech-result-meta"></span></div><div id="speech-results"></div><button id="speech-more" class="speech-more" type="button" hidden>再顯示 8 個發言片段 ＋</button>
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
    return `<article class="speech-card" data-speech-id="${escape(speech.id)}"><div class="speech-card-meta"><time datetime="${escape(speech.date)}">${escape(speech.date)}</time><span>${escape(speech.committee)}</span><span>${escape(speech.kind)}</span><strong>${state.word ? `命中 ${format(speech.hits)} 次` : `${format(speech.characters)} 字`}</strong></div><h4>${escape(speech.meetingTitle)}</h4><div class="speech-snippets">${snippets(speech)}</div><p class="speech-clock">官方發言起迄 ${clock} · 片段長度 ${escape(speech.duration)}<span>此為整段發言時間，非命中句的逐秒定位</span></p><div class="speech-source-links"><a href="${escape(speech.videoUrl)}" target="_blank" rel="noopener noreferrer">看完整發言影片 ↗</a><a href="${escape(speech.transcriptUrl)}" target="_blank" rel="noopener noreferrer">官方逐字稿 ↗</a></div><details class="speech-full"><summary>讀本人全文 · ${format(speech.turns.length)} 個輪次 <span>＋</span></summary><div>${speech.turns.map((turn,index)=>`<p><span class="speech-turn-label">${index+1} ／ ${escape(turn.speaker)}${turn.role==='chair' ? '（主持議事）' : ''}</span>${highlight(turn.text,state.word)}</p>`).join('')}</div></details></article>`;
  }

  function render() {
    if (!state.data) return;
    const valid = state.from <= state.to;
    $('filter-error').hidden = valid;
    const selected = valid ? state.data.speeches.filter(inScope) : [];
    const missing = valid ? state.data.unavailable.filter(inScope) : [];
    const matched = selected.map(speech=>({...speech,hits:speech.turns.reduce((n,turn)=>n+count(turn.text,state.word),0)})).filter(speech=>!state.word || speech.hits > 0);
    const occurrenceCount = matched.reduce((n,speech)=>n+speech.hits,0);
    const characters = selected.reduce((n,speech)=>n+speech.characters,0);
    $('occurrences').textContent = state.word ? format(occurrenceCount) : '—';
    $('hits').textContent = state.word ? format(matched.length) : '—';
    $('scope').textContent = `${state.from}—${state.to} · ${state.committee || '全部單位'}：可計數 ${format(selected.length)}／目錄 ${format(selected.length+missing.length)} 個片段；${format(missing.length)} 個缺漏未計數。`;
    $('chars').textContent = `本人全文 ${format(characters)} 字`;
    $('result-title').textContent = state.word ? `「${state.word}」命中上下文` : '全部本人發言';
    $('result-meta').textContent = `顯示 ${format(Math.min(state.limit,matched.length))}／${format(matched.length)} 個片段 · 日期由新到舊`;
    $('results').innerHTML = matched.length ? matched.slice(0,state.limit).map(card).join('') : `<p class="speech-empty">${valid ? '這個範圍的可收錄本人逐字稿沒有精確命中。可換詞或調整期間；缺漏影片尚未計入。' : '請先調整日期範圍。'}</p>`;
    $('more').hidden = matched.length <= state.limit;
    host.querySelectorAll('[data-speech-word]').forEach(button=>button.classList.toggle('active',button.dataset.speechWord===state.word));
  }

  function readFilters() {
    state.word = $('input').value.trim();
    state.committee = $('committee').value;
    state.from = $('from').value || state.data.period.start;
    state.to = $('to').value || state.data.period.end;
    state.limit = 8;
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
    host.querySelectorAll('[data-speech-word]').forEach(button=>button.addEventListener('click',()=>{$('input').value=button.dataset.speechWord;readFilters();}));
    $('more').addEventListener('click',()=>{state.limit+=8;render();});
    render();
    host.dispatchEvent(new CustomEvent('speech-corpus-ready',{detail:{included:data.stats.includedSpeeches,listed:data.stats.listedClips}}));
  }

  fetch(dataURL,{cache:'no-cache'}).then(response=>{if(!response.ok)throw new Error(`HTTP ${response.status}`);return response.json();}).then(initialize).catch(()=>{$('loading').textContent='目前無法讀取本人逐字稿，請重新整理後再試。尚未顯示任何字詞次數。';$('loading').classList.add('speech-error');});
})();
