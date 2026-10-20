'use strict';

(() => {
  const $ = id => document.getElementById(id);
  const fmt = n => Number.isFinite(Number(n)) ? Number(n).toLocaleString('zh-TW') : '—';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const safeUrl = value => /^(https?:\/\/|\.\/)/i.test(String(value || '')) ? String(value) : '#method';
  const list = value => Array.isArray(value) ? value : value ? [value] : [];
  const roleNames = {primary:'主提案', joint:'共同提案', cosign:'連署'};
  const state = {data:null,policy:null,page:1,pageSize:12,search:'',role:'primary',scopeRole:'primary',axis:'target',quotes:[],gamePeriod:'pre',topic:'',committee:'',status:'',sort:'date-desc',exactKeyword:'',keyword:'中國',quiz:[],quizIndex:0,quizCorrect:0,quizAnswered:false,quizNewCount:0};
  let searchable = new Map();
  let keywordText = new Map();
  let searchTimer;

  const announce = message => { $('announcement').textContent = message; };
  const setText = (id,value) => { if ($(id)) $(id).textContent = value; };
  const countWord = (text, word) => {
    if (!word) return 0;
    let count = 0, index = 0;
    while ((index = text.indexOf(word,index)) !== -1) { count++; index += word.length; }
    return count;
  };
  const normalize = value => String(value ?? '').normalize('NFKC');
  const names = value => list(value).map(v => typeof v === 'object' ? v.name || v.title || '' : v).filter(Boolean);

  async function fetchJSON(url) {
    const response = await fetch(url, {cache:'no-cache'});
    if (!response.ok) throw new Error(`${url} (${response.status})`);
    return response.json();
  }

  async function init() {
    bindEvents();
    const results = await Promise.allSettled([fetchJSON('./data/analysis.json'), fetchJSON('./data/policy.json'),fetchJSON('./data/quotes.json')]);
    if (results[0].status === 'fulfilled') {
      state.data = results[0].value;
      prepareData();
      renderData();
    } else {
      $('load-error').hidden = false;
      $('load-error').innerHTML = '<div><strong>國會資料暫時無法讀取。</strong> 請確認連線後再試一次；未取得的紀錄不會顯示為零。 <button id="retry-load">重新載入 ↺</button></div>';
      $('retry-load').addEventListener('click', () => location.reload());
      setText('asof','國會資料暫未載入');
      setText('bill-list','資料未載入，請重新整理後再試。');
      setText('result-count','未取得資料');
    }
    if (results[1].status === 'fulfilled') {
      state.policy = results[1].value;
      renderPolicy();
    } else {
      setText('policy-chart','政策資料暫時無法讀取，可點下方官方來源查看。');
    }
    if(results[2].status==='fulfilled')state.quotes=list(results[2].value.quotes);
    buildGames();
  }

  function prepareData() {
    const data = state.data;
    data.bills = list(data.bills);
    const fields = list(data.keywords?.fields).length ? data.keywords.fields : ['title','reason','text'];
    for (const bill of data.bills) {
      const body = fields.map(field => typeof bill[field] === 'string' ? bill[field] : '').join('\n');
      keywordText.set(bill.id, normalize(body));
      searchable.set(bill.id, normalize([bill.title,bill.reason,bill.text,...names(bill.proposers),...names(bill.cosigners),...names(bill.topics),...names(bill.committees),bill.manualTopic,bill.id].join('\n')).toLocaleLowerCase());
    }
  }

  function renderData() {
    const d = state.data, m = d.meta || {}, t = d.totals || {};
    setText('asof',`觀測截止 ${m.end || '未提供'}`);
    $('elapsed-days').innerHTML = `${fmt(m.elapsedDays)}<small>天</small>`;
    ['primary','joint','cosign'].forEach(role => setText(`total-${role}`,fmt(t[role])));
    setText('total-unique',fmt(t.unique));
    setText('role-note',`${fmt(t.primary)}（主提案）＋${fmt(t.joint)}（共同提案）＋${fmt(t.cosign)}（連署）＝${fmt(t.unique)}（去重參與合計）。另1件修憲連署未列入法律案主表。`);
    setText('coverage-note',m.coverageNote ? ` ${m.coverageNote}` : '');
    renderDonut(t);
    renderPrimaryTopics();
    renderScope();
    renderCommitteeRoleTable();
    renderAttendance();
    populateFilters();
    updateKeyword();
    renderBills();
    setText('method-period',`查詢起訖：${m.start || '未提供'} 至 ${m.end || '未提供'}。列名提案可見日期：${m.firstProposal || '未提供'} 至 ${m.lastProposal || '未提供'}。${m.latestCosign ? `連署案最晚日期：${m.latestCosign}。` : ''} ${m.unit || ''} ${m.coverageNote || ''}`);
    setText('retrieved-at',`本次彙整時間：${m.retrievedAt ? new Date(m.retrievedAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false}) + '（台北時間）' : '未提供'}。`);
  }

  const scopedBills=()=>list(state.data?.bills).filter(b=>!state.scopeRole||b.role===state.scopeRole);
  function renderScope(){
    if(!state.data)return;
    const rows=scopedBills(),label=state.scopeRole?roleNames[state.scopeRole]:'全部角色';
    setText('scope-name',label+' '+fmt(rows.length)+' 件');setText('status-title',label+' '+fmt(rows.length)+' 件的審議進度');
    if($('scope-filter'))$('scope-filter').value=state.scopeRole;
    renderBars('topic-chart',state.data.topics,'topic');renderBars('committee-chart',state.data.committees,'committee');renderProcedure();populateFilters();updateKeyword();
  }

  function renderDonut(t) {
    const total = Number(t.unique) || 0, radius = 85, circumference = 2 * Math.PI * radius;
    let offset = 0;
    const colors = {primary:'#173e36',joint:'#a9be97',cosign:'#d85938'};
    const arcs = ['primary','joint','cosign'].map(role => {
      const length = total ? (Number(t[role]) || 0) / total * circumference : 0;
      const arc = `<circle cx="110" cy="110" r="${radius}" fill="none" stroke="${colors[role]}" stroke-width="23" stroke-dasharray="${Math.max(length - 2,0)} ${circumference}" stroke-dashoffset="${-offset}" transform="rotate(-90 110 110)"><title>${roleNames[role]} ${fmt(t[role])} 件</title></circle>`;
      offset += length;
      return arc;
    }).join('');
    $('role-donut').innerHTML = `<circle cx="110" cy="110" r="${radius}" fill="none" stroke="#e5e6da" stroke-width="23"/>${arcs}`;
    $('role-donut').setAttribute('aria-label',`法律案角色分布：主提案 ${t.primary}、共同提案 ${t.joint}、連署 ${t.cosign}，共 ${total} 件。`);
  }

  function primaryTopics() {
    const provided = state.data?.meta?.primaryTopics || state.data?.primaryTopics;
    if (Array.isArray(provided) && provided.length) return provided;
    const grouped = new Map();
    for (const bill of state.data?.bills || []) {
      if (bill.role !== 'primary' || !bill.manualTopic) continue;
      if (!grouped.has(bill.manualTopic)) grouped.set(bill.manualTopic,{name:bill.manualTopic,count:0,ids:[]});
      grouped.get(bill.manualTopic).count++;
      grouped.get(bill.manualTopic).ids.push(bill.id);
    }
    return [...grouped.values()].sort((a,b) => b.count - a.count);
  }

  function renderPrimaryTopics() {
    const rows = state.axis==='target' ? Object.entries(list(state.data.bills).filter(b=>b.role==='primary').reduce((o,b)=>(o[b.targetTopic]=(o[b.targetTopic]||0)+1,o),{})).map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count) : primaryTopics(), total = Number(state.data.totals?.primary) || 1;
    if (!rows.length) { setText('primary-topic-chart','人工主分類仍待完成，暫不顯示比例。'); return; }
    $('primary-topic-chart').classList.remove('loading-placeholder');
    $('primary-topic-chart').innerHTML = rows.map(row => `<button class="chart-row primary-topic-row" data-manual-topic="${esc(row.name)}" title="查看${esc(row.name)}的主提案"><span class="chart-label">${esc(row.name)}</span><span class="chart-track"><span class="chart-part primary" style="width:${Number(row.count) / total * 100}%"></span></span><span class="chart-value">${fmt(row.count)}<small>${(Number(row.count)/total*100).toFixed(1)}%</small></span></button>`).join('');
    $('primary-topic-chart').querySelectorAll('[data-manual-topic]').forEach(button => button.addEventListener('click',() => setFilter('topic',`${state.axis==='target'?'target:':'manual:'}${button.dataset.manualTopic}`,true)));
  }

  function renderBars(id, rows, type) {
    rows = list(rows).map(row=>({...row,count:state.scopeRole?Number(row[state.scopeRole])||0:row.count})).filter(row => type==='committee'||Number(row.count)>0).sort((a,b)=>b.count-a.count);
    const max = Math.max(...rows.map(row => Number(row.count) || 0),1);
    const holder = $(id);
    holder.classList.remove('loading-placeholder');
    holder.innerHTML = rows.length ? rows.map(row => {
      const roleParts = (state.scopeRole?[state.scopeRole]:['primary','joint','cosign']).map(role => `<span class="chart-part ${role}" style="width:${(Number(row[role]) || 0)/max*100}%" title="${roleNames[role]} ${fmt(row[role] || 0)} 件"></span>`).join('');
      return `<button class="chart-row" data-chart-filter="${esc(row.name)}" title="${esc(row.name)}，共 ${fmt(row.count)} 件"><span class="chart-label">${esc(row.name)}</span><span class="chart-track">${roleParts}</span><span class="chart-value">${fmt(row.count)}<small>件</small></span></button>`;
    }).join('') : '<p class="small-note">這個範圍目前沒有可顯示資料。</p>';
    holder.querySelectorAll('[data-chart-filter]').forEach(button => button.addEventListener('click',() => setFilter(type,button.dataset.chartFilter,true)));
  }

  function renderCommitteeRoleTable() {
    const holder=$('committee-role-table');if(!holder)return;
    const d=state.data;
    holder.innerHTML='<table><thead><tr><th>流程所載委員會</th><th>主提案／41</th><th>共同提案／58</th><th>連署／1,287</th></tr></thead><tbody>'+list(d.committees).map(c=>'<tr><th>'+esc(c.name)+'</th>'+['primary','joint','cosign'].map(role=>'<td>'+fmt(c[role])+'<small> '+(Number(c[role])/d.totals[role]*100).toFixed(1)+'%</small></td>').join('')+'</tr>').join('')+'</tbody></table>';
  }

  function renderProcedure() {
    const source=state.data.procedure||{},rows=scopedBills(),returned=rows.filter(b=>b.returns);
    const p={...source,count:rows.length,returnedBills:returned.length,returnEvents:returned.reduce((n,b)=>n+b.returns,0),notes:'同案可能多次退回，流程列數不代表完整被擋次數；退回程序不等於否決。'};
    setText('returned-bills',fmt(p.returnedBills));
    setText('return-events',fmt(p.returnEvents));
    setText('procedure-note',`檢查範圍：${fmt(p.count)} 件法律案。${p.notes || '同案可能多次退回，案件數與事件數不同。紀錄未涵蓋的程序不能視為沒有發生。'}`);
    $('procedure-example')?.remove();
    const example = p.example || p.exampleEvent;
    if (example && (!state.scopeRole||state.scopeRole==='primary')) {
      let holder = $('procedure-example');
      if (!holder) { holder = document.createElement('div'); holder.id='procedure-example'; holder.className='procedure-example'; $('procedure-note').after(holder); }
      const description = typeof example === 'string' ? example : example.summary || example.description || example.note || example.title || `${example.date || ''} ${example.meeting || ''}，處理「${example.billTitle || ''}」的${example.kind || '程序'}動議。${example.vote ? `出席 ${example.vote.present}、贊成 ${example.vote.yes}、反對 ${example.vote.no}、棄權 ${example.vote.abstain}。` : ''}${example.result || ''}。${example.scopeNote || ''}`;
      const url = example.sourceURL || example.sourceUrl || example.url || p.sourceURL;
      holder.innerHTML = `<strong>流程以外，還有逐次議事證據</strong><p>${esc(description)}</p>${url ? `<a href="${esc(safeUrl(url))}" target="_blank" rel="noopener noreferrer">查閱原始公報 ↗</a>` : ''}`;
    }
    $('status-list').innerHTML = [...new Set(rows.map(b=>b.status))].map(name=>({name,count:rows.filter(b=>b.status===name).length})).map(row => `<span class="status-pill">${esc(row.name)}<strong>${fmt(row.count)}</strong></span>`).join('') || '<span class="small-note">目前進度未提供。</span>';
  }

  function renderAttendance() {
    const a = state.data.attendance || {};
    const paragraphs = [a.summary,a.note,a.coverageNote,...list(a.notes)].filter(value => typeof value === 'string' && value);
    if (a.educationMeetings?.length) {
      setText('attendance-summary',`目前查得 ${fmt(a.educationIvodCount)} 段以教育及文化委員會為主辦單位的 iVOD；正式議事錄卻至少有 ${fmt(a.educationListedMeetingsAtLeast)} 個單獨教文會議將他列為列席委員，另有 ${fmt(list(a.jointEducationMeetings).length)} 個聯席會議。常設委員會是${a.formalPermanentCommittee || '外交及國防委員會'}。因此「2 段影片」不能改寫成「只到過 2 次」。名冊與多日會議也不能直接推算到場天數。`);
      const meetingRows = rows => rows.map(row => `<li><div><strong>${list(row.dates).map(esc).join(' ／ ')}</strong><span>${esc(row.title)}</span><p>${esc(row.evidence)}。${esc(row.note || '')}</p></div><a href="${esc(safeUrl(row.url))}" target="_blank" rel="noopener noreferrer">官方議事錄 PDF ↗</a></li>`).join('');
      const speeches = list(a.educationSpeechTopics).map(row => {
        const meeting = list(a.educationMeetings).find(meeting => list(meeting.ivodIds).includes(row.ivodId));
        return `<div class="speech-evidence"><span>${esc(row.date)}</span><p>${esc(row.summary)}</p><small>「中國」字串：${fmt(row.literalChinaCount)} 次</small>${meeting ? `<a href="${esc(safeUrl(meeting.meetingUrl))}" target="_blank" rel="noopener noreferrer">查看會議與公報 ↗</a>` : ''}</div>`;
      }).join('');
      $('attendance-links').innerHTML = `<div class="attendance-metrics"><div><strong>${fmt(a.educationIvodCount)}</strong><span>單獨教文影片段數</span></div><div><strong>≥ ${fmt(a.educationListedMeetingsAtLeast)}</strong><span>單獨教文列席會議</span></div><div><strong>${fmt(list(a.jointEducationMeetings).length)}</strong><span>另查得教文聯席會議</span></div></div><h4>四個單獨教文會議的官方名冊證據</h4><ul class="attendance-meetings">${meetingRows(a.educationMeetings)}</ul><details class="joint-attendance"><summary>另看 ${fmt(list(a.jointEducationMeetings).length)} 個聯席會議來源 ＋</summary><ul class="attendance-meetings">${meetingRows(a.jointEducationMeetings)}</ul></details><div class="speech-evidence-grid">${speeches}</div><p class="small-note">兩段教文發言也有高教、城鄉教育資源與個資／資安脈絡，不能改述成「全程只談中國」。字詞次數僅限這兩段已核對發言樣本，非任期總量；多日一會的名冊不分日，未顯示的會議紀錄也不當作零。</p><div class="source-links">${list(a.sources).slice(0,2).map(source => `<a href="${esc(safeUrl(source.url))}" target="_blank" rel="noopener noreferrer">${esc(source.title)} ↗</a>`).join('')}</div>`;
      $('attendance-links').classList.add('attendance-evidence');
      return;
    }
    if (paragraphs.length) setText('attendance-summary',paragraphs.join(' '));
    const sources = list(a.sources || a.links);
    $('attendance-links').innerHTML = sources.map((source,i) => typeof source === 'string' ? `<a href="${esc(safeUrl(source))}" target="_blank" rel="noopener noreferrer">核對來源 ${i+1} ↗</a>` : `<a href="${esc(safeUrl(source.url || source.href))}" target="_blank" rel="noopener noreferrer">${esc(source.label || source.title || `核對來源 ${i+1}`)} ↗</a>`).join('');
  }

  function renderPolicy() {
    const p = state.policy, rows = list(p.policies), total = rows.length || Number(p.selection?.denominator) || 0;
    setText('policy-total',fmt(total));
    const labels = {H:'空間',E:'培力與機會',A:'陪伴',R:'韌性與安心',T:'時間'};
    $('policy-chart').classList.remove('loading-placeholder');
    $('policy-chart').innerHTML = Object.entries(labels).map(([key,label]) => {
      const count = rows.filter(row => list(row.heart).includes(key)).length;
      const pct = total ? count/total*100 : 0;
      return `<div class="policy-bar"><span><span class="heart-letter">${key}</span>${label}</span><span class="chart-track"><span class="policy-bar-fill" style="width:${pct}%"></span></span><span class="policy-bar-value">${pct.toFixed(1)}%<small>${count} ／ ${total} 頁</small></span></div>`;
    }).join('');
    $('policy-pages').innerHTML = rows.map(row => `<a class="policy-page" href="${esc(safeUrl(row.url))}" target="_blank" rel="noopener noreferrer" title="${esc(row.summary)}"><span>${esc(row.title)}<small>${list(row.heart).map(esc).join(' · ')}</small></span><span aria-hidden="true">↗</span></a>`).join('');
  }

  function populateFilters() {
    const d = state.data;
    const targets=[...new Set(d.bills.filter(b=>b.role==='primary').map(b=>b.targetTopic))].map(name=>({value:'target:'+name,label:'對象｜'+name}));
    const manual = primaryTopics().map(row => ({value:`manual:${row.name}`,label:`主提案｜${row.name}`}));
    const definitions = [
      ['topic-filter',[...(!state.scopeRole||state.scopeRole==='primary'?[...targets,...manual]:[]),...list(d.topics).filter(row=>!state.scopeRole||row[state.scopeRole]>0).map(row => ({value:row.name,label:`內容｜${row.name}`}))]],
      ['committee-filter',list(d.committees).map(row => ({value:row.name,label:row.name}))],
      ['status-filter',[...new Set(scopedBills().map(bill => bill.status).filter(Boolean))].sort((a,b) => String(a).localeCompare(String(b),'zh-TW')).map(status => ({value:status,label:status}))]
    ];
    definitions.forEach(([id,rows]) => { const value=$(id).value;$(id).innerHTML='<option value="">'+({ 'topic-filter':'所有主題','committee-filter':'所有委員會','status-filter':'所有進度'}[id])+'</option>'+rows.map(row => `<option value="${esc(row.value)}">${esc(row.label)}</option>`).join('');$(id).value=value; });
  }

  function keywordCounts(term, role) {
    let occurrences = 0, bills = 0;
    for (const bill of state.data?.bills || []) {
      if (role && bill.role !== role) continue;
      const count = countWord(keywordText.get(bill.id) || '',term);
      if (count) { occurrences += count; bills++; }
    }
    return {occurrences,bills};
  }

  function updateKeyword() {
    if (!state.data) return;
    const previousKeyword = state.keyword;
    state.keyword = normalize($('keyword-input').value.trim());
    const word = state.keyword, counts = keywordCounts(word,state.scopeRole), primary = keywordCounts(word,'primary'), k = state.data.keywords || {};
    setText('keyword-count',word ? fmt(counts.occurrences) : '—');
    setText('keyword-bills',word ? fmt(counts.bills) : '—');
    const missing = k.coverage || {}, missingReasons = scopedBills().filter(b=>b.hasReason===false).length, missingText = scopedBills().filter(b=>b.hasAmendmentText===false).length;
    const scope = `目前為${state.scopeRole?roleNames[state.scopeRole]:'全部角色'} ${scopedBills().length} 件。${k.label || '議案名稱、案由與已收錄文字'}。${k.scope || ''}${missingReasons || missingText ? ` 已知 ${missingReasons} 案缺案由、${missingText} 案缺修正表文字，文本不完整。` : ''}${word ? `主提案範圍：「${word}」${fmt(primary.occurrences)} 次、${fmt(primary.bills)}／${fmt(state.data.totals?.primary)} 案。` : '請輸入字詞開始計算。'}`;
    setText('keyword-scope',scope);
    $('keyword-explore').disabled = !word;
    document.querySelectorAll('[data-keyword]').forEach(button => button.classList.toggle('active',button.dataset.keyword === word));
    if (previousKeyword !== word && !state.exactKeyword) renderBills();
  }

  function setFilter(key,value,scroll) {
    if (scroll) {
      Object.assign(state,{search:'',role:state.scopeRole,topic:'',committee:'',status:'',exactKeyword:''});
      ['bill-search','role-filter','topic-filter','committee-filter','status-filter'].forEach(id => { $(id).value=''; });
    }
    $('role-filter').value=state.role;
    state[key] = value;
    if(key==='role'){state.scopeRole=value;Object.assign(state,{search:'',topic:'',committee:'',status:'',exactKeyword:''});['bill-search','topic-filter','committee-filter','status-filter'].forEach(id=>$(id).value='');if($('advanced-information')&&value!=='primary')$('advanced-information').open=true;renderScope();}
    state.page = 1;
    const ids = {role:'role-filter',topic:'topic-filter',committee:'committee-filter',status:'status-filter',sort:'sort-select'};
    if (ids[key]) $(ids[key]).value = value;
    if (key === 'topic' && (value.startsWith('manual:')||value.startsWith('target:'))) { state.role='primary';state.scopeRole='primary';$('role-filter').value='primary';renderScope(); }
    renderBills();
    if (scroll) $('explorer').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
  }

  function filteredBills() {
    const query = normalize(state.search).toLocaleLowerCase();
    const rows = (state.data?.bills || []).filter(bill => {
      if (state.role && bill.role !== state.role) return false;
      if (state.topic) {
        if(state.topic.startsWith('target:')) {if(bill.targetTopic!==state.topic.slice(7))return false;}
        else if (state.topic.startsWith('manual:')) { if (bill.manualTopic !== state.topic.slice(7)) return false; }
        else if (!names(bill.topics).includes(state.topic)) return false;
      }
      if (state.committee && !names(bill.committees).includes(state.committee)) return false;
      if (state.status && bill.status !== state.status) return false;
      if (query && !(searchable.get(bill.id) || '').includes(query)) return false;
      if (state.exactKeyword && !(keywordText.get(bill.id) || '').includes(state.exactKeyword)) return false;
      return true;
    });
    const byDate = (a,b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.id).localeCompare(String(b.id));
    return rows.sort((a,b) => state.sort === 'date-asc' ? byDate(a,b) : state.sort === 'title' ? String(a.title).localeCompare(String(b.title),'zh-TW') : state.sort === 'china-desc' ? (Number(b.chinaCount)||0)-(Number(a.chinaCount)||0) || -byDate(a,b) : -byDate(a,b));
  }

  function renderBills() {
    if (!state.data) return;
    const rows = filteredBills(), totalPages = Math.max(1,Math.ceil(rows.length/state.pageSize));
    state.page = Math.min(state.page,totalPages);
    const start = (state.page-1)*state.pageSize, page = rows.slice(start,start+state.pageSize);
    $('result-count').innerHTML = `找到 <strong>${fmt(rows.length)}</strong> 件 ／ ${state.role?roleNames[state.role]:'全部角色'} ${fmt(state.role?state.data.totals[state.role]:state.data.totals.unique)} 件${state.exactKeyword ? ` · 內文含「${esc(state.exactKeyword)}」` : ''}`;
    setText('page-info',`${state.page} ／ ${totalPages} 頁`);
    $('prev-page').disabled = state.page <= 1;
    $('next-page').disabled = state.page >= totalPages;
    $('bill-list').innerHTML = page.length ? page.map((bill,index) => {
      const tags = [bill.targetTopic,bill.manualTopic,...names(bill.topics).slice(0,2),...names(bill.committees).slice(0,1)].filter(Boolean);
      const detailId = `detail-${index}`;
      const inspectedWord = state.exactKeyword || state.keyword;
      const fieldLabels = {title:'議案名稱',reason:'案由',text:'擬修正／增訂條文與說明'};
      const fields = list(state.data.keywords?.fields).length ? state.data.keywords.fields : ['title','reason','text'];
      const fieldHits = fields.map(field => ({label:fieldLabels[field] || field,count:countWord(normalize(bill[field]),inspectedWord)}));
      const hitSummary = inspectedWord ? `目前查核「${inspectedWord}」：${fieldHits.map(hit => `${hit.label} ${hit.count} 次`).join('；')}。` : '在上方字詞查核區輸入字詞，可查看各欄位命中次數。';
      return `<article class="bill-row"><button class="bill-main" aria-expanded="false" aria-controls="${detailId}"><span class="bill-date">${esc(bill.date || '日期未載')}</span><div><span class="bill-title">${esc(bill.title)}</span><span class="bill-tags">${tags.map(tag => `<span class="tag">${esc(tag)}</span>`).join('')}</span></div><span class="bill-role ${esc(bill.role)}">${esc(roleNames[bill.role] || bill.role)}</span><span class="bill-toggle" aria-hidden="true">＋</span></button><div class="bill-detail" id="${detailId}" hidden><dl><dt>議案編號</dt><dd>${esc(bill.id)}</dd><dt>提案人</dt><dd>${esc(names(bill.proposers).join('、') || '資料未載')}</dd><dt>連署人</dt><dd>${esc(names(bill.cosigners).join('、') || '資料未載')}</dd><dt>目前進度</dt><dd>${esc(bill.status || '資料未載')}${bill.latestProgress ? `（${esc(bill.latestProgress)}）` : ''}</dd><dt>委員會</dt><dd>${esc(names(bill.committees).join('、') || '流程未載')}</dd>${bill.manualTopic ? `<dt>人工主題</dt><dd>${esc(bill.manualTopic)}</dd>` : ''}<dt>程序紀錄</dt><dd>已收錄 ${fmt(bill.returns || 0)} 列退回程序紀錄；不代表完整阻擋次數。</dd><dt>文本覆蓋</dt><dd>${bill.hasReason === false ? '缺案由；' : ''}${bill.hasAmendmentText === false ? '缺修正表文字；' : ''}字詞計數限已收錄文字。</dd></dl><p class="small-note">${esc(hitSummary)}</p><p class="reason-label">案由／提案理由</p><div class="reason">${esc(bill.reason || '目前未取得案由，請查看原案附件。')}</div><details class="bill-text"><summary>擬修正／增訂條文與說明（展開已收錄全文）</summary><div class="reason">${esc(bill.text || '目前未取得修正表文字，請查看原案附件。')}</div></details><a href="${esc(safeUrl(bill.url))}" target="_blank" rel="noopener noreferrer">前往立法院原案與附件 <span>↗</span></a></div></article>`;
    }).join('') : '<div class="empty-state">目前條件沒有找到法案。請減少篩選條件，或換一個字詞。</div>';
    $('bill-list').querySelectorAll('.bill-main').forEach(button => button.addEventListener('click',() => {
      const open = button.getAttribute('aria-expanded') !== 'true';
      button.setAttribute('aria-expanded',String(open));
      $(button.getAttribute('aria-controls')).hidden = !open;
      button.querySelector('.bill-toggle').textContent = open ? '－' : '＋';
    }));
  }

  function gameQuotes() {
    return state.quotes.filter(q=>q.quizEligible!==false).filter(q=>{
      const date=String(q.eventDate || q.date).slice(0,10);
      return state.gamePeriod==='all' || (state.gamePeriod==='pre' ? date<'2026-05-13' : date>='2026-05-13');
    });
  }

  function quoteMedium(q) { return q.medium==='written' ? '書面文章' : '口語發言'; }

  const QUIZ_ROUND_SIZE=6;
  const quizSeenKey='record-quiz-seen-v1';
  let quizSeen=new Set();
  try{const stored=JSON.parse(localStorage.getItem(quizSeenKey)||'[]');if(Array.isArray(stored))quizSeen=new Set(stored.filter(x=>typeof x==='string'));}catch{}
  function shuffled(items){const out=[...items];for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
  function poolInfo(){
    const pool=gameQuotes(),period={pre:'正式提名前',post:'正式提名起',all:'所有時期'}[state.gamePeriod],seen=pool.filter(q=>quizSeen.has(q.id)).length;
    setText('game-period-note',period+'：'+pool.length+'段、'+new Set(pool.map(q=>q.eventId||q.id)).size+'個事件／文章。提名切點2026-05-13。');
    setText('quiz-pool-count',pool.length);setText('quiz-seen-count',seen+' / '+pool.length);
    setText('quiz-round-note',state.quizNewCount?'本輪'+state.quiz.length+'題，抽到'+state.quizNewCount+'題未看過的新題。優先避開上一輪；記錄只存在這個瀏覽器。':'本期題目已全數看過；本輪重抽順序，並盡量避開上一輪。');
  }
  function buildGames(){
    const quotes=gameQuotes();
    setText('quote-selection','本範圍精選'+quotes.length+'段本人言論／文章，全部答案為「是」。精選集並非隨機言論樣本，不能推算平日風格。口語與書面分別提問，官方逐字稿與媒體引述分別標示。');
    resetQuiz();
  }
  function resetQuiz(){
    const pool=gameQuotes(),previous=new Set(state.quiz.map(q=>q.id));
    const fresh=shuffled(pool.filter(q=>!quizSeen.has(q.id)));
    const older=shuffled(pool.filter(q=>quizSeen.has(q.id)&&!previous.has(q.id)));
    const last=shuffled(pool.filter(q=>quizSeen.has(q.id)&&previous.has(q.id)));
    const chosen=[],chosenEvents=new Set();
    const roundSize=Math.min(QUIZ_ROUND_SIZE,new Set(pool.map(q=>q.eventId||q.id)).size);
    for(const q of [...fresh,...older,...last]){
      const eventId=q.eventId||q.id;
      if(chosenEvents.has(eventId))continue;
      chosen.push(q);chosenEvents.add(eventId);
      if(chosen.length===roundSize)break;
    }
    state.quizNewCount=chosen.filter(q=>!quizSeen.has(q.id)).length;
    state.quiz=shuffled(chosen).map(q=>({id:q.id,statement:'「'+q.quote+'」\n這是沈伯洋'+(q.medium==='written'?'寫的':'說的')+'嗎？',answer:true,source:q.url,frontContext:q.frontContext||q.context,meta:q.date+' · '+quoteMedium(q),explanation:q.date+' · '+quoteMedium(q)+' · '+q.venue+'。'+q.context+'〔'+q.sourceType+'〕',limit:q.inferenceLimit||'',locator:q.evidenceLocator||''}));
    state.quizIndex=0;state.quizCorrect=0;state.quizAnswered=false;
    $('quiz-restart').hidden=!state.quiz.length;renderQuiz();
  }

  function renderQuiz() {
    const question = state.quiz[state.quizIndex];
    $('quiz-feedback').hidden=true;
    $('quiz-next').hidden=true;
    $('quiz-controls').hidden=false;
    $('quiz-card').style.transform='';
    $('quiz-card').style.opacity='';
    $('quiz-card').querySelectorAll('.swipe-stamp').forEach(stamp => stamp.style.opacity='0');
    state.quizAnswered=false;
    setText('quiz-score',`${state.quizCorrect*10} ／ ${state.quiz.length*10} 分`);
    if (!question) {
      poolInfo();$('quiz-card').dataset.questionId='';
      setText('quiz-context','');
      setText('quiz-meta','');
      setText('quiz-progress',state.quiz.length ? '本輪完成' : '題庫未載入');
      setText('quiz-question',state.quiz.length ? `完成 ${state.quiz.length} 次核對，答對 ${state.quizCorrect} 題。` : '題庫暫時無法讀取，請重新整理後再試。');
      $('quiz-card').querySelector('.quiz-foot').textContent=state.quiz.length ? '記住來源，比記住答案更有用。' : '每個答案都需要可核對的來源。';
      $('quiz-controls').hidden=true;
      $('quiz-restart').hidden=!state.quiz.length;
      return;
    }
    quizSeen.add(question.id);try{localStorage.setItem(quizSeenKey,JSON.stringify([...quizSeen].slice(-800)));}catch{}
    poolInfo();
    $('quiz-card').dataset.questionId=question.id;
    setText('quiz-progress',`${state.quizIndex+1} ／ ${state.quiz.length} 題`);
    setText('quiz-meta',question.meta);
    setText('quiz-context',question.frontContext || '請連同回答後提供的場合與上下文核對。');
    setText('quiz-question',question.statement);
    $('quiz-card').querySelector('.quiz-foot').textContent='左滑否 ／ 右滑是 ／ 鍵盤方向鍵';
  }

  function answerQuiz(answer) {
    if (state.quizAnswered || !state.quiz[state.quizIndex]) return;
    const question = state.quiz[state.quizIndex], correct = answer === question.answer;
    state.quizAnswered=true;
    if (correct) state.quizCorrect++;
    const feedback=$('quiz-feedback');
    feedback.hidden=false;
    feedback.classList.toggle('incorrect',!correct);
    feedback.innerHTML=`<strong>${correct ? '✓ 核對正確' : '再看一次證據'} · 答案是「${question.answer ? '是' : '否'}」</strong><p>${esc(question.explanation)}</p>${question.locator ? `<p><b>查核位置：</b>${esc(question.locator)}</p>` : ''}${question.limit ? `<p><b>判讀範圍：</b>${esc(question.limit)}</p>` : ''}<a href="${esc(safeUrl(question.source) === '#method' && question.source?.startsWith('#') ? question.source : safeUrl(question.source))}" ${question.source?.startsWith('#') ? '' : 'target="_blank" rel="noopener noreferrer"'}>查看原文與上下文 ↗</a>`;
    setText('quiz-score',`${state.quizCorrect*10} ／ ${state.quiz.length*10} 分`);
    $('quiz-controls').hidden=true;
    $('quiz-next').hidden=false;
    setText('quiz-next',state.quizIndex === state.quiz.length-1 ? '看本輪結果 →' : '下一題 →');
    $('quiz-card').style.transform=`rotate(${answer ? 2 : -2}deg)`;
    $('quiz-card').querySelector(answer ? '.stamp-yes' : '.stamp-no').style.opacity='.85';
    announce(`${correct ? '答對' : '答案不同'}。${question.answer ? '是' : '否'}。${question.explanation}`);
  }

  function bindEvents() {
    $('scope-filter')?.addEventListener('change',e=>setFilter('role',e.target.value,false));
    $('primary-axis')?.addEventListener('change',e=>{state.axis=e.target.value;renderPrimaryTopics();});
    $('open-advanced')?.addEventListener('click',()=>{$('advanced-information').open=true;});
    document.querySelectorAll('[data-role]').forEach(button=>button.addEventListener('click',()=>setFilter('role',button.dataset.role,true)));
    document.querySelectorAll('[data-keyword]').forEach(button=>button.addEventListener('click',()=>{$('keyword-input').value=button.dataset.keyword;updateKeyword();}));
    $('keyword-form').addEventListener('submit',event=>{event.preventDefault();updateKeyword();});
    $('keyword-input').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(updateKeyword,180);});
    $('keyword-explore').addEventListener('click',()=>{Object.assign(state,{exactKeyword:state.keyword,search:'',role:state.scopeRole,topic:'',committee:'',status:'',page:1});['bill-search','role-filter','topic-filter','committee-filter','status-filter'].forEach(id=>$(id).value='');$('role-filter').value=state.role;renderBills();$('explorer').scrollIntoView({behavior:'smooth'});});
    $('bill-search').addEventListener('input',event=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{state.search=event.target.value;state.page=1;renderBills();},200);});
    [['role-filter','role'],['topic-filter','topic'],['committee-filter','committee'],['status-filter','status'],['sort-select','sort']].forEach(([id,key])=>$(id).addEventListener('change',event=>setFilter(key,event.target.value,false)));
    $('reset-filters').addEventListener('click',()=>{Object.assign(state,{page:1,search:'',role:'primary',scopeRole:'primary',topic:'',committee:'',status:'',exactKeyword:'',sort:'date-desc'});['bill-search','role-filter','topic-filter','committee-filter','status-filter'].forEach(id=>$(id).value='');$('sort-select').value='date-desc';$('role-filter').value='primary';renderScope();renderBills();});
    [['prev-page',-1],['next-page',1]].forEach(([id,direction])=>$(id).addEventListener('click',()=>{state.page+=direction;renderBills();$('explorer').scrollIntoView({behavior:'smooth'});}));
    $('quiz-no').addEventListener('click',()=>answerQuiz(false));
    $('game-period').addEventListener('change',event=>{state.gamePeriod=event.target.value;buildGames();});
    $('quiz-yes').addEventListener('click',()=>answerQuiz(true));
    $('quiz-next').addEventListener('click',()=>{state.quizIndex++;renderQuiz();$('quiz-card').focus({preventScroll:true});});
    $('quiz-restart').addEventListener('click',resetQuiz);
    $('quiz-card').addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();answerQuiz(event.key==='ArrowRight');}});
    let pointerStart=null;
    const card=$('quiz-card');
    card.addEventListener('pointerdown',event=>{if(state.quizAnswered||!state.quiz[state.quizIndex]||event.target.closest('a,button'))return;pointerStart={x:event.clientX,y:event.clientY,id:event.pointerId};card.setPointerCapture(event.pointerId);});
    card.addEventListener('pointermove',event=>{if(!pointerStart)return;const dx=event.clientX-pointerStart.x,dy=event.clientY-pointerStart.y;if(Math.abs(dy)>60&&Math.abs(dy)>Math.abs(dx)){pointerStart=null;card.style.transform='';return;}card.style.transform=`translateX(${dx*.55}px) rotate(${dx/22}deg)`;card.querySelector('.stamp-yes').style.opacity=String(Math.max(0,Math.min(dx/100,1)));card.querySelector('.stamp-no').style.opacity=String(Math.max(0,Math.min(-dx/100,1)));});
    const endPointer=event=>{if(!pointerStart)return;const dx=event.clientX-pointerStart.x;pointerStart=null;card.style.transform='';card.querySelectorAll('.swipe-stamp').forEach(stamp=>stamp.style.opacity='0');if(Math.abs(dx)>65)answerQuiz(dx>0);};
    card.addEventListener('pointerup',endPointer);
    card.addEventListener('pointercancel',()=>{pointerStart=null;card.style.transform='';card.querySelectorAll('.swipe-stamp').forEach(stamp=>stamp.style.opacity='0');});
  }

  init().catch(error=>{console.error('資料觀測頁初始化失敗',error);$('load-error').hidden=false;$('load-error').textContent='頁面尚未完整載入。請重新整理，或下載原始資料核對。';}).finally(()=>{document.dispatchEvent(new CustomEvent('records:ready',{detail:'app'}));});
})();
