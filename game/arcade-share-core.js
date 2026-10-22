/* Compact public score references and local, self-reported score links. No network or identity verification. */
(function(global){
  'use strict';
  const ORIGIN='https://puwa.taipei',PATH='/game/share/';
  const cleanName=value=>[...String(value??'').normalize('NFKC').replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,'').replace(/\s+/g,' ').trim()].slice(0,16).join('');
  const validName=value=>typeof value==='string'&&[...value].length>=2&&[...value].length<=16&&!/[<>\u200b\u200e\u200f\ud800-\udfff]/u.test(value);
  const integer=(v,max)=>Number.isInteger(v)&&v>=0&&v<=max;
  const validLocal=(score,combo)=>integer(score,200000)&&score%100===0&&integer(combo,400);
  const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  function pack(bytes){return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
  function unpack(text){if(typeof text!=='string'||text.length>96||!/^[A-Za-z0-9_-]+$/.test(text))throw new Error('invalid_token');const bytes=Uint8Array.from(atob(text.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-text.length%4)%4)),c=>c.charCodeAt(0));if(pack(bytes)!==text)throw new Error('noncanonical_token');return bytes;}
  function packId(id){if(!uuid.test(id||''))throw new Error('invalid_id');return pack(Uint8Array.from(id.replace(/-/g,'').match(/../g),hex=>parseInt(hex,16)));}
  function unpackId(token){const bytes=unpack(token);if(bytes.length!==16)throw new Error('invalid_id');const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);}
  // Detect accidental edits only; a local score remains a player's own claim.
  function check(text){let value=17;for(const ch of text)value=(value*31+ch.charCodeAt(0))%1296;return value.toString(36).padStart(2,'0');}
  function packLocal(name,score,combo){name=cleanName(name);if(!validName(name)||!validLocal(score,combo))throw new Error('invalid_local_score');const body=['2',score.toString(36),combo.toString(36),pack(new TextEncoder().encode(name))].join('.');return body+'.'+check(body);}
  function unpackLocal(token){if(typeof token!=='string'||token.length>110)throw new Error('invalid_local_score');const p=token.split('.');if(p.length!==5||p[0]!=='2'||!p.slice(1,3).every(v=>/^(0|[1-9a-z][0-9a-z]{0,3})$/.test(v))||check(p.slice(0,4).join('.'))!==p[4])throw new Error('invalid_local_score');const name=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(unpack(p[3])),score=parseInt(p[1],36),maxCombo=parseInt(p[2],36);if(name!==cleanName(name)||!validName(name)||!validLocal(score,maxCombo))throw new Error('invalid_local_score');return {kind:'local',nickname:name,score,maxCombo};}
  function readSearch(search){
    try{
      if(typeof search!=='string'||search.length>512)throw new Error('invalid_search');
      const p=new URLSearchParams(search),keys=['r','s','id','name','score','combo'];
      if(keys.some(k=>p.getAll(k).length>1))throw new Error('ambiguous_search');
      const forms=Number(p.has('r'))+Number(p.has('s'))+Number(p.has('id'))+Number(['name','score','combo'].some(k=>p.has(k)));
      if(forms!==1)throw new Error('invalid_search');
      if(p.has('r'))return {kind:'registered',id:unpackId(p.get('r'))};
      if(p.has('id')){const id=p.get('id');if(!uuid.test(id))throw new Error('invalid_id');return {kind:'registered',id:id.toLowerCase()};}
      if(p.has('s'))return unpackLocal(p.get('s'));
      const rawName=p.get('name')||'',rawScore=p.get('score')||'',rawCombo=p.get('combo')||'';
      if(rawName.length>64||!/^\d{1,6}$/.test(rawScore)||!/^\d{1,3}$/.test(rawCombo))throw new Error('invalid_local_score');
      const nickname=cleanName(rawName),score=Number(rawScore),maxCombo=Number(rawCombo);
      if(!validName(nickname)||!validLocal(score,maxCombo))throw new Error('invalid_local_score');return {kind:'local',nickname,score,maxCombo};
    }catch{return {kind:'invalid'};}
  }
  function shareUrl(value){const url=new URL(PATH,ORIGIN);if(value?.id)url.searchParams.set('r',packId(value.id));else url.searchParams.set('s',packLocal(value?.nickname,value?.score,value?.maxCombo));return url.href;}
  const api={ORIGIN,PATH,cleanName,validName,packId,unpackId,packLocal,unpackLocal,readSearch,shareUrl};
  if(typeof module==='object'&&module.exports)module.exports=api;if(global)global.RecordsArcadeShare=api;
})(typeof window==='undefined'?null:window);
