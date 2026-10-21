/* Public anonymous API client. Start tokens and full traces stay in memory. */
(() => {
  'use strict';
  const VERSION='red-notes-v2',LABEL='時間／規則基本檢核';
  const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
  const TOKEN=/^[a-f0-9]{64}$/;
  class ArcadeError extends Error{constructor(code,status=0){super(code);this.name='ArcadeError';this.code=code;this.status=status;}}
  function endpoint(value){
    if(!value)return '';
    try{const u=new URL(String(value));return u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash&&/^[a-z0-9-]+\.supabase\.co$/i.test(u.hostname)&&u.pathname==='/functions/v1/arcade-api'?u.href:'';}catch{return '';}
  }
  function nickname(value){
    if(typeof value!=='string'||value.length>128)throw new ArcadeError('invalid_nickname');
    const name=value.normalize('NFKC').trim();
    if(/[\u0000-\u001f\u007f-\u009f\u200b\u200e\u200f\u202a-\u202e\u2066-\u2069<>\ud800-\udfff]/u.test(name)||[...name].length<2||[...name].length>16)throw new ArcadeError('invalid_nickname');
    return name;
  }
  const integer=(value,min,max)=>typeof value==='number'&&Number.isInteger(value)&&value>=min&&value<=max;
  function scoreItem(value){
    if(!value||!UUID.test(value.id||'')||value.version!==VERSION||!integer(value.score,0,28400)||value.score%100||!integer(value.hits,0,64)||!integer(value.maxCombo,0,value.hits)||value.validation!=='time-and-rules-basic'||!Number.isFinite(Date.parse(value.createdAt||'')))throw new ArcadeError('invalid_response');
    let name;try{name=nickname(value.nickname);}catch{throw new ArcadeError('invalid_response');}
    return {id:value.id,nickname:name,version:VERSION,score:value.score,hits:value.hits,maxCombo:value.maxCombo,createdAt:value.createdAt,validation:value.validation};
  }
  class Client{
    #api;#fetch;#now;#change;#run=null;#epoch=0;#abort=null;
    constructor({apiUrl='',fetcher=globalThis.fetch,now=()=>Date.now(),onChange=()=>{}}={}){this.#api=endpoint(apiUrl);this.#fetch=fetcher;this.#now=now;this.#change=onChange;}
    get enabled(){return Boolean(this.#api);}
    getState(){
      const r=this.#run,waitMs=r?.challenge?Math.max(0,r.earliestLocalAt-this.#now()):0;
      const phase=r?.phase==='ready'&&r.challenge&&this.#now()>=r.expiresLocalAt?'expired':r?.phase||'idle';
      return {enabled:this.enabled,clientRunId:r?.clientRunId||null,phase,hasTrace:Boolean(r?.trace),waitMs,canSubmit:Boolean(r?.trace&&r?.challenge&&r.phase==='ready'&&waitMs===0&&this.#now()<r.expiresLocalAt),item:r?.item||null,error:r?.error||null};
    }
    #notify(){this.#change(this.getState());}
    async #request(action,{body,id,signal}={}){
      if(!this.enabled)throw new ArcadeError('not_configured');
      const u=new URL(this.#api),controller=new AbortController();
      const abort=()=>controller.abort();
      if(signal?.aborted)controller.abort();else signal?.addEventListener('abort',abort,{once:true});
      const timer=setTimeout(()=>controller.abort(),9000);
      if(!body){u.searchParams.set('action',action);if(id)u.searchParams.set('id',id);}
      try{
        // Call fetch without binding the Client instance as the native browser receiver.
        const request=this.#fetch;
        const response=await request(u.href,{method:body?'POST':'GET',credentials:'omit',cache:'no-store',headers:body?{'content-type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal:controller.signal});
        const data=await response.json().catch(()=>null);
        if(!response.ok)throw new ArcadeError(typeof data?.error==='string'?data.error:'temporarily_unavailable',response.status);
        if(!data||typeof data!=='object')throw new ArcadeError('invalid_response');
        return data;
      }catch(error){if(error instanceof ArcadeError)throw error;throw new ArcadeError(signal?.aborted?'stale_run':'temporarily_unavailable');}
      finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
    }
    async getTop(){const data=await this.#request('top');if(!Array.isArray(data.items)||data.items.length>20)throw new ArcadeError('invalid_response');return data.items.map(scoreItem);}
    async getScore(id){if(!UUID.test(String(id||'')))throw new ArcadeError('invalid_score_id');const data=await this.#request('score',{id});return scoreItem(data.item);}
    async start(clientRunId){
      if(!this.enabled)return this.getState();
      if(typeof clientRunId!=='string'||!clientRunId)throw new ArcadeError('invalid_run');
      if(this.#run?.clientRunId===clientRunId)return this.getState();
      this.#abort?.abort();const controller=new AbortController();this.#abort=controller;
      const epoch=++this.#epoch;
      const run={clientRunId,phase:'starting',trace:null,challenge:null,item:null,error:null,earliestLocalAt:0,expiresLocalAt:0};this.#run=run;this.#notify();
      try{
        const c=await this.#request('start',{body:{action:'start',version:VERSION},signal:controller.signal});
        if(epoch!==this.#epoch)throw new ArcadeError('stale_run');
        const started=Date.parse(c.startedAt||''),earliest=Date.parse(c.earliestSubmitAt||''),expires=Date.parse(c.expiresAt||'');
        if(!UUID.test(c.runId||'')||!TOKEN.test(c.token||'')||c.version!==VERSION||c.durationMs!==40000||!Number.isFinite(started)||!Number.isFinite(earliest)||!Number.isFinite(expires)||earliest-started<40000||earliest-started>41000||expires-earliest<0||expires-started>3600000)throw new ArcadeError('invalid_response');
        run.challenge={runId:c.runId,token:c.token};
        // Use a conservative interval from receipt, rather than the device's wall
        // clock offset. The server separately enforces its 40-second minimum.
        run.earliestLocalAt=this.#now()+(earliest-started);
        run.expiresLocalAt=this.#now()+(expires-started);
        run.phase=run.trace?'ready':'playing';this.#notify();return this.getState();
      }catch(error){if(epoch!==this.#epoch)throw new ArcadeError('stale_run');run.phase='unavailable';run.error=error.code||'temporarily_unavailable';this.#notify();throw error;}
    }
    finish(trace){
      const r=this.#run;
      if(!r||trace?.runId!==r.clientRunId||trace.game!=='red-notes'||trace.version!==VERSION||trace.durationMs!==40000||!Array.isArray(trace.hitEvents)||!Array.isArray(trace.shotEvents))return false;
      if(r.trace||r.item)return false;
      r.trace=structuredClone(trace);
      if(r.challenge&&r.phase!=='submitting')r.phase='ready';this.#notify();return true;
    }
    async submit(value){
      const name=nickname(value),r=this.#run,epoch=this.#epoch;
      if(r?.phase==='submitted')return r.item;
      if(!r?.trace||!r.challenge)throw new ArcadeError('run_unavailable');
      if(r.phase==='submitting')throw new ArcadeError('submit_in_progress');
      if(r.phase!=='ready')throw new ArcadeError('run_unavailable');
      if(this.#now()<r.earliestLocalAt)throw new ArcadeError('challenge_too_early');
      if(this.#now()>=r.expiresLocalAt){r.phase='expired';r.error='challenge_unavailable';this.#notify();throw new ArcadeError('challenge_unavailable');}
      r.phase='submitting';r.error=null;this.#notify();
      try{
        const data=await this.#request('submit',{body:{action:'submit',runId:r.challenge.runId,token:r.challenge.token,nickname:name,trace:r.trace},signal:this.#abort?.signal});
        if(epoch!==this.#epoch)throw new ArcadeError('stale_run');
        const item=scoreItem(data.item);
        r.item=item;r.phase='submitted';r.challenge=null;r.trace=null;this.#notify();return item;
      }catch(error){
        if(epoch!==this.#epoch)throw new ArcadeError('stale_run');
        r.error=error.code||'temporarily_unavailable';
        if(error.code==='challenge_unavailable'){r.phase='expired';r.challenge=null;r.trace=null;}
        else{r.phase='ready';if(error.code==='challenge_too_early')r.earliestLocalAt=this.#now()+1000;}
        this.#notify();throw error;
      }
    }
  }
  globalThis.RecordsArcadeNetwork={Client,ArcadeError,endpoint,nickname,scoreItem,UUID,LABEL};
})();
