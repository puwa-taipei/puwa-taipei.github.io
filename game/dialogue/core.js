/* Deterministic source-matching rounds. No identity, leaderboard or personality inference. */
(function (global) {
  'use strict';
  const VERSION = 'v30', ROUND_SIZE = 6;
  const SEED = /^[a-f0-9]{12}$/;
  const WITHDRAWN = new Set(['legislature-hypocrite-152732']);
  function seed(value) { return typeof value === 'string' && SEED.test(value.toLowerCase()) ? value.toLowerCase() : null; }
  function rng(value) {
    let hash = 2166136261;
    for (const letter of value) { hash ^= letter.charCodeAt(0); hash = Math.imul(hash, 16777619); }
    return () => { hash += 0x6D2B79F5; let n = hash; n = Math.imul(n ^ n >>> 15, n | 1); n ^= n + Math.imul(n ^ n >>> 7, n | 61); return ((n ^ n >>> 14) >>> 0) / 4294967296; };
  }
  function shuffle(values, random) {
    const copy = [...values];
    for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [copy[i],copy[j]] = [copy[j],copy[i]]; }
    return copy;
  }
  function validate(data, source) {
    if (!data || data.version !== VERSION || data.roundSize !== ROUND_SIZE || !Array.isArray(data.scenarios) || data.scenarios.length < ROUND_SIZE || data.scenarios.length > 100 || !source || source.version !== data.sourceVersion || !Array.isArray(source.quotes)) throw new Error('invalid_source');
    const quotes = new Map(source.quotes.map(q => [q.id,q])), ids = new Set(), targets = new Set();
    const rows = data.scenarios.map(row => {
      const q = quotes.get(row.targetId);
      if (!row || !/^[a-z0-9-]{1,60}$/.test(row.id || '') || ids.has(row.id) || targets.has(row.targetId) || WITHDRAWN.has(row.targetId) || !q || q.speaker !== '沈伯洋' || q.medium !== 'spoken' || !q.quote || !q.url || !q.context || !q.sourceType || !q.eventId || ['topic','speaker','prompt','cue'].some(key => typeof row[key] !== 'string' || !row[key].trim() || row[key].length > 600)) throw new Error('invalid_scenario');
      ids.add(row.id); targets.add(row.targetId); return {...row,quote:q};
    });
    if (new Set(rows.map(row => row.quote.eventId)).size < ROUND_SIZE) throw new Error('insufficient_events');
    return rows;
  }
  function makeRound(data, source, value) {
    const key = seed(value); if (!key) throw new Error('invalid_seed');
    const rows = validate(data,source), random = rng(key), events = new Set(), picked = [];
    for (const row of shuffle(rows,random)) {
      if (events.has(row.quote.eventId)) continue;
      events.add(row.quote.eventId); picked.push(row); if (picked.length === ROUND_SIZE) break;
    }
    return picked.map(row => {
      const distractors = shuffle(rows.filter(other => other.quote.eventId !== row.quote.eventId),random).slice(0,2);
      return {...row,choices:shuffle([row.quote,...distractors.map(other => other.quote)],random)};
    });
  }
  function score(answers) {
    if (!Array.isArray(answers) || answers.length > ROUND_SIZE || answers.some(answer => !answer || typeof answer.correct !== 'boolean')) throw new Error('invalid_answers');
    const correct = answers.filter(answer => answer.correct).length, total = answers.length;
    return {correct,total,percent:total ? Math.round(correct / total * 100) : 0};
  }
  function session(round) {
    if (!Array.isArray(round) || round.length !== ROUND_SIZE || round.some(row => !row.choices?.some(q => q.id === row.targetId))) throw new Error('invalid_round');
    let index = 0, phase = 'question'; const answers = [];
    return {
      state: () => ({index,phase,total:round.length,answers:answers.map(answer => ({...answer})),score:score(answers)}),
      current: () => round[index],
      choose(id) {
        if (phase !== 'question') throw new Error('already_answered');
        const row = round[index]; if (!row.choices.some(q => q.id === id)) throw new Error('invalid_choice');
        const answer = {scenarioId:row.id,chosenId:id,targetId:row.targetId,correct:id === row.targetId};
        answers.push(answer); phase = 'feedback'; return {...answer};
      },
      next() {
        if (phase !== 'feedback') throw new Error('answer_first');
        if (index + 1 === round.length) { phase = 'result'; return false; }
        index++; phase = 'question'; return true;
      }
    };
  }
  function challengeUrl(value) { const key = seed(value); if (!key) throw new Error('invalid_seed'); return 'https://puwa.taipei/game/dialogue/?round=' + key; }
  function localChallengeUrl(currentHref,value) {
    const key = seed(value); if (!key) throw new Error('invalid_seed');
    const local = new URL(currentHref); if (!['http:','https:'].includes(local.protocol)) throw new Error('invalid_location');
    local.search = ''; local.searchParams.set('round',key); local.hash = ''; return local.href;
  }
  const api = {VERSION,ROUND_SIZE,seed,rng,shuffle,validate,makeRound,score,session,challengeUrl,localChallengeUrl};
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (global) global.RecordsDialogue = api;
})(typeof window === 'undefined' ? null : window);
