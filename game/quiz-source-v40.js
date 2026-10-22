/* Choose a pinned corpus before mounting; a v24 challenge never borrows the new source SHA. */
(function(global){
  'use strict';
  function selectVersion(search,legacyCore){
    if(!legacyCore || typeof legacyCore.readSearch!=='function')throw Error('legacy_core_unavailable');
    const read=legacyCore.readSearch(search);
    if(!read.present)return 'v40';
    if(read.ok===false || typeof read.token!=='string')throw Error('invalid_challenge');
    if(read.token.startsWith('24') || read.token.startsWith('v24~'))return 'v24';
    if(read.token.startsWith('40') || read.token.startsWith('v40~'))return 'v40';
    throw Error('unsupported_challenge_version');
  }
  function createDispatcher({legacyCore,currentCore,fetchImpl,defaultSearch=()=>''}){
    const pending=new Map();
    async function resolve(search=defaultSearch()){
      const version=selectVersion(search,legacyCore),legacy=version==='v24';
      const core=legacy?legacyCore:currentCore;
      if(!core || core.VERSION!==version || typeof core.readQuoteResponse!=='function')throw Error('quiz_core_unavailable');
      const sourceUrl=legacy?'/data/quotes.json':'/data/quotes-v40.json';
      const key=sourceUrl+'|'+core.SOURCE_VERSION;
      if(!pending.has(key))pending.set(key,(async()=>{
        if(typeof fetchImpl!=='function')throw Error('quiz_source_unavailable');
        const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
        try{
          const response=await fetchImpl(sourceUrl,{credentials:'omit',referrerPolicy:'no-referrer',cache:'no-cache',signal:controller.signal});
          const source=await core.readQuoteResponse(response);
          if(source.sourceVersion!==core.SOURCE_VERSION || source.data?.version!==version || !Array.isArray(source.data?.quotes))throw Error('quiz_source_mismatch');
          return Object.freeze({core,source,sourceUrl,legacy});
        }finally{clearTimeout(timer);}
      })().catch(error=>{pending.delete(key);throw error;}));
      return pending.get(key);
    }
    return Object.freeze({resolve});
  }
  if(typeof module==='object'&&module.exports)module.exports={selectVersion,createDispatcher};
  if(global)global.RecordsQuizSourceV40=createDispatcher({legacyCore:global.RecordsQuizShareCore,currentCore:global.RecordsQuizShareV40,
    fetchImpl:(...args)=>global.fetch(...args),defaultSearch:()=>global.location?.search||''});
})(typeof window==='undefined'?null:window);
