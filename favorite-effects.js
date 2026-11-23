(() => {
  'use strict';
  const page = document.getElementById('favorite-effects');
  const toggle = document.querySelector('.sound-toggle');
  const cards = [...page.querySelectorAll('.effects-media')];
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  let active;
  const sound = () => toggle.getAttribute('aria-pressed') === 'true';
  const visible = () => !page.hidden && !document.hidden;
  function reset(job = active) {
    if (!job || active !== job) return;
    active = undefined;
    job.video.pause();
    job.video.removeAttribute('src');
    job.video.load();
    job.button.setAttribute('aria-pressed','false');
    job.button.setAttribute('aria-label',job.button.dataset.label + 'を再生');
  }
  async function play(button, mode) {
    reset();
    if (!visible()) return;
    const video = button.querySelector('video');
    const job = {button,video,mode,soundBlocked:false};
    active = job;
    video.muted = !sound();
    video.src = video.dataset.src;
    try { await video.play(); }
    catch (error) {
      if (active !== job) return;
      if (error.name !== 'NotAllowedError' || video.muted) return reset(job);
      job.soundBlocked = true;
      try { video.muted = true; await video.play(); }
      catch { return reset(job); }
    }
    if (active !== job) return;
    button.setAttribute('aria-pressed','true');
    button.setAttribute('aria-label',button.dataset.label+(job.soundBlocked?'を音声付きで再生':'の再生を止める'));
  }
  for (const button of cards) {
    const video=button.querySelector('video');
    video.addEventListener('ended',()=>{if(active?.video===video)reset()});
    button.addEventListener('pointerenter',event=>{if(fine.matches&&event.pointerType==='mouse'&&active?.button!==button)void play(button,'hover')});
    button.addEventListener('pointerleave',()=>{if(active?.button===button&&active.mode==='hover')reset()});
    button.addEventListener('click',()=>{if(active?.button===button&&active.mode==='click'&&!(active.soundBlocked&&sound()))return reset();void play(button,'click')});
  }
  new MutationObserver(()=>{if(!visible())reset()}).observe(page,{attributes:true,attributeFilter:['hidden']});
  new MutationObserver(()=>{
    const job=active;
    if(!job)return;
    if(!sound())job.video.muted=true;
    else if(job.mode==='click')void play(job.button,'click');
    else {job.soundBlocked=true;job.button.setAttribute('aria-label',job.button.dataset.label+'を音声付きで再生')}
  }).observe(toggle,{attributes:true,attributeFilter:['aria-pressed']});
  document.addEventListener('visibilitychange',()=>{if(!visible())reset()});
  window.addEventListener('pagehide',()=>reset());
})();
