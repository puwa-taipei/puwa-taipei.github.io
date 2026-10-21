/* Shared by the home page and the standalone swipe game. */
(() => {
  'use strict';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const url=value=>/^https?:\/\//i.test(String(value||''))?String(value):null;
  const randomize=items=>{const out=[...items];for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;};
  const seenKey='record-quiz-seen-v1';
  const mounted=new WeakMap();
  function mount(root=document, options={}){
    if(mounted.has(root))return mounted.get(root);
    const $=id=>root.querySelector('#'+id),card=$('quiz-card');
    if(!card)return null;
    const text=(id,value)=>{if($(id))$(id).textContent=value;};
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    const state={quotes:Array.isArray(options.quotes)?options.quotes:[],period:$('game-period')?.value||'pre',round:[],index:0,correct:0,answered:false,seen:new Set(),drag:null,newCount:0};
    try{const stored=JSON.parse(localStorage.getItem(seenKey)||'[]');if(Array.isArray(stored))state.seen=new Set(stored.filter(id=>typeof id==='string'));}catch{}
    if(!card.parentElement.classList.contains('quiz-deck')){const deck=document.createElement('div');deck.className='quiz-deck';card.before(deck);deck.append(card);}
    card.setAttribute('aria-describedby','quiz-swipe-help');
    const help=document.createElement('p');help.id='quiz-swipe-help';help.className='quiz-swipe-help';help.innerHTML='<span>← 不是他</span><span>拖曳卡片，或按方向鍵</span><span>是他 →</span>';
    card.parentElement.after(help);
    $('quiz-no').innerHTML='<span aria-hidden="true">×</span><b>不是他</b><small>NO · ←</small>';
    $('quiz-yes').innerHTML='<span aria-hidden="true">✓</span><b>是他</b><small>YES · →</small>';
    $('quiz-no').setAttribute('aria-label','不是沈伯洋的原話，向左選');
    $('quiz-yes').setAttribute('aria-label','是沈伯洋的原話，向右選');
    const pool=()=>state.quotes.filter(q=>q.quizEligible!==false).filter(q=>{const date=String(q.eventDate||q.date).slice(0,10);return state.period==='all'||(state.period==='pre'?date<'2026-05-13':date>='2026-05-13');});
    const announce=message=>{const live=$('announcement')||document.getElementById('announcement');if(live)live.textContent=message;};
    function info(){
      const rows=pool(),seen=rows.filter(q=>state.seen.has(q.id)).length,period={pre:'正式提名前',post:'正式提名起',all:'所有時期'}[state.period];
      text('quiz-pool-count',rows.length);text('quiz-seen-count',seen+' / '+rows.length);
      text('game-period-note',`${period}：${rows.length} 段、${new Set(rows.map(q=>q.eventId||q.id)).size} 個事件／文章。正式提名切點 2026-05-13。`);
      text('quiz-round-note',state.newCount?`本輪 ${state.round.length} 題，${state.newCount} 題尚未看過。同一輪不重複事件。`:'題庫都看過了？換一個順序，再核對一次。');
      text('quote-selection',`本範圍精選 ${rows.length} 段本人公開言論／文章，答案均為「是」；這是有意挑選的原話遊戲。媒體引述、官方逐字稿與書面文章逐題標示，揭曉後可看來源。`);
    }
    function clearDrag(){
      state.drag=null;card.classList.remove('is-dragging','is-left','is-right');
      card.style.transform='';card.style.setProperty('--swipe-yes','0');card.style.setProperty('--swipe-no','0');
    }
    function render(){
      clearDrag();card.classList.remove('is-answered','answered-yes','answered-no','quiz-complete');card.dataset.decision='';
      state.answered=false;$('quiz-feedback').hidden=true;$('quiz-next').hidden=true;$('quiz-controls').hidden=false;
      const q=state.round[state.index];text('quiz-score',`${state.correct*10} / ${state.round.length*10} 分`);
      if(!q){
        card.classList.add('quiz-complete');card.dataset.questionId='';text('quiz-progress',state.round.length?'本輪完成':'尚未載入');
        text('quiz-meta',state.round.length?'ROUND COMPLETE':'SOURCE REQUIRED');text('quiz-context','');
        text('quiz-question',state.round.length?`你核對了 ${state.round.length} 段原話。\n答對 ${state.correct} 題！`:'題庫暫時無法讀取。\n請重新整理後再試。');
        card.querySelector('.quiz-foot').textContent=state.round.length?'再玩一輪，遇見下一批原話。':'每個答案都需要可追溯的來源。';
        $('quiz-controls').hidden=true;$('quiz-restart').hidden=!state.round.length;info();return;
      }
      state.seen.add(q.id);try{localStorage.setItem(seenKey,JSON.stringify([...state.seen].slice(-1200)));}catch{}
      card.dataset.questionId=q.id;card.dataset.eventId=q.eventId||q.id;
      text('quiz-progress',`${state.index+1} / ${state.round.length} 題`);
      text('quiz-meta',`${q.date} · ${q.medium==='written'?'書面文章':'口語發言'}`);
      text('quiz-context',q.frontContext||q.context||'回答後，展開場合、完整來源與上下文。');
      text('quiz-question',`「${q.quote}」\n這是沈伯洋${q.medium==='written'?'寫的':'說的'}嗎？`);
      card.querySelector('.quiz-foot').textContent='憑第一印象，滑出你的答案';info();
    }
    function drawRound(focus=false){
      const rows=pool(),previous=new Set(state.round.map(q=>q.id));
      // Shuffle within a small priority tier, so fresh rounds vary without burying edited highlights.
      const prioritized=items=>randomize(items).sort((a,b)=>{
        const tier=q=>Number.isFinite(Number(q.editorialRank))?Math.floor((Number(q.editorialRank)-1)/12):Number.isFinite(Number(q.quizPriority))?-Math.floor(Number(q.quizPriority)/10):999;
        return tier(a)-tier(b);
      });
      const candidates=[...prioritized(rows.filter(q=>!state.seen.has(q.id))),...prioritized(rows.filter(q=>state.seen.has(q.id)&&!previous.has(q.id))),...randomize(rows.filter(q=>state.seen.has(q.id)&&previous.has(q.id)))];
      const events=new Set(),chosen=[];
      for(const q of candidates){const event=q.eventId||q.id;if(events.has(event))continue;events.add(event);chosen.push(q);if(chosen.length===6)break;}
      state.newCount=chosen.filter(q=>!state.seen.has(q.id)).length;state.round=randomize(chosen);state.index=0;state.correct=0;$('quiz-restart').hidden=!chosen.length;render();
      if(focus)card.focus({preventScroll:true});
    }
    function answer(choice){
      const q=state.round[state.index];if(state.answered||!q)return;
      state.answered=true;clearDrag();const correct=choice===true;if(correct)state.correct++;
      card.classList.add('is-answered',choice?'answered-yes':'answered-no');card.dataset.decision=choice?'yes':'no';
      const feedback=$('quiz-feedback');feedback.hidden=false;feedback.classList.toggle('incorrect',!correct);
      const links=[];const primary=url(q.url||q.sourceURL),video=url(q.videoUrl),full=url(q.fullVideoUrl||q.fullMeetingVideoUrl);
      if(primary)links.push(`<a href="${esc(primary)}" target="_blank" rel="noopener noreferrer">讀原文與上下文 ↗</a>`);
      if(video)links.push(`<a href="${esc(video)}" target="_blank" rel="noopener noreferrer">${esc(q.videoLabel||'看官方發言影片')} ↗</a>`);
      if(full&&full!==video)links.push(`<a href="${esc(full)}" target="_blank" rel="noopener noreferrer">${esc(q.fullVideoLabel||'看完整會議影片')} ↗</a>`);
      const locator=q.evidenceLocator||q.timecode||'',limit=q.inferenceLimit||q.editorialLimit||q.cannotInfer||'';
      feedback.innerHTML=`<div class="quiz-reveal-label">原文揭曉</div><strong>${correct?'答對了。':'這句，確實出自他。'} 答案是「是」</strong><p>${esc(q.date)} · ${esc(q.venue||'公開發言')} · ${esc(q.context||'')}</p><p class="quiz-source-type">${esc(q.sourceType||'來源類型請見原始連結')}</p>${locator?`<p class="quiz-locator"><b>影片／原文位置</b><br>${esc(locator)}</p>`:''}<div class="quiz-source-actions">${links.join('')}</div>${limit?`<details class="quiz-evidence-detail"><summary>查看證據範圍</summary><p>${esc(limit)}</p></details>`:''}`;
      text('quiz-score',`${state.correct*10} / ${state.round.length*10} 分`);$('quiz-controls').hidden=true;$('quiz-next').hidden=false;
      text('quiz-next',state.index===state.round.length-1?'看本輪結果 →':'下一張原話 →');
      announce(`${correct?'答對':'再看一次原話'}。答案是「是」。${q.date}，${q.quote}`);
    }
    $('quiz-no').addEventListener('click',()=>answer(false));$('quiz-yes').addEventListener('click',()=>answer(true));
    $('quiz-next').addEventListener('click',()=>{state.index++;render();card.focus({preventScroll:true});});
    $('quiz-restart').addEventListener('click',()=>drawRound(true));
    $('game-period')?.addEventListener('change',e=>{state.period=e.target.value;drawRound();});
    card.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','a','A','d','D'].includes(e.key)){e.preventDefault();answer(['ArrowRight','d','D'].includes(e.key));}});
    card.addEventListener('pointerdown',e=>{
      if(state.answered||!state.round[state.index]||!e.isPrimary||(e.pointerType==='mouse'&&e.button!==0)||e.target.closest('a,button,input,select,details'))return;
      state.drag={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastAt:performance.now(),velocity:0,locked:false};
    });
    card.addEventListener('pointermove',e=>{
      const d=state.drag;if(!d||d.id!==e.pointerId)return;
      const dx=e.clientX-d.x,dy=e.clientY-d.y;
      if(!d.locked){
        if(Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)*1.15){clearDrag();return;}
        if(Math.abs(dx)<9||Math.abs(dx)<Math.abs(dy)*1.15)return;
        d.locked=true;card.classList.add('is-dragging');try{card.setPointerCapture(e.pointerId);}catch{}
      }
      if(e.cancelable)e.preventDefault();
      const now=performance.now();d.velocity=(e.clientX-d.lastX)/Math.max(1,now-d.lastAt);d.lastX=e.clientX;d.lastAt=now;
      const threshold=Math.min(125,Math.max(68,card.offsetWidth*.22)),progress=Math.min(1,Math.abs(dx)/threshold);
      card.style.setProperty('--swipe-yes',String(dx>0?progress:0));card.style.setProperty('--swipe-no',String(dx<0?progress:0));
      card.classList.toggle('is-right',dx>0);card.classList.toggle('is-left',dx<0);
      if(!reduced.matches)card.style.transform=`translate(${Math.max(-240,Math.min(240,dx*.88))}px, ${Math.min(18,Math.abs(dx)*.035)}px) rotate(${Math.max(-13,Math.min(13,dx/19))}deg)`;
    },{passive:false});
    card.addEventListener('pointerup',e=>{
      const d=state.drag;if(!d||d.id!==e.pointerId)return;
      const dx=e.clientX-d.x,threshold=Math.min(125,Math.max(68,card.offsetWidth*.22));
      const commit=d.locked&&(Math.abs(dx)>=threshold||(Math.abs(dx)>42&&Math.abs(d.velocity)>.65&&Math.sign(d.velocity)===Math.sign(dx)));
      clearDrag();if(card.hasPointerCapture(e.pointerId))card.releasePointerCapture(e.pointerId);
      if(commit)answer(dx>0);
    });
    card.addEventListener('pointercancel',clearDrag);card.addEventListener('lostpointercapture',()=>{if(state.drag)clearDrag();});
    window.addEventListener('blur',clearDrag);
    const api={setQuotes(quotes){state.quotes=Array.isArray(quotes)?quotes:[];drawRound();},reset(){drawRound();}};mounted.set(root,api);drawRound();return api;
  }
  window.RecordsQuiz={mount};
  if(document.querySelector('[data-standalone-quiz]')){
    fetch('/data/quotes.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error('quotes '+r.status);return r.json();}).then(data=>mount(document,{quotes:data.quotes})).catch(()=>{const q=document.getElementById('quiz-question');if(q)q.textContent='題庫暫時無法讀取，請重新整理後再試。';});
  }
})();
