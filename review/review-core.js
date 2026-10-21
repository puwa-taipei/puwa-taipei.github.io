/* Private moderation client. Credentials and submission details are never persisted. */
(() => {
  'use strict';
  const PKCE_KEY='review-pkce-v15', PKCE_TTL=15*60*1000, SESSION_TTL=15*60*1000;
  const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
  const JWT=/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
  class ReviewError extends Error {constructor(code,status=0){super(code);this.name='ReviewError';this.code=code;this.status=status;}}
  function config(input={}) {
    const empty={enabled:false,apiUrl:'',supabaseUrl:'',publishableKey:'',authMode:'magiclink'};
    try {
      const auth=new URL(input.supabaseUrl),api=new URL(input.apiUrl);
      if(auth.protocol!=='https:'||!/^[-a-z0-9]+\.supabase\.co$/i.test(auth.hostname)||auth.pathname!=='/'||auth.search||auth.hash||auth.username||auth.password||api.origin!==auth.origin||api.pathname!=='/functions/v1/intake-api'||api.search||api.hash||api.username||api.password||!/^sb_publishable_[A-Za-z0-9_-]{16,200}$/.test(input.publishableKey||'')||input.authMode!=='magiclink')return empty;
      return {enabled:true,apiUrl:api.href,supabaseUrl:auth.origin,publishableKey:input.publishableKey,authMode:'magiclink'};
    }catch{return empty;}
  }
  function callback(input={}) {
    if(input.error)return {error:'login_link_invalid'};
    if(typeof input.code==='string'&&UUID.test(input.code))return {code:input.code};
    // Old invitation links may return an implicit session; it still needs server allowlisting.
    if(typeof input.accessToken==='string'&&input.accessToken.length<=12000&&JWT.test(input.accessToken)&&input.tokenType==='bearer'){
      const expiresIn=Number(input.expiresIn),expiresAt=Number(input.expiresAt);
      if(!Number.isFinite(expiresIn)||expiresIn<=0||expiresIn>86400)return {error:'login_link_invalid'};
      return {accessToken:input.accessToken,expiresIn,expiresAt:Number.isFinite(expiresAt)&&expiresAt>0?expiresAt:null};
    }
    return Object.keys(input).length?{error:'login_link_invalid'}:{};
  }
  function publicText(value,min,max) {
    if(typeof value!=='string')throw new ReviewError('invalid_public_game');
    const s=value.replace(/\r\n?/g,'\n').trim();
    if([...s].length<min||[...s].length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b\u200e\u200f\u202a-\u202e\u2066-\u2069\ud800-\udfff]/u.test(s))throw new ReviewError('invalid_public_game');
    return s;
  }
  function publicURL(value) {
    const raw=publicText(value,1,2048);if(/\s/.test(raw))throw new ReviewError('invalid_public_game');
    let u;try{u=new URL(raw);}catch{throw new ReviewError('invalid_public_game');}
    const host=u.hostname.toLowerCase();
    if(u.protocol!=='https:'||u.username||u.password||u.port||host.includes(':')||/^\d+(?:\.\d+)*$/.test(host)||!host.includes('.')||!host.split('.').every(x=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(x))||/(?:^|\.)(?:localhost|local|internal|lan|home|test|invalid|example|onion|arpa)$/.test(host))throw new ReviewError('invalid_public_game');
    return u.href;
  }
  function repository(value) {
    const u=new URL(publicURL(value)),match=u.pathname.match(/^\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?)\/([A-Za-z0-9_.-]{1,100})\/?$/);
    if(u.hostname!=='github.com'||u.search||u.hash||!match||['.','..'].includes(match[2])||match[2].endsWith('.git'))throw new ReviewError('invalid_public_game');
    return 'https://github.com/'+match[1]+'/'+match[2];
  }
  function publicGame(detail,values={}) {
    if(detail?.kind!=='game'||detail.status!=='approved')throw new ReviewError('not_approved');
    const title=publicText(values.title,1,100),summary=publicText(values.summary,1,1200),license=publicText(values.license,1,120);
    const repoUrl=repository(values.repoUrl),gameUrl=values.gameUrl===undefined||values.gameUrl===null||values.gameUrl===''?null:publicURL(values.gameUrl);
    const commitSha=publicText(values.commitSha,40,40).toLowerCase();if(!/^[a-f0-9]{40}$/.test(commitSha))throw new ReviewError('invalid_public_game');
    const externalServices=publicText(values.externalServices,1,1000);
    const coverPath=values.coverPath===undefined||values.coverPath===null||values.coverPath===''?null:publicText(values.coverPath,1,120);
    if(coverPath&&!/^\/assets\/community\/[A-Za-z0-9][A-Za-z0-9_-]{0,79}\.(?:png|jpg|jpeg)$/.test(coverPath))throw new ReviewError('invalid_public_game');
    if(detail.payload?.repoUrl!==undefined&&(repoUrl!==detail.payload.repoUrl||commitSha!==detail.payload.commitSha))throw new ReviewError('source_mismatch');
    // Contact, private notes, and unconsented attribution cannot enter this allowlisted projection.
    return {title,summary,repoUrl,commitSha,gameUrl,license,externalServices,coverPath};
  }
  function publicPreview(detail,values) {
    const output=publicGame(detail,values),p=detail.payload||{};
    if(p.creditConsent===true&&typeof p.creditName==='string'&&p.creditName.trim())output.creditName=p.creditName.trim();
    return output;
  }
  function takeVerifier(storage,host,now=Date.now()) {
    let raw=null;
    try{raw=storage.getItem(PKCE_KEY);storage.removeItem(PKCE_KEY);}catch{throw new ReviewError('storage_unavailable');}
    let data;try{data=JSON.parse(raw);}catch{throw new ReviewError('verifier_missing');}
    if(!data||data.host!==host||!Number.isFinite(data.createdAt)||data.createdAt>now||now-data.createdAt>PKCE_TTL||!/^[A-Za-z0-9_-]{43}$/.test(data.verifier||''))throw new ReviewError('verifier_missing');
    return data.verifier;
  }
  const base64url=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  class Client {
    #config;#fetch;#now;#storage;#crypto;#change;#token='';#expires=0;#authorized=false;#generation=0;#controllers=new Set();#lastMail=0;
    constructor({settings={},fetcher=globalThis.fetch,now=()=>Date.now(),storage=globalThis.sessionStorage,crypto=globalThis.crypto,onChange=()=>{}}={}){this.#config=config(settings);this.#fetch=fetcher.bind(globalThis);this.#now=now;this.#storage=storage;this.#crypto=crypto;this.#change=onChange;}
    get enabled(){return this.#config.enabled;}
    state(){return {enabled:this.enabled,authorized:this.#authorized&&this.#now()<this.#expires,expiresAt:this.#expires||null,generation:this.#generation};}
    clear(reason='signed_out',{preserveVerifier=false}={}) {
      this.#generation++;for(const c of this.#controllers)c.abort();this.#controllers.clear();this.#token='';this.#expires=0;this.#authorized=false;
      if(!preserveVerifier){try{this.#storage.removeItem(PKCE_KEY);}catch{}}
      this.#change({...this.state(),reason});
    }
    checkExpiry(){
      try{const raw=this.#storage.getItem(PKCE_KEY);if(raw){const pending=JSON.parse(raw);if(!Number.isFinite(pending?.createdAt)||pending.createdAt>this.#now()||this.#now()-pending.createdAt>=PKCE_TTL)this.#storage.removeItem(PKCE_KEY);}}catch{}
      if(this.#token&&this.#now()>=this.#expires)this.clear('session_expired');return this.state().authorized;
    }
    async #request(url,{body,token='',auth=false,generation=this.#generation}={}){
      if(!this.enabled)throw new ReviewError('not_configured');
      const controller=new AbortController();this.#controllers.add(controller);const timer=setTimeout(()=>controller.abort(),12000);
      const headers={'content-type':'application/json'};if(auth)headers.apikey=this.#config.publishableKey;if(token)headers.Authorization=`Bearer ${token}`;
      try{
        const response=await this.#fetch(url,{method:'POST',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',headers,body:JSON.stringify(body||{}),signal:controller.signal});
        const data=await response.json().catch(()=>null);
        if(generation!==this.#generation)throw new ReviewError('stale_request');
        if(!response.ok){
          const allowed=new Set(['version_conflict','not_found','invalid_request','not_approved','approval_required','source_mismatch','already_published','invalid_public_game','rate_limited','repo_verification_failed','repo_verification_unavailable']);
          const code=response.status===401?'session_expired':response.status===403?'access_denied':response.status===429?'rate_limited':allowed.has(data?.error)?data.error:response.status===409?'version_conflict':'temporarily_unavailable';
          if(token&&(response.status===401||response.status===403))this.clear(code);
          throw new ReviewError(code,response.status);
        }
        if(token&&this.#token&&this.#now()>=this.#expires){this.clear('session_expired');throw new ReviewError('session_expired',401);}
        if(response.status===204)return {};
        if(!data||typeof data!=='object'||Array.isArray(data))throw new ReviewError('invalid_response');
        return data;
      }catch(error){if(error instanceof ReviewError)throw error;if(generation!==this.#generation)throw new ReviewError('stale_request');throw new ReviewError(controller.signal.aborted?'request_timeout':'temporarily_unavailable');}
      finally{clearTimeout(timer);this.#controllers.delete(controller);}
    }
    async sendLink(email,redirectUrl) {
      if(!this.enabled)throw new ReviewError('not_configured');
      if(this.#lastMail&&this.#now()-this.#lastMail<60000)throw new ReviewError('rate_limited');
      if(typeof email!=='string'||email.length>254||!/^\S+@\S+\.\S+$/.test(email.trim()))throw new ReviewError('invalid_email');
      let redirect;try{redirect=new URL(redirectUrl);}catch{throw new ReviewError('invalid_redirect');}
      if(!((redirect.protocol==='https:')||(redirect.protocol==='http:'&&['localhost','127.0.0.1'].includes(redirect.hostname)))||redirect.pathname!=='/review/'||redirect.search||redirect.hash||redirect.username||redirect.password)throw new ReviewError('invalid_redirect');
      const generation=this.#generation;
      const verifier=base64url(this.#crypto.getRandomValues(new Uint8Array(32)));
      const challenge=base64url(await this.#crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));
      if(generation!==this.#generation)throw new ReviewError('stale_request');
      try{this.#storage.setItem(PKCE_KEY,JSON.stringify({verifier,createdAt:this.#now(),host:this.#config.supabaseUrl}));}catch{throw new ReviewError('storage_unavailable');}
      this.#lastMail=this.#now();
      try{return await this.#request(`${this.#config.supabaseUrl}/auth/v1/otp?redirect_to=${encodeURIComponent(redirect.href)}`,{auth:true,body:{email:email.trim(),create_user:false,code_challenge:challenge,code_challenge_method:'s256'}});}catch(error){try{this.#storage.removeItem(PKCE_KEY);}catch{}throw error;}
    }
    async authenticate(input) {
      if(!this.enabled)throw new ReviewError('not_configured');
      const parsed=callback(input);let verifier=null;
      try{verifier=parsed.code?takeVerifier(this.#storage,this.#config.supabaseUrl,this.#now()):null;}catch(error){this.clear(error.code);throw error;}
      this.clear('checking_access');const generation=this.#generation;
      if(parsed.error)throw new ReviewError(parsed.error);
      let session=parsed;
      if(parsed.code)session=await this.#request(`${this.#config.supabaseUrl}/auth/v1/token?grant_type=pkce`,{auth:true,generation,body:{auth_code:parsed.code,code_verifier:verifier}});
      const token=session.accessToken||session.access_token,seconds=Number(session.expiresIn||session.expires_in),at=Number(session.expiresAt||session.expires_at);
      if(typeof token!=='string'||!JWT.test(token)||token.length>12000||!Number.isFinite(seconds)||seconds<=0)throw new ReviewError('login_link_invalid');
      const now=this.#now();this.#token=token;this.#expires=Math.min(now+SESSION_TTL,now+seconds*1000,Number.isFinite(at)&&at>0?at*1000:Infinity);
      if(this.#expires<=now){this.clear('session_expired');throw new ReviewError('session_expired');}
      try{
        const result=await this.#request(this.#config.apiUrl,{token,generation,body:{action:'admin_me'}});
        if(generation!==this.#generation)throw new ReviewError('stale_request');
        if(result.admin!==true){this.clear('access_denied');throw new ReviewError('access_denied',403);}
        if(this.#now()>=this.#expires){this.clear('session_expired');throw new ReviewError('session_expired');}
        this.#authorized=true;this.#change(this.state());return {admin:true};
      }catch(error){if(generation===this.#generation)this.clear(error.code||'login_unavailable');throw error;}
    }
    async call(action,body={}){
      if(!this.checkExpiry())throw new ReviewError('session_expired',401);
      if(!['admin_list','admin_detail','admin_update','admin_publish','admin_retract'].includes(action))throw new ReviewError('invalid_request');
      return this.#request(this.#config.apiUrl,{token:this.#token,body:{...body,action}});
    }
    async signOut(){const token=this.#token;this.clear('signed_out');if(token&&this.enabled){try{await this.#request(`${this.#config.supabaseUrl}/auth/v1/logout?scope=local`,{token,auth:true});}catch{}}}
  }
  globalThis.RecordsReview=Object.freeze({Client,ReviewError,config,callback,publicGame,publicPreview,takeVerifier,UUID,PKCE_KEY,PKCE_TTL,SESSION_TTL});
})();
