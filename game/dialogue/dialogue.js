(function () {
  'use strict';
  const core = window.RecordsDialogue;
  const $ = id => document.getElementById(id);
  const make = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let dataset, source, currentRound, game, roundSeed, sharedSeed, busy = false;
  function announce(text) { $('announcement').textContent = text; }
  function moveTo(node) { node.scrollIntoView({block:'start',behavior:reduce.matches ? 'auto' : 'smooth'}); }
  function safeLink(value, text) {
    try { const url = new URL(value); if (url.protocol !== 'https:' || url.username || url.password) return null; const a = make('a','',text); a.href = url.href; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; } catch { return null; }
  }
  function links(q) {
    const node = make('div','source-links');
    const original = safeLink(q.url,'查看原始來源 ↗'); if (original) node.append(original);
    if (q.videoUrl && q.videoUrl !== q.url) { const video = safeLink(q.videoUrl,'完整影片入口 ↗'); if (video) node.append(video); }
    return node;
  }
  function metadata(q) { return [q.date,q.sourceType].filter(Boolean).join(' · '); }
  function sourceItem(q, label) {
    const article = make('article','source-item');
    if (label) article.append(make('p','eyebrow',label));
    article.append(make('h3','',`「${q.quote}」`),make('p','source-meta',metadata(q)),make('p','',q.frontContext || q.context),links(q));
    const detail = make('details'); detail.append(make('summary','','展開完整前後文'),make('p','',q.context));
    if (q.evidenceLocator) detail.append(make('p','',`可核位置：${q.evidenceLocator}`));
    article.append(detail); return article;
  }
  function newSeed() {
    if (window.crypto?.getRandomValues) return Array.from(window.crypto.getRandomValues(new Uint8Array(6)),n => n.toString(16).padStart(2,'0')).join('');
    return Array.from({length:12},() => Math.floor(Math.random()*16).toString(16)).join('');
  }
  function renderProgress() {
    const state = game.state();
    $('progress').replaceChildren(...Array.from({length:state.total},(_,i) => {
      const answer = state.answers[i], node = make('span',answer ? (answer.correct ? 'correct' : 'missed') : i === state.index ? 'current' : '');
      node.setAttribute('aria-label',`第 ${i+1} 題：${answer ? (answer.correct ? '配對成功' : '配對不同') : i === state.index ? '作答中' : '尚未作答'}`); return node;
    }));
    $('live-score').replaceChildren(document.createTextNode(`${state.score.correct} `),make('small','',`/ ${state.total}`));
    $('round-number').textContent = `ROUND ${String(state.index+1).padStart(2,'0')} / ${String(state.total).padStart(2,'0')}`;
  }
  function renderQuestion({first = false} = {}) {
    const row = game.current();
    $('topic').textContent = row.topic; $('speaker').textContent = row.speaker;
    $('prompt').textContent = row.prompt; $('cue').textContent = row.cue;
    $('sent-message').hidden = true; $('reply').textContent = ''; $('typing').hidden = false;
    $('feedback').hidden = true; $('feedback').className = 'feedback'; $('feedback-copy')?.classList.remove('in');
    $('choices').replaceChildren(...row.choices.map((q,index) => {
      const button = make('button','quote-choice'); button.type = 'button'; button.dataset.quoteId = q.id;
      button.append(make('span','letter',String.fromCharCode(65+index)),make('span','choice-text',`「${q.quote}」`));
      button.addEventListener('click',() => choose(q.id)); return button;
    }));
    $('choice-hint').textContent = '三句都來自沈伯洋。依原始議題選最相符的一句。';
    renderProgress(); $('round-heading').focus({preventScroll:true}); moveTo($('play'));
    announce(`${first ? '新的一輪。' : ''}第 ${game.state().index+1} 題，共六題。${row.topic}。`);
  }
  function start(key) {
    if (!dataset || !source || busy) return;
    busy = true;
    try {
      const previous = currentRound?.map(row => row.id).join(',');
      let nextSeed = core.seed(key) || newSeed(), nextRound = core.makeRound(dataset,source,nextSeed);
      // A replay must not return the exact previous sequence, even with a weak RNG fallback.
      if (!key) for (let tries = 0; tries < 8 && nextRound.map(row => row.id).join(',') === previous; tries++) { nextSeed = newSeed(); nextRound = core.makeRound(dataset,source,nextSeed); }
      roundSeed = nextSeed; currentRound = nextRound; game = core.session(currentRound);
      // Keep previews and the private mirror on their own origin; shared links use the public origin below.
      try { history.replaceState(null,'',core.localChallengeUrl(location.href,roundSeed)); } catch { /* Restricted embedded browsers can still play. */ }
      $('intro').hidden = true; $('result').hidden = true; $('error').hidden = true; $('play').hidden = false;
      $('share-status').textContent = ''; renderQuestion({first:true});
    } catch { showError('這輪題目未能整理，請重新載入。'); }
    finally { busy = false; }
  }
  function choose(id) {
    if (!game || game.state().phase !== 'question') return;
    const row = game.current(), picked = row.choices.find(q => q.id === id); if (!picked) return;
    const answer = game.choose(id);
    $('choices').querySelectorAll('button').forEach(button => {
      button.disabled = true;
      if (button.dataset.quoteId === id) { button.classList.add('selected'); button.setAttribute('aria-label',`你選的原話：${picked.quote}`); }
      else if (button.dataset.quoteId === row.targetId) button.classList.add('correct-answer');
      else button.classList.add('faded');
    });
    $('reply').textContent = picked.quote; $('sent-message').hidden = false; $('typing').hidden = true;
    const feedback = $('feedback'); feedback.classList.toggle('missed',!answer.correct);
    $('feedback-mark').textContent = answer.correct ? '✓' : '↳';
    $('feedback-tag').textContent = answer.correct ? 'MATCHED / 議題對上了' : 'ANOTHER CONTEXT / 原話來自另一個議題';
    $('feedback-heading').textContent = answer.correct ? '這句，你接中了。' : '這句他也說過，但原本談的是別的事。';
    $('feedback-quote').textContent = `原始議題對應的原話：「${row.quote.quote}」`;
    $('feedback-context').textContent = row.quote.frontContext || row.quote.context;
    $('feedback-meta').textContent = metadata(row.quote); $('feedback-links').replaceChildren(links(row.quote));
    $('all-sources').replaceChildren(...row.choices.map(q => sourceItem(q,q.id === row.targetId ? '本題配對原話' : q.id === id ? '你選的原話 · 不同議題' : '另一個選項 · 不同議題')));
    feedback.querySelector('details').open = false;
    $('next').textContent = game.state().index+1 === currentRound.length ? '看看我的成績 →' : '下一段對話 →';
    $('choice-hint').textContent = '選句已送出。以下揭曉配對結果，讀完再繼續。';
    feedback.hidden = false; renderProgress(); $('feedback-heading').focus({preventScroll:true}); moveTo(feedback);
    announce(`${answer.correct ? '配對成功。' : '配對不同。'}本題原始議題的原話是：${row.quote.quote}。`);
  }
  function result() {
    const state = game.state(), {correct,percent,total} = state.score;
    $('play').hidden = true; $('result').hidden = false; $('result-percent').textContent = String(percent);
    $('result-caption').textContent = correct === total ? '六句全接中。這輪的原話辨識，很到位。' : correct >= 4 ? `接中 ${correct}／${total} 句。熟悉幾句，也發現幾句意外。` : `接中 ${correct}／${total} 句。意外的那幾句，現在都能回到原文看。`;
    $('ticket-score').replaceChildren(document.createTextNode(String(correct)),make('small','',`/ ${total}`));
    $('result-dots').replaceChildren(...state.answers.map((answer,i) => { const n = make('span',answer.correct ? '' : 'missed',answer.correct ? '✓' : '↳'); n.setAttribute('aria-label',`第 ${i+1} 題${answer.correct ? '配對成功' : '配對不同'}`); return n; }));
    $('review').replaceChildren(...currentRound.map((row,index) => {
      const answer = state.answers[index], picked = row.choices.find(q => q.id === answer.chosenId);
      const article = make('article','review-item'), number = make('span','review-number',String(index+1).padStart(2,'0')), body = make('div');
      body.append(make('div',`review-status${answer.correct ? '' : ' missed'}`,answer.correct ? '✓ 配對成功' : '↳ 配對不同'),make('p','review-prompt',`虛構情境：${row.prompt}`));
      body.append(make('p','review-choice',`你的選句：「${picked.quote}」`),make('p','review-answer',`議題正解：「${row.quote.quote}」`),make('p','review-context',row.quote.frontContext || row.quote.context),make('p','source-meta',metadata(row.quote)),links(row.quote));
      const detail = make('details'); detail.append(make('summary','','看完整前後文與其他選項'),make('p','',row.quote.context));
      for (const q of row.choices.filter(q => q.id !== row.targetId)) detail.append(sourceItem(q,q.id === answer.chosenId ? '你選的那一句 · 原本語境' : '另一個選項 · 原本語境'));
      body.append(detail); article.append(number,body); return article;
    }));
    $('result-heading').focus({preventScroll:true}); moveTo($('result')); announce(`本輪完成，接中 ${correct}／${total} 句，配對得分 ${percent}%。`);
  }
  async function share() {
    const state = game?.state(); if (state?.phase !== 'result') return;
    const {correct,total,percent} = state.score, url = core.challengeUrl(roundSeed);
    const text = `這一輪，我是 ${percent}% 的沈委員！接中 ${correct}／${total} 句原話。換你接同一輪對話？（分數是原話配對成績）`;
    const button = $('share'); button.disabled = true;
    try {
      if (navigator.share) {
        try { await navigator.share({title:'百分之幾的沈委員？｜原話接招室',text,url}); $('share-status').textContent = '分享視窗已開啟；朋友可挑戰同一輪。'; return; }
        catch (error) { if (error.name === 'AbortError') { $('share-status').textContent = '這次未分享，成績還在這裡。'; return; } }
      }
      if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(`${text}\n${url}`); $('share-status').textContent = '已複製成績與同題連結，貼給朋友就能挑戰。'; }
      else $('share-status').textContent = `可分享這個同題連結：${url}`;
    } catch { $('share-status').textContent = `請複製同題連結：${url}`; }
    finally { button.disabled = false; }
  }
  function showError(message) {
    $('intro').hidden = true; $('play').hidden = true; $('result').hidden = true; $('error').hidden = false;
    $('error-message').textContent = message; announce(message);
  }
  async function init() {
    try {
      if (!core) throw new Error('missing_core');
      const [roundResponse,quoteResponse] = await Promise.all([fetch('./rounds.json?v=30'),fetch('/data/quotes.json')]);
      if (!roundResponse.ok || !quoteResponse.ok) throw new Error('fetch_failed');
      const [rounds,quoteBytes] = await Promise.all([roundResponse.json(),quoteResponse.arrayBuffer()]);
      if (quoteBytes.byteLength > 1500000 || !window.crypto?.subtle) throw new Error('source_unavailable');
      const digest = Array.from(new Uint8Array(await window.crypto.subtle.digest('SHA-256',quoteBytes)),n => n.toString(16).padStart(2,'0')).join('');
      if (digest !== rounds.sourceSha256) throw new Error('source_changed');
      const quotes = JSON.parse(new TextDecoder().decode(quoteBytes)); core.validate(rounds,quotes); dataset = rounds; source = quotes;
      const param = new URL(location.href).searchParams.get('round'); sharedSeed = core.seed(param);
      $('start').disabled = false; $('start').textContent = sharedSeed ? '接朋友的這一輪 →' : '開始接話 · 六段對話 →';
      $('load-status').textContent = `${rounds.scenarios.length} 個情境，每輪抽出 6 個不同事件。${param && !sharedSeed ? '分享輪次格式無效，可重新開一輪。' : sharedSeed ? '同題連結已就緒，按下開始即可。' : '不計時，讀完再選。'}`;
    } catch (error) { showError(error.message === 'source_changed' ? '原話來源版本已更新，這輪暫時停止出題。請稍後再試，或回原話檔案查看。' : '題庫或原話資料暫時無法載入，請確認網路後重新開啟。'); }
  }
  $('start').addEventListener('click',() => { const key = sharedSeed; sharedSeed = null; start(key); });
  $('next').addEventListener('click',() => { if (!game || game.state().phase !== 'feedback') return; if (game.next()) renderQuestion(); else result(); });
  $('replay').addEventListener('click',() => start()); $('restart-in-round').addEventListener('click',() => start());
  $('share').addEventListener('click',share); $('retry').addEventListener('click',() => location.reload());
  init();
})();
