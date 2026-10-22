/* Static OG already exists in the HTML; this only verifies the optional six-question challenge. */
(() => {
  'use strict';
  const body = document.querySelector('[data-quiz-share-landing]'), C = window.RecordsQuizShareCore;
  if (!body || !C) return;
  const button = document.getElementById('quiz-share-challenge'), status = document.getElementById('quiz-share-status');
  if (!button || !status) return;
  const generic = C.ORIGIN + '/game/quiz/#play'; button.href = generic;
  const read = C.readSearch(location.search);
  if (!read.present) { status.textContent = '這張卡沒有附上完整六題，按下按鈕會開始新一輪。分數為玩家自行分享。'; return; }
  const parsed = C.parseChallenge(read.token);
  const total = body.dataset.total, correct = body.dataset.correct, quoteId = body.dataset.quoteId;
  let aliasMatches = true;
  if (Object.prototype.hasOwnProperty.call(body.dataset,'aliasPage')) {
    try { aliasMatches = body.dataset.aliasPage === 'v32' && location.pathname === C.aliasPath(quoteId,Number(correct),body.dataset.mode); } catch { aliasMatches = false; }
  }
  if (!parsed.ok || !aliasMatches || body.dataset.sourceVersion !== C.SOURCE_VERSION || total !== '6' || correct !== String(parsed.correct) || !['score','quote'].includes(body.dataset.mode) || !parsed.ids.includes(quoteId)) {
    status.textContent = '同輪挑戰資料已過期或不完整，未代入對方分數；仍可開始自己的新一輪。'; return;
  }
  status.textContent = '正在核對朋友的六題與資料版本…';
  (async () => {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(),8000);
    try {
      const response = await fetch(C.CATALOG_URL,{credentials:'omit',cache:'no-cache',referrerPolicy:'no-referrer',signal:controller.signal});
      if (!response.ok) throw new Error('unavailable'); const raw = await response.text(); if (raw.length > 350000) throw new Error('oversize');
      const catalog = C.catalog(JSON.parse(raw)), resolved = C.resolveChallenge(read.token,catalog.quotes,catalog.sourceVersion);
      if (!resolved.ok) throw new Error('invalid');
      button.href = C.challengeUrl(read.token); button.textContent = '挑戰同一輪六題 →';
      status.textContent = '六題與版本已核對。對方答對 ' + resolved.correct + '／6 題，成績由玩家自行分享；你的分數會重新計算。';
    } catch { status.textContent = '目前無法核對同輪題目，未代入對方分數。按下按鈕仍可開始新一輪。'; }
    finally { clearTimeout(timer); }
  })();
})();
