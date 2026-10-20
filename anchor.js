(() => {
  const initialHash=location.hash;
  if(!initialHash)return;
  let interacted=false;
  const done=new Set();
  for(const type of ['pointerdown','keydown','wheel','touchstart'])addEventListener(type,()=>{interacted=true;},{once:true,passive:true});
  document.addEventListener('records:ready',event=>{
    done.add(event.detail);
    if(done.size!==3||interacted||location.hash!==initialHash)return;
    const target=document.getElementById(initialHash.slice(1));
    if(target)requestAnimationFrame(()=>requestAnimationFrame(()=>{if(!interacted&&location.hash===initialHash)target.scrollIntoView({behavior:'instant',block:'start'});}));
  });
})();
