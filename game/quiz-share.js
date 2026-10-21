/* Optional Shen quiz sharing. A failed catalogue/card never interrupts the game. */
(() => {
  'use strict';
  const C = window.RecordsQuizShareCore; if (!C) return;
  const node = (tag,cls,text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  let pendingCatalog = null;
  async function loadCatalog() {
    if (!pendingCatalog) pendingCatalog = (async () => {
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(),8000);
      try {
        const r = await fetch(C.CATALOG_URL,{credentials:'omit',cache:'no-cache',referrerPolicy:'no-referrer',signal:controller.signal});
        if (!r.ok) throw new Error('share_catalog_unavailable');
        const raw = await r.text(); if (raw.length > 350000) throw new Error('share_catalog_oversize');
        return C.catalog(JSON.parse(raw));
      } finally { clearTimeout(timer); }
    })().catch(error => { pendingCatalog = null; throw error; });
    return pendingCatalog;
  }
  function mount({profile,results}) {
    if (profile?.subjectId !== C.SUBJECT || !results?.parentElement) return null;
    const host = node('section','quiz-share-panel'); host.hidden = true; host.setAttribute('aria-label','分享這輪，挑戰朋友');
    const heading = node('div','quiz-share-heading'), headingText = node('div');
    headingText.append(node('p','quiz-share-eyebrow','SAME SIX / CHALLENGE A FRIEND'),node('h3','','這六句，朋友認得幾句？'),node('p','quiz-share-intro','已自動挑好一張卡。直接分享，朋友就能挑戰同一輪六題。'));
    heading.append(headingText); host.append(heading);
    const compare = node('p','quiz-share-comparison'); compare.hidden = true; host.append(compare);
    const cards = node('div','quiz-share-cards'); cards.setAttribute('role','group'); cards.setAttribute('aria-label','分享卡面'); host.append(cards);
    const choices = new Map();
    for (const [mode,label,note] of [['score','分數為主','用成績下戰帖'],['quote','原話為主','這一句，你猜得到嗎？']]) {
      const button = node('button','quiz-share-card-choice'); button.type = 'button'; button.dataset.mode = mode; button.setAttribute('aria-pressed','false');
      const img = node('img'); img.width = 1200; img.height = 630; img.loading = 'lazy'; img.alt = label + '分享卡預覽';
      const copy = node('span','quiz-share-card-label'); copy.append(node('b','',label),node('small','',note));
      button.append(img,copy); cards.append(button); choices.set(mode,{button,img,ready:false});
    }
    const fact = node('p','quiz-share-fact'), source = node('a','quiz-share-source'); source.target = '_blank'; source.rel = 'noopener noreferrer'; source.referrerPolicy = 'no-referrer';
    host.append(fact,source);
    const actions = node('div','quiz-share-actions'), primary = node('button','quiz-share-primary','分享這輪，挑戰朋友 ↗'); primary.type = 'button';
    const copy = node('button','quiz-share-copy','複製挑戰連結'),download = node('button','quiz-share-download','下載卡片圖片'); copy.type = download.type = 'button';
    actions.append(primary,copy,download); host.append(actions);
    const status = node('p','quiz-share-status'); status.setAttribute('role','status'); status.setAttribute('aria-live','polite'); host.append(status);
    const fallback = node('input','quiz-share-link-fallback'); fallback.type = 'text'; fallback.readOnly = true; fallback.hidden = true; fallback.setAttribute('aria-label','可手動複製的挑戰連結'); host.append(fallback);
    const retry = node('button','quiz-share-retry','重新讀取分享卡'); retry.type = 'button'; retry.hidden = true; host.append(retry);
    host.append(node('p','quiz-share-privacy','分享的是這輪原話辨識成績，不是公開排行榜。成績由玩家自行分享，無須填姓名或聯絡方式；只有按下分享，才會交給你選擇的服務。'));
    results.before(host);
    let generation = 0, model = null, mode = null, saved = null;
    function updateButtons() {
      const ready = Boolean(model && choices.get(mode)?.ready);
      primary.disabled = copy.disabled = download.disabled = !ready;
      for (const [key,choice] of choices) { choice.button.disabled = !model; choice.button.setAttribute('aria-pressed',String(key === mode)); }
    }
    function select(next) {
      if (!model || !choices.has(next)) return; mode = next; fallback.hidden = true; updateButtons();
      status.textContent = choices.get(mode).ready ? `已選「${mode === 'score' ? '分數為主' : '原話為主'}」。分享連結的預覽會使用這張卡。` : '正在讀取這張分享卡…';
    }
    for (const [key,choice] of choices) choice.button.addEventListener('click',() => select(key));
    function clear() {
      generation++; model = null; saved = null; mode = null; host.hidden = true; retry.hidden = true; fallback.hidden = true; compare.hidden = true;
      for (const choice of choices.values()) { choice.ready = false; choice.img.removeAttribute('src'); choice.img.onload = choice.img.onerror = null; }
      updateButtons();
    }
    async function show(snapshot,context) {
      clear(); saved = {snapshot,context}; host.hidden = false; const ticket = generation;
      cards.hidden = true; fact.textContent = ''; source.hidden = true; status.textContent = '正在準備這輪分享卡，遊戲與逐題原文仍可照常閱讀。';
      compare.textContent = C.challengeComparison(snapshot.correct,context.challenge); compare.hidden = !compare.textContent;
      try {
        const catalog = await loadCatalog(); if (ticket !== generation) return;
        model = C.buildShare(snapshot,context.period,catalog,context.sourceVersion); mode = model.mode; cards.hidden = false;
        fact.textContent = `${model.quote.date} · ${model.sourceLabel}。${model.quote.frontContext || model.quote.context}`;
        source.href = model.quote.sourceUrl; source.textContent = '分享這一句之前，也可以先讀完整來源 ↗'; source.hidden = false;
        for (const [key,choice] of choices) {
          choice.img.onload = () => { if (ticket !== generation) return; choice.ready = true; updateButtons(); if (key === mode) status.textContent = '分享卡已準備好。朋友點開後，可挑戰同一輪六題。'; };
          choice.img.onerror = () => { if (ticket !== generation) return; choice.ready = false; updateButtons(); if (key === mode) status.textContent = '這張分享卡暫時無法讀取，尚未產生可用分享。請稍後重試；遊戲與原文不受影響。'; retry.hidden = false; };
          const publicPath = C.cardPath(model.quote.id,model.correct,key,'png');
          choice.img.src = ['localhost','127.0.0.1'].includes(location.hostname) ? new URL(publicPath,location.origin).href : C.imageUrl(model,key);
        }
        updateButtons();
      } catch {
        if (ticket !== generation) return;
        model = null; updateButtons(); retry.hidden = false; status.textContent = '分享卡暫時無法準備，請稍後重試。本輪原文與再玩功能仍可使用。';
      }
    }
    retry.addEventListener('click',() => { if (saved) show(saved.snapshot,saved.context); });
    async function copyLink() {
      if (!model || !choices.get(mode)?.ready) return;
      const link = C.shareUrl(model,mode), ticket = generation;
      try { await navigator.clipboard.writeText(link); if (ticket !== generation) return; fallback.hidden = true; status.textContent = '挑戰連結已複製。貼給朋友，預覽會帶出你選的卡面。'; }
      catch { if (ticket !== generation) return; fallback.value = link; fallback.hidden = false; fallback.focus(); fallback.select(); status.textContent = '無法自動複製，請複製下方連結。'; }
    }
    copy.addEventListener('click',copyLink);
    primary.addEventListener('click',async () => {
      if (!model || !choices.get(mode)?.ready) return;
      const ticket = generation, link = C.shareUrl(model,mode), q = model.quote;
      if (!navigator.share) { await copyLink(); return; }
      const title = '這是沈伯洋說的嗎？｜' + model.score + ' 分';
      const text = mode === 'score' ? `我認出 ${model.correct}／6 句，得到 ${model.score} 分。換你挑戰同一輪！` : `「${q.quote}」你猜是他${q.medium === 'written' ? '寫' : '說'}的嗎？我答對 ${model.correct}／6 題，換你挑戰同一輪。`;
      try { await navigator.share({title,text,url:link}); if (ticket === generation) status.textContent = '裝置分享操作已完成。朋友可從連結進入同一輪挑戰。'; }
      catch (error) { if (ticket !== generation) return; status.textContent = error?.name === 'AbortError' ? '已取消分享，沒有自動複製或下載。' : '裝置沒有完成分享。可改用「複製挑戰連結」或下載卡片圖片。'; }
    });
    download.addEventListener('click',() => {
      if (!model || !choices.get(mode)?.ready) return;
      const a = node('a'); a.href = C.imageUrl(model,mode); a.download = `shen-quiz-${model.correct}-6-${mode}.png`; a.rel = 'noopener'; a.referrerPolicy = 'no-referrer'; document.body.append(a); a.click(); a.remove();
      status.textContent = '已開啟卡片圖片下載；若瀏覽器直接顯示圖片，可另存圖片。挑戰連結可另外複製。';
    });
    updateButtons(); return {show,clear};
  }
  window.RecordsQuizShare = {mount};
})();
