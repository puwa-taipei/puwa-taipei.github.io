/* Bounded, source-versioned quiz challenges. No identities, answers or server scores. */
(function (global) {
  'use strict';
  const VERSION = 'v18', SUBJECT = 'shen-pao-yang', ROUND_SIZE = 6;
  const SOURCE_VERSION = 'abdfd121cab3484d8e2bb7328691e61371eb0f2772a327b5ffcd9b73bd1a5f6b';
  const ORIGIN = 'https://puwa-taipei.github.io', CARD_BASE = '/game/quiz/cards/v18/';
  const CATALOG_URL = '/data/quiz-share-catalog-v18.json', NOMINATION = '2026-05-13';
  const ID = /^[a-z0-9-]{1,100}$/, PERIODS = new Set(['pre','post','all']), MODES = new Set(['score','quote']);
  const own = (value,key) => Object.prototype.hasOwnProperty.call(value,key);
  const error = reason => ({ok:false,reason});
  function dateValue(q) {
    const raw = String(q?.eventDate || q?.date || '');
    const full = raw.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
    if (full && Number.isFinite(Date.parse(full)) && new Date(full).toISOString().slice(0,10) === full) return full;
    const year = raw.match(/^\d{4}/)?.[0];
    return year || null;
  }
  function inPeriod(q,period) {
    if (!PERIODS.has(period)) return false;
    if (period === 'all') return true;
    const date = dateValue(q); if (!date) return false;
    // A year-only record in the nomination year cannot establish either side.
    if (date.length === 4 && date === NOMINATION.slice(0,4)) return false;
    return period === 'pre' ? date < NOMINATION : date >= NOMINATION;
  }
  function readSearch(search) {
    if (typeof search !== 'string' || search.length > 4096) return {present:true,...error('invalid_challenge')};
    const values = new URLSearchParams(search).getAll('challenge');
    if (!values.length) return {present:false};
    return values.length === 1 ? {present:true,token:values[0]} : {present:true,...error('invalid_challenge')};
  }
  function parseChallenge(token,sourceVersion = SOURCE_VERSION) {
    if (typeof token !== 'string' || token.length > 1200 || !/^[a-z0-9~,\-]+$/.test(token)) return error('invalid_challenge');
    const parts = token.split('~');
    if (parts.length !== 5 || parts[0] !== VERSION || !/^[a-f0-9]{64}$/.test(parts[1])) return error('invalid_challenge');
    if (parts[1] !== sourceVersion || sourceVersion !== SOURCE_VERSION) return error('stale_source');
    const [,,period,count,joined] = parts, ids = joined.split(',');
    if (!PERIODS.has(period) || !/^[0-6]$/.test(count) || ids.length !== ROUND_SIZE || ids.some(id => !ID.test(id)) || new Set(ids).size !== ROUND_SIZE) return error('invalid_challenge');
    return {ok:true,token,sourceVersion,period,correct:Number(count),total:ROUND_SIZE,ids};
  }
  function resolveChallenge(token,quotes,sourceVersion) {
    if (sourceVersion !== SOURCE_VERSION) return error('source_unverified');
    const parsed = parseChallenge(token,sourceVersion); if (!parsed.ok) return parsed;
    if (!Array.isArray(quotes)) return error('unavailable_question');
    const index = new Map();
    for (const q of quotes) {
      if (!q || q.quizEligible === false || !ID.test(q.id || '')) continue;
      if (index.has(q.id)) return error('unavailable_question');
      index.set(q.id,q);
    }
    const round = parsed.ids.map(id => index.get(id));
    if (round.some(q => !q)) return error('unavailable_question');
    if (new Set(round.map(q => q.eventId || q.id)).size !== ROUND_SIZE) return error('duplicate_event');
    if (round.some(q => !inPeriod(q,parsed.period))) return error('invalid_period');
    return {...parsed,round,score:Math.round(parsed.correct / ROUND_SIZE * 100)};
  }
  function encodeChallenge(ids,period,correct,sourceVersion = SOURCE_VERSION) {
    const token = [VERSION,sourceVersion,period,correct,Array.isArray(ids) ? ids.join(',') : ''].join('~');
    const parsed = parseChallenge(token,sourceVersion);
    if (!parsed.ok) throw new Error(parsed.reason);
    return token;
  }
  function https(value) {
    if (typeof value !== 'string' || value.length > 2048) return null;
    try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : null; } catch { return null; }
  }
  function catalog(value) {
    if (!value || value.version !== VERSION || value.subjectId !== SUBJECT || value.sourceVersion !== SOURCE_VERSION || value.roundSize !== ROUND_SIZE || value.cardBase !== CARD_BASE || value.cards !== 1036 || !Array.isArray(value.modes) || value.modes.length !== 2 || !value.modes.every(mode => MODES.has(mode)) || new Set(value.modes).size !== 2 || !Array.isArray(value.quotes) || value.quotes.length !== 74) throw new Error('invalid_share_catalog');
    const ids = new Set(), quotes = [];
    for (const q of value.quotes) {
      if (!q || !ID.test(q.id || '') || ids.has(q.id) || typeof q.eventId !== 'string' || !q.eventId || typeof q.quote !== 'string' || !q.quote || q.quote.length > 600 || typeof q.date !== 'string' || !dateValue(q) || !['spoken','written'].includes(q.medium) || typeof q.context !== 'string' || !q.context || typeof q.sourceType !== 'string' || !q.sourceType || !https(q.sourceUrl)) throw new Error('invalid_share_catalog');
      ids.add(q.id); quotes.push(Object.freeze({...q,sourceUrl:https(q.sourceUrl)}));
    }
    return Object.freeze({...value,quotes:Object.freeze(quotes)});
  }
  function result(snapshot) {
    if (!snapshot || snapshot.phase !== 'results' || !Array.isArray(snapshot.round) || snapshot.round.length !== ROUND_SIZE || !Array.isArray(snapshot.answers) || snapshot.answers.length !== ROUND_SIZE) throw new Error('incomplete_round');
    const ids = snapshot.round.map(q => q?.id);
    if (ids.some(id => !ID.test(id || '')) || new Set(ids).size !== ROUND_SIZE || new Set(snapshot.round.map(q => q.eventId || q.id)).size !== ROUND_SIZE) throw new Error('invalid_round');
    if (snapshot.answers.some((a,i) => a?.question?.id !== ids[i] || typeof a.choice !== 'boolean' || a.answer !== true || a.correct !== a.choice)) throw new Error('invalid_answers');
    const correct = snapshot.answers.filter(a => a.choice).length, score = Math.round(correct / ROUND_SIZE * 100);
    if (snapshot.correct !== correct || snapshot.score !== score) throw new Error('invalid_score');
    return {ids,correct,total:ROUND_SIZE,score};
  }
  function selectQuote(snapshot) {
    result(snapshot);
    const quality = q => q.verificationLevel === 'official-transcript-fulltext' ? 0 : /官方.*逐字稿/.test(q.sourceType || '') ? 1 : q.medium === 'written' ? 2 : 3;
    return [...snapshot.answers].sort((a,b) => Number(a.correct) - Number(b.correct) || quality(a.question) - quality(b.question) || [...a.question.quote].length - [...b.question.quote].length || (Number(a.question.editorialRank) || 999) - (Number(b.question.editorialRank) || 999) || a.question.id.localeCompare(b.question.id))[0].question;
  }
  function sourceLabel(q) {
    if (q.medium === 'written') return '本人書面文字';
    if (/媒體|報導|media/.test(String(q.sourceType || '') + ' ' + String(q.verificationLevel || '')) && !/官方.*逐字稿/.test(q.sourceType || '')) return '媒體直接引述，未另核原聲';
    return '口語發言，來源與語境見原文';
  }
  function cardPath(id,correct,mode,extension = 'html') {
    if (!ID.test(id || '') || !Number.isInteger(correct) || correct < 0 || correct > ROUND_SIZE || !MODES.has(mode) || !['html','png'].includes(extension)) throw new Error('invalid_card');
    return CARD_BASE + id + '-' + correct + '-6-' + mode + '.' + extension;
  }
  function buildShare(snapshot,period,sourceCatalog,quoteSourceVersion) {
    if (quoteSourceVersion !== SOURCE_VERSION) throw new Error('source_unverified');
    const outcome = result(snapshot), c = catalog(sourceCatalog);
    const challenge = encodeChallenge(outcome.ids,period,outcome.correct,c.sourceVersion);
    const resolved = resolveChallenge(challenge,snapshot.round,c.sourceVersion); if (!resolved.ok) throw new Error(resolved.reason);
    const originals = new Map(snapshot.round.map(q => [q.id,q])), published = new Map(c.quotes.map(q => [q.id,q]));
    for (const id of outcome.ids) {
      const q = originals.get(id), p = published.get(id);
      if (!p || p.quote !== q.quote || p.date !== q.date || p.medium !== q.medium || p.eventId !== (q.eventId || q.id)) throw new Error('source_mismatch');
    }
    const chosen = selectQuote(snapshot), quote = published.get(chosen.id);
    return Object.freeze({...outcome,period,challenge,quote,sourceLabel:sourceLabel({...quote,verificationLevel:chosen.verificationLevel}),sourceVersion:c.sourceVersion,mode:outcome.score >= 80 ? 'score' : 'quote'});
  }
  function shareUrl(model,mode = model.mode) {
    const u = new URL(cardPath(model.quote.id,model.correct,mode),ORIGIN);
    u.searchParams.set('challenge',model.challenge); return u.href;
  }
  function imageUrl(model,mode = model.mode) { return new URL(cardPath(model.quote.id,model.correct,mode,'png'),ORIGIN).href; }
  function challengeUrl(token) { const u = new URL('/game/quiz/',ORIGIN); u.searchParams.set('challenge',token); u.hash = 'play'; return u.href; }
  function challengeComparison(correct,challenge) {
    if (!challenge || !challenge.ok || !Number.isInteger(correct) || correct < 0 || correct > ROUND_SIZE) return '';
    const gap = correct - challenge.correct;
    return `你答對 ${correct}／6 題；朋友連結標示 ${challenge.correct}／6 題（自行分享）。${gap > 0 ? '這輪你多認出 ' + gap + ' 題。' : gap < 0 ? '這輪少認出 ' + -gap + ' 題，可以回頭看原文。' : '這輪認出的題數相同。'}`;
  }
  async function readQuoteResponse(response) {
    if (!response?.ok) throw new Error('quotes_unavailable');
    const bytes = await response.arrayBuffer(); if (bytes.byteLength > 2000000) throw new Error('quotes_oversize');
    const data = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
    let sourceVersion = null;
    try { if (globalThis.crypto?.subtle) sourceVersion = [...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes))].map(byte => byte.toString(16).padStart(2,'0')).join(''); } catch {}
    return {data,sourceVersion};
  }
  const api = {VERSION,SUBJECT,ROUND_SIZE,SOURCE_VERSION,ORIGIN,CARD_BASE,CATALOG_URL,readSearch,parseChallenge,resolveChallenge,encodeChallenge,inPeriod,catalog,result,selectQuote,sourceLabel,cardPath,buildShare,shareUrl,imageUrl,challengeUrl,challengeComparison,readQuoteResponse};
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (global) global.RecordsQuizShareCore = api;
})(typeof window === 'undefined' ? null : window);
