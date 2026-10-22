/* Resolve independent, pinned v24/v40/v41 sources before mounting a quiz. */
(function(global){
  'use strict';
  function selectVersion(search,legacyCore){
    if(!legacyCore || typeof legacyCore.readSearch!=='function')throw Error('legacy_core_unavailable');
    const read=legacyCore.readSearch(search);
    if(!read.present)return 'v41';
    if(read.ok===false || typeof read.token!=='string')throw Error('invalid_challenge');
    for(const version of ['24','40','41'])if(read.token.startsWith(version)||read.token.startsWith('v'+version+'~'))return 'v'+version;
    throw Error('unsupported_challenge_version');
  }
  function createDispatcher({legacyCore,previousCore,currentCore,fetchImpl,defaultSearch=()=>''}){
    const pending=new Map(), cores={v24:legacyCore,v40:previousCore,v41:currentCore};
    const urls={v24:'/data/quotes.json',v40:'/data/quotes-v40.json',v41:'/data/quotes-v41.json'};
    async function resolve(search=defaultSearch()){
      const version=selectVersion(search,legacyCore),core=cores[version],sourceUrl=urls[version];
      if(!core || core.VERSION!==version || typeof core.readQuoteResponse!=='function')throw Error('quiz_core_unavailable');
      const key=sourceUrl+'|'+core.SOURCE_VERSION;
      if(!pending.has(key))pending.set(key,(async()=>{
        if(typeof fetchImpl!=='function')throw Error('quiz_source_unavailable');
        const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
        try{
          const response=await fetchImpl(sourceUrl,{credentials:'omit',referrerPolicy:'no-referrer',cache:'no-cache',signal:controller.signal});
          const source=await core.readQuoteResponse(response);
          if(source.sourceVersion!==core.SOURCE_VERSION || source.data?.version!==version || !Array.isArray(source.data?.quotes))throw Error('quiz_source_mismatch');
          return Object.freeze({core,source,sourceUrl,legacy:version!=='v41'});
        }finally{clearTimeout(timer);}
      })().catch(error=>{pending.delete(key);throw error;}));
      return pending.get(key);
    }
    return Object.freeze({resolve});
  }
  if(typeof module==='object'&&module.exports)module.exports={selectVersion,createDispatcher};
  if(global)global.RecordsQuizSourceV41=createDispatcher({legacyCore:global.RecordsQuizShareCore,previousCore:global.RecordsQuizShareV40,currentCore:global.RecordsQuizShareV41,
    fetchImpl:(...args)=>global.fetch(...args),defaultSearch:()=>global.location?.search||''});
})(typeof window==='undefined'?null:window);
