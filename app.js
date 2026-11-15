const screens = ['contents', 'intro-profile', 'profile', 'hobbies', 'ultima', 'ultima-design', 'sushi', 'sushi-design', 'kaiju', 'kaiju-design', 'documents', 'other', 'other-works'];
const screenLabels = ['目次', 'アピールZONE', '真・アピールZONE', '趣味MODE', 'ウルティマダーツ 01', '演出と制作判断', '最後の晩餐はSUSHIがいいニャ', '演出と制作判断', '破壊王', '破壊王の演出と制作判断', 'ゲーム企画書', 'その他制作', 'その他の制作物'];
const firstTextRevealPage = screens.indexOf('ultima-design');
for (const id of screens.slice(firstTextRevealPage)) {
  document.getElementById(id).classList.add('reveal-page-text');
}
history.scrollRestoration = 'manual';
const dialog = document.querySelector('#proposal-dialog');
let current = 0;
let returnFocus = null;
const videoCovers = document.querySelectorAll('.video-cover[data-video-id]');
const gameplayVideo = document.querySelector('#kaiju video');
const gameplayCover = document.querySelector('#play-kaiju-video');
const portfolioSong = document.querySelector('#pale-blue-rain');
const brand = document.querySelector('.brand');
const brandName = brand.querySelector('.brand-name');
const brandSection = brand.querySelector('.brand-section');
const profileScreen = document.querySelector('#profile');
const profileShin = profileScreen.querySelector('.profile-title-shin');
const profileTitleLabel = profileScreen.querySelector('.profile-title-label');
const profileContent = profileScreen.querySelector('.profile-zone-content');
const portfolioSections = {
  profile: 'CZ',
  games: '制作作品',
  documents: 'BONUS',
  other: 'BONUS'
};

function showScreen(name, focus = true) {
  const next = screens.indexOf(name);
  if (next < 0) return;
  const enteringProfile = name === 'profile' && current !== next;
  const enteringDocuments = name === 'documents' && current !== next;
  const screen = document.getElementById(name);
  clearPlayEffects();
  if (name !== 'profile') profileScreen.classList.remove('profile-zone-entering');
  if (screens[current] === 'other-works' && name !== 'other-works') portfolioSong.pause();
  if (screens[current] === 'kaiju' && name !== 'kaiju') {
    gameplayVideo.pause();
    gameplayVideo.hidden = true;
    gameplayCover.hidden = false;
  }
  for (const cover of videoCovers) {
    if (cover.closest('.screen').id === name) continue;
    cover.parentElement.querySelector('iframe')?.remove();
    cover.hidden = false;
  }
  current = next;
  screens.forEach((id, i) => { document.getElementById(id).hidden = i !== next; });
  const section = screen.dataset.portfolioSection;
  const sectionLabel = portfolioSections[section] ?? '';
  brand.dataset.portfolioSection = section ?? '';
  brandName.hidden = Boolean(sectionLabel);
  brandSection.hidden = !sectionLabel;
  brandSection.textContent = sectionLabel;
  brand.setAttribute('aria-label', sectionLabel ? `${sectionLabel}。目次へ戻る` : '目次へ');
  document.querySelector('#prev-page').disabled = next === 0;
  document.querySelector('#next-page').disabled = next === screens.length - 1;
  document.querySelector('#page-label').textContent = `${String(next + 1).padStart(2, '0')}/${String(screens.length).padStart(2, '0')}`;
  document.querySelector('#next-page').setAttribute('aria-label', next < screens.length - 1 ? `${screenLabels[next + 1]}へ` : '最後のページ');
  const title = document.querySelector('.flying-title');
  title.classList.remove('title-enter');
  if (name === 'ultima') {
    void title.offsetWidth;
    title.classList.add('title-enter');
    prepareDartSounds();
  }
  if (name === 'sushi' && soundEnabled) prepareSushiSound();
  if (name === 'ultima' || name === 'sushi' || name === 'kaiju') syncTitleSounds(name);
  if (name === 'kaiju') prepareKaijuSounds();
  if (location.hash !== '#' + name) {
    const update = focus ? 'pushState' : 'replaceState';
    history[update](null, '', '#' + name);
  }
  window.scrollTo({ top: 0, behavior: 'instant' });
  if (screen.matches('.design-screen, #ultima, #sushi, #kaiju, #documents, #other, #other-works')) screen.scrollTop = 0;
  if (enteringProfile && !reducedMotion.matches) playProfileEntrance();
  if (enteringDocuments) playPlanningEntrance();
  if (focus) screen.querySelector('h1').focus({ preventScroll: true });
}

function playProfileEntrance() {
  const glyph = profileShin.getBoundingClientRect();
  const label = profileTitleLabel.getBoundingClientRect();
  const content = profileContent.getBoundingClientRect();
  const size = Math.min(content.width * 0.48, content.height * 0.78, 360);
  profileScreen.style.setProperty('--profile-shin-x', `${content.left + content.width / 2 - glyph.left - glyph.width / 2}px`);
  profileScreen.style.setProperty('--profile-shin-y', `${content.top + content.height / 2 - glyph.top - glyph.height / 2}px`);
  profileScreen.style.setProperty('--profile-shin-scale', size / glyph.width);
  profileScreen.style.setProperty('--profile-label-offset', `${glyph.left - label.left}px`);
  profileScreen.classList.add('profile-zone-entering');
}

profileShin.addEventListener('animationend', event => {
  if (event.animationName === 'profile-shin-enter') profileScreen.classList.remove('profile-zone-entering');
});

document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => showScreen(b.dataset.go)));
brand.addEventListener('click', e => {e.preventDefault(); showScreen('contents');});
document.querySelector('#prev-page').addEventListener('click', () => showScreen(screens[current - 1]));
document.querySelector('#next-page').addEventListener('click', () => showScreen(screens[current + 1]));
function showPageFromHash(focus) {
  const name = location.hash.slice(1);
  const validPage = screens.includes(name);
  showScreen(validPage ? name : screens[0], focus && validPage);
}
window.addEventListener('popstate', () => showPageFromHash(true));
document.addEventListener('keydown', e => {
  if (document.querySelector('dialog[open]') || e.altKey || e.ctrlKey || e.metaKey || /INPUT|TEXTAREA|SELECT|IFRAME|VIDEO|AUDIO/.test(document.activeElement?.tagName)) return;
  if (e.key === 'ArrowRight' && current < screens.length - 1) { e.preventDefault(); showScreen(screens[current + 1]); }
  if (e.key === 'ArrowLeft' && current > 0) { e.preventDefault(); showScreen(screens[current - 1]); }
});
let touchStart;
document.querySelector('main').addEventListener('touchstart', e => {
  if (e.target.closest('button,a,iframe,.video-frame') || document.querySelector('dialog[open]')) return;
  touchStart = {x:e.changedTouches[0].clientX,y:e.changedTouches[0].clientY};
},{passive:true});
document.querySelector('main').addEventListener('touchend', e => {
  if (!touchStart) return;
  const dx=e.changedTouches[0].clientX-touchStart.x,dy=e.changedTouches[0].clientY-touchStart.y;
  touchStart=null;
  if (Math.abs(dx)>100 && Math.abs(dx)>Math.abs(dy)*2) showScreen(screens[current+(dx<0?1:-1)]);
},{passive:true});
document.querySelector('#video-poster').addEventListener('error', e => {e.target.hidden=true;});
for (const cover of videoCovers) {
  cover.addEventListener('click', () => {
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/${cover.dataset.videoId}?autoplay=1&rel=0&playsinline=1`;
    iframe.title = cover.getAttribute('aria-label');
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    cover.hidden = true;
    cover.parentElement.appendChild(iframe);
    iframe.focus();
  });
}

gameplayCover.addEventListener('click', () => {
  gameplayCover.hidden = true;
  gameplayVideo.hidden = false;
  gameplayVideo.focus({ preventScroll: true });
  gameplayVideo.play().catch(() => {
    // The native player remains available if automatic playback is blocked.
  });
});

function openProposal(opener = document.activeElement) {
  clearPlayEffects();
  returnFocus = opener;
  dialog.showModal(); document.body.classList.add('modal-open');
}
for (const opener of document.querySelectorAll('#open-proposal, [data-open-darts-proposal]')) {
  opener.addEventListener('click', () => openProposal(opener));
}
document.querySelector('#close-proposal').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', e => {if(e.target === dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
dialog.addEventListener('close', () => {document.body.classList.remove('modal-open');returnFocus?.focus();});

const pagedProposals = {
  kaiju: {
    name: '破壊王',
    assetPrefix: 'assets/kaiju/proposal',
    imageExtension: 'jpg',
    pageDescriptions: ['目次', 'ゲーム概要', 'あなたの街に怪獣が来る？！', 'プレイヤーの目的と方法', 'プレイヤーに味わってほしい体験', 'ターゲット層について']
  },
  'summoners-poker': {
    name: 'インディアンポーカー for サモナーズ',
    assetPrefix: 'assets/planning/summoners-poker',
    imageExtension: 'webp',
    pageDescriptions: [
      '基本ルール。チャンピオンカードを1枚ずつ配り、お題を発表。自分の札は伏せられた状態で、キープか交換を全員同時に2回選ぶ。数値の順位に応じて3点、2点、1点、0点。3ラウンドの合計点を競う。',
      '1ラウンドの例。アイアン帯ピック率がお題なら、相手に見かける頻度を聞く。低そうだと判断して交換し、新しい札はキープ。公開後のピック率が2位で2点獲得する。'
    ]
  }
};
const pagedProposalDialog = document.querySelector('#paged-proposal-dialog');
const pagedProposalTitle = pagedProposalDialog.querySelector('h2');
const pagedProposalImage = pagedProposalDialog.querySelector('img');
const pagedProposalDownload = pagedProposalDialog.querySelector('a');
const pagedProposalPrev = document.querySelector('#paged-proposal-prev');
const pagedProposalNext = document.querySelector('#paged-proposal-next');
const pagedProposalLabel = document.querySelector('#paged-proposal-page');
let activeProposal;
let proposalPage = 1;
let proposalOpener;

function showProposalPage(page) {
  const { name, assetPrefix, imageExtension, pageDescriptions } = activeProposal;
  if (page < 1 || page > pageDescriptions.length) return;
  const focusedControl = document.activeElement;
  proposalPage = page;
  pagedProposalImage.src = `${assetPrefix}-${page}.${imageExtension}`;
  pagedProposalImage.alt = `${name}の企画書 ${page}ページ目。${pageDescriptions[page - 1]}`;
  pagedProposalLabel.textContent = `${page} / ${pageDescriptions.length}`;
  pagedProposalPrev.disabled = page === 1;
  pagedProposalNext.disabled = page === pageDescriptions.length;
  if (pagedProposalPrev.disabled && focusedControl === pagedProposalPrev) pagedProposalNext.focus();
  if (pagedProposalNext.disabled && focusedControl === pagedProposalNext) pagedProposalPrev.focus();
}

for (const opener of document.querySelectorAll('[data-paged-proposal]')) {
  opener.addEventListener('click', () => {
    proposalOpener = opener;
    activeProposal = pagedProposals[opener.dataset.pagedProposal];
    if (opener.dataset.pagedProposal === 'kaiju') gameplayVideo.pause();
    pagedProposalTitle.textContent = `${activeProposal.name}｜企画書`;
    pagedProposalDownload.href = `${activeProposal.assetPrefix}.pdf`;
    pagedProposalDownload.download = `${activeProposal.name}-企画書.pdf`;
    showProposalPage(Number(opener.dataset.proposalPage) || 1);
    pagedProposalDialog.showModal();
  });
}
pagedProposalPrev.addEventListener('click', () => showProposalPage(proposalPage - 1));
pagedProposalNext.addEventListener('click', () => showProposalPage(proposalPage + 1));
pagedProposalDialog.addEventListener('keydown', event => {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  event.preventDefault();
  showProposalPage(proposalPage + (event.key === 'ArrowLeft' ? -1 : 1));
});
pagedProposalDialog.addEventListener('close', () => proposalOpener?.focus());

// Page-specific play is decorative and never intercepts the video or downloads.
const effectLayer = document.querySelector('#play-effects');
const feedback = document.querySelector('#play-feedback');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
reducedMotion.addEventListener('change', ({ matches }) => {
  if (matches) profileScreen.classList.remove('profile-zone-entering');
});
const animations = new Set();
let effectTimers = new Set();
let audioContext;
const dartSoundFiles = {
  throw: 'assets/darts/SE_Darts_Throw.wav',
  hit: 'assets/darts/SE_Darts_Hit.wav',
  bull: 'assets/darts/SE_Darts_Bull.wav',
  bullAnnouncement: 'assets/darts/SE_Announce_Bull.wav'
};
const commonSushiPlates = ['ebi', 'kappa', 'maguro', 'tamago'];
const uniPlateChance = 1 / 15;
const uniMissCount = document.querySelector('#uni-miss-count');
let consecutiveUniMisses = 0;
const kaijuCharge = document.querySelector('.kaiju-charge');
const kaijuChargeFill = kaijuCharge.querySelector('.kaiju-charge-track span');
const kaijuChargeStatus = document.querySelector('#kaiju-charge-status');
const kaijuBuildings = document.querySelectorAll('.kaiju-building');
const cabinet = document.querySelector('.cabinet');
let kaijuDestroyedBuildings = 0;
let kaijuBeamFired = false;
let kaijuSoundBuffers;
let dartSoundBuffers;
let sushiSoundBuffers;
let titleSoundBuffers;
let planningIntroSoundBuffer;
const planningPopupTimes = [0, 500, 1000, 1500, 2500];
const planningEntranceDuration = 4000;
const planningExitDuration = 300;
const playingEffectSounds = new Set();
let soundEnabled = true;
try { soundEnabled = localStorage.getItem('portfolio-sound') !== 'off'; } catch {}
let lastThrow = -Infinity;
let sceneVersion = 0;
function later(fn, delay) {
  const timer = setTimeout(() => {effectTimers.delete(timer); fn();}, delay);
  effectTimers.add(timer);
}
function clearPlayEffects() {
  sceneVersion++;
  stopEffectSounds();
  animations.forEach(a => a.cancel()); animations.clear();
  effectTimers.forEach(t => clearTimeout(t)); effectTimers.clear();
  effectLayer.replaceChildren(); feedback.textContent = '';
  document.querySelector('#dart-target').classList.remove('bullseye');
  document.querySelector('#design-samples').classList.remove('lit');
}
function readyAudio(resume = true) {
  if (!soundEnabled) return;
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    audioContext ||= new Audio();
    if (resume && audioContext.state === 'suspended') return audioContext.resume().catch(() => {});
  } catch { /* Visual feedback is still available if audio is blocked. */ }
}
function loadEffectSound(url) {
  return fetch(url)
    .then(response => response.ok ? response.arrayBuffer() : Promise.reject())
    .then(bytes => audioContext.decodeAudioData(bytes))
    .catch(() => null);
}
function prepareDartSounds() {
  if (!soundEnabled || dartSoundBuffers) return;
  readyAudio(false);
  if (!audioContext) return;
  dartSoundBuffers = Object.fromEntries(Object.entries(dartSoundFiles).map(([cue, url]) => [
    cue,
    loadEffectSound(url)
  ]));
}
function prepareSushiSound() {
  if (!soundEnabled || sushiSoundBuffers) return;
  readyAudio(false);
  if (!audioContext) return;
  sushiSoundBuffers = {
    common: loadEffectSound('assets/sushi/plate-click.mp3'),
    uni: loadEffectSound('assets/sushi/plate-uni.mp3')
  };
}
function prepareTitleSounds() {
  if (!soundEnabled || titleSoundBuffers || reducedMotion.matches) return;
  readyAudio(false);
  if (!audioContext) return;
  titleSoundBuffers = {
    darts: loadEffectSound('assets/darts/title-arrive.wav'),
    bounce: loadEffectSound('assets/sushi/title-bounce.wav'),
    land: loadEffectSound('assets/sushi/title-land.wav'),
    kaiju: loadEffectSound('assets/kaiju/title-impact.wav'),
    kaijuFinal: loadEffectSound('assets/kaiju/title-impact-final.wav')
  };
}
function preparePlanningIntroSound() {
  if (!soundEnabled || reducedMotion.matches || planningIntroSoundBuffer) return;
  readyAudio(false);
  if (audioContext) planningIntroSoundBuffer = loadEffectSound('assets/planning/popup-intro.wav');
}

function playPlanningEntrance() {
  if (reducedMotion.matches) return;
  const version = sceneVersion;
  let started = false;

  function start(buffer) {
    if (started || version !== sceneVersion || reducedMotion.matches) return;
    started = true;
    const audible = buffer && soundEnabled && audioContext?.state === 'running';
    const lead = audible ? .045 : 0;
    const visualStart = performance.now() + lead * 1000;
    if (audible) createEffectSound(buffer, .82).source.start(audioContext.currentTime + lead);

    const layer = document.querySelector('#planning-popup-entrance-template').content.firstElementChild.cloneNode(true);
    effectLayer.append(layer);
    layer.querySelectorAll('.planning-popup').forEach((popup, index) => {
      const animation = animateEffect(popup, [
        {opacity: 0, scale: .7, transform: 'translateY(16px)'},
        {opacity: 1, scale: 1.055, transform: 'translateY(-3px)', offset: .58},
        {opacity: 1, scale: 1, transform: 'translateY(0)'}
      ], {duration: 210, delay: planningPopupTimes[index], fill: 'both', easing: 'ease-out'});
      animation.startTime = visualStart;
    });
    const exit = animateEffect(layer, [
      {opacity: 1, transform: 'translateY(0)'},
      {opacity: 0, transform: 'translateY(-12px)'}
    ], {
      duration: planningExitDuration,
      delay: planningEntranceDuration - planningExitDuration,
      fill: 'forwards',
      easing: 'ease-in'
    });
    exit.startTime = visualStart;
    exit.finished.then(() => layer.remove(), () => {});
  }

  if (soundEnabled && (audioContext?.state === 'running' || navigator.userActivation?.isActive)) {
    preparePlanningIntroSound();
    if (planningIntroSoundBuffer) {
      const audioReady = readyAudio();
      later(start, 200);
      Promise.all([planningIntroSoundBuffer, audioReady]).then(([buffer]) => start(buffer));
      return;
    }
  }
  start();
}

function syncTitleSounds(page) {
  if (!soundEnabled || reducedMotion.matches) return;
  if (audioContext?.state !== 'running' && !navigator.userActivation?.isActive) return;
  prepareTitleSounds();
  if (!titleSoundBuffers) return;

  const audioReady = readyAudio();
  const version = sceneVersion;
  const destroyed = kaijuDestroyedBuildings;
  const beamFired = kaijuBeamFired;
  const darts = page === 'ultima';
  const kaiju = page === 'kaiju';
  const titleParts = document.querySelectorAll({
    ultima: '.flying-title',
    sushi: '#sushi-title em, #sushi-title .sushi-title-prefix, #sushi-title .sushi-title-dinner',
    kaiju: '.kaiju-title-letter'
  }[page]);
  const motions = Array.from(titleParts, part => part.getAnimations()[0]).filter(Boolean);
  // The first animated SUSHI title part in DOM order is 「最後の」.
  const motion = page === 'sushi'
    ? motions.find(animation => animation.animationName === 'sushi-title-hop')
    : motions[0];
  if (!motion) return;
  const {delay, duration} = motion.effect.getTiming();
  // The dart and landing recordings have 120 ms and 60 ms of lead-in.
  const cues = darts ? [
    {sound: titleSoundBuffers.darts, time: delay - 120, volume: .62}
  ] : kaiju ? motions.map((animation, index) => ({
    sound: index === 2 ? titleSoundBuffers.kaijuFinal : titleSoundBuffers.kaiju,
    time: animation.effect.getTiming().delay,
    volume: .52,
    length: index === 2 ? undefined : .24
  })) : [
    ...motions.filter(animation => animation !== motion).map(rebound => ({
      sound: titleSoundBuffers.bounce, time: rebound.effect.getTiming().delay, volume: .52
    })),
    {sound: titleSoundBuffers.land, time: delay + duration * .9 - 60, volume: .58}
  ];

  for (const animation of motions) {
    animation.pause();
    animation.currentTime = 0;
  }
  // Continue the visual sequence if audio loading takes too long.
  const fallback = setTimeout(start, 220);
  function start(buffers = []) {
    if (motion.playState !== 'paused') return;
    clearTimeout(fallback);
    const audible = version === sceneVersion && soundEnabled
      && (!kaiju || destroyed === kaijuDestroyedBuildings && beamFired === kaijuBeamFired)
      && audioContext.state === 'running' && buffers.some(Boolean);
    // Give the audio sources and the CSS animations the same future start.
    const lead = audible ? .05 : 0;
    const visualStart = performance.now() + lead * 1000;
    if (audible) {
      const audioStart = audioContext.currentTime + lead;
      cues.forEach(({time, volume, length}, index) => {
        if (!buffers[index]) return;
        const at = audioStart + time / 1000;
        const {source, gain} = createEffectSound(buffers[index], volume);
        if (length) {
          gain.gain.setValueAtTime(volume, at + length - .05);
          gain.gain.linearRampToValueAtTime(0, at + length);
          source.start(at, 0, length);
        } else {
          source.start(at);
        }
      });
    }
    for (const animation of motions) {
      animation.play();
      animation.startTime = visualStart;
    }
  }
  Promise.all([audioReady, ...cues.map(cue => cue.sound)]).then(([, ...buffers]) => start(buffers));
}
function prepareKaijuSounds() {
  if (!soundEnabled || kaijuSoundBuffers) return;
  readyAudio(false);
  if (!audioContext) return;
  kaijuSoundBuffers = {
    charge: loadEffectSound('assets/kaiju/building-charge.mp3'),
    fire: loadEffectSound('assets/kaiju/beam-fire.wav'),
    impact: loadEffectSound('assets/kaiju/beam-impact.wav')
  };
}
async function playEffectSound(bufferPromise, version, audioReady, volume = 1) {
  if (!soundEnabled) return;
  const [buffer] = await Promise.all([bufferPromise, audioReady]);
  if (!buffer || !soundEnabled || version !== sceneVersion || audioContext.state !== 'running') return;
  createEffectSound(buffer, volume).source.start();
}
function createEffectSound(buffer, volume) {
  const source = audioContext.createBufferSource();
  const gain = audioContext.createGain();
  source.buffer = buffer;
  gain.gain.value = volume;
  source.connect(gain);
  gain.connect(audioContext.destination);
  playingEffectSounds.add(source);
  source.onended = () => {
    playingEffectSounds.delete(source);
    source.disconnect();
    gain.disconnect();
  };
  return {source, gain};
}
function stopEffectSounds() {
  playingEffectSounds.forEach(source => source.stop());
  playingEffectSounds.clear();
}
function hitSound() {
  if (!soundEnabled || audioContext?.state !== 'running') return;
  const now = audioContext.currentTime;
  [784, 988, 1319].forEach((frequency, i) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'sine'; oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, now + i * .065);
    gain.gain.linearRampToValueAtTime(.065, now + i * .065 + .012);
    gain.gain.exponentialRampToValueAtTime(.001, now + i * .065 + .3);
    oscillator.connect(gain); gain.connect(audioContext.destination);
    oscillator.start(now + i * .065); oscillator.stop(now + i * .065 + .32);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  });
}
function renderSoundToggle() {
  const button = document.querySelector('.sound-toggle');
  const label = soundEnabled ? 'サウンド ON' : 'サウンド OFF';
  button.setAttribute('aria-pressed', String(soundEnabled));
  button.setAttribute('aria-label', label);
  button.textContent = label;
}
renderSoundToggle();
prepareTitleSounds();
preparePlanningIntroSound();
document.querySelector('.sound-toggle').addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  renderSoundToggle();
  try { localStorage.setItem('portfolio-sound', soundEnabled ? 'on' : 'off'); } catch {}
  if (soundEnabled) {
    readyAudio();
    prepareTitleSounds();
    preparePlanningIntroSound();
    if (screens[current] === 'ultima') prepareDartSounds();
    if (screens[current] === 'sushi') prepareSushiSound();
  } else stopEffectSounds();
});
function animateEffect(node, frames, options) {
  const animation = node.animate(frames, options);
  animations.add(animation);
  animation.finished.then(() => animations.delete(animation), () => animations.delete(animation));
  return animation;
}
function throwDart(x, y) {
  if (screens[current] !== 'ultima' || dialog.open || performance.now() - lastThrow < 160) return;
  lastThrow = performance.now();
  const version = sceneVersion;
  const audioReady = readyAudio();
  prepareDartSounds();
  playEffectSound(dartSoundBuffers?.throw, version, audioReady);
  const target = document.querySelector('#dart-target');
  const board = target.getBoundingClientRect();
  const cx = board.left + board.width / 2, cy = board.top + board.height / 2;
  const distance = Math.hypot(x - cx, y - cy) / board.width;
  const hit = distance <= .47;
  const bull = distance <= .065;
  // Keep the launch below and to the right of the impact so even far-left shots climb steeply.
  const travelX = Math.min(230, window.innerWidth * .12);
  const travelY = Math.max(travelX * 2, window.innerHeight * .96 - y);
  const angle = Math.atan2(-travelY, -travelX) * 180 / Math.PI;
  const flightPose = (remaining, scale) =>
    `translate(${travelX * remaining}px,${travelY * remaining}px) rotate(${angle}deg) scale(${scale * .8},${scale})`;
  const dart = document.createElement('span');
  dart.className = 'thrown-dart';
  // Arrow tip is at the wrapper origin, so the impact position equals the cursor.
  dart.innerHTML = '<svg viewBox="0 0 100 32"><path d="M0 3L22 6L34 14L34 18L22 26L0 29L9 16Z" fill="#f1f1f5" stroke="#abb6ce" stroke-width="1.2"/><path d="M8 16H91" stroke="#e6edff" stroke-width="3"/><path d="M43 12L71 14L77 16L71 18L43 20Z" fill="#c8d3ec"/><path d="M49 12V20M54 13V19M59 13V19M64 14V18" stroke="#6a7590" stroke-width="1.5"/><path d="M76 16H100" stroke="#eef5ff" stroke-width="1.5"/></svg>';
  effectLayer.appendChild(dart);
  dart.style.left = x + 'px'; dart.style.top = y + 'px';
  dart.style.transform = flightPose(0, .55);
  const impact = () => {
    if (version !== sceneVersion) return;
    const mark = document.createElement('span'); mark.className = 'impact-ring';
    mark.style.left = x + 'px'; mark.style.top = y + 'px'; effectLayer.appendChild(mark);
    if (hit) {
      if (bull) {
        target.classList.remove('bullseye'); void target.offsetWidth; target.classList.add('bullseye');
      }
      feedback.textContent = bull ? 'BULLSEYE!' : 'NICE SHOT!';
      if (bull) {
        playEffectSound(dartSoundBuffers?.bull, version, audioReady, .22);
        playEffectSound(dartSoundBuffers?.bullAnnouncement, version, audioReady, .88);
      } else {
        playEffectSound(dartSoundBuffers?.hit, version, audioReady);
      }
      later(() => {feedback.textContent = ''; target.classList.remove('bullseye');}, 2200);
    }
    later(() => {dart.remove(); mark.remove();}, 650);
  };
  if (reducedMotion.matches) impact();
  else {
    const flight = animateEffect(dart, [
      {transform:flightPose(1, 2.5),opacity:0},
      {transform:flightPose(.86, 1.9),opacity:1,offset:.14},
      {transform:flightPose(.3, .9),opacity:1,offset:.6},
      {transform:flightPose(0, .55),opacity:1}
    ], {duration:310,easing:'cubic-bezier(.2,.55,.45,1)',fill:'forwards'});
    flight.finished.then(impact, () => dart.remove());
  }
}
document.querySelector('#dart-target').addEventListener('click', e => {
  if (e.detail > 0) {
    throwDart(e.clientX, e.clientY);
    return;
  }
  const board = e.currentTarget.getBoundingClientRect();
  throwDart(board.left + board.width / 2, board.top + board.height / 2);
});
function showSushiPlate(x, y) {
  const isUni = Math.random() < uniPlateChance;
  consecutiveUniMisses = isUni ? 0 : consecutiveUniMisses + 1;
  uniMissCount.textContent = String(consecutiveUniMisses);
  const topping = isUni ? 'uni' : commonSushiPlates[Math.floor(Math.random() * commonSushiPlates.length)];
  const plate = document.createElement('img');
  plate.className = 'sushi-plate-effect';
  if (isUni) plate.classList.add('sushi-plate-uni');
  plate.src = `assets/sushi/plate-${topping}.png`;
  plate.alt = '';
  plate.style.left = x + 'px';
  plate.style.top = y + 'px';
  effectLayer.appendChild(plate);

  const duration = 850;
  if (!reducedMotion.matches) {
    animateEffect(plate, [
      {transform: 'translateY(10px) scale(.68)', opacity: 0},
      {transform: 'scale(1)', opacity: 1, offset: .25},
      {transform: 'scale(1)', opacity: 1, offset: .68},
      {transform: 'translateY(-18px) scale(.96)', opacity: 0}
    ], {duration, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'forwards'});
  }
  later(() => plate.remove(), duration);

  const audioReady = readyAudio();
  prepareSushiSound();
  playEffectSound(sushiSoundBuffers?.[isUni ? 'uni' : 'common'], sceneVersion, audioReady, .5);
}

async function destroyKaijuBuilding(event) {
  const building = event.currentTarget;
  if (building.getAttribute('aria-disabled') === 'true') return;
  building.setAttribute('aria-disabled', 'true');
  building.tabIndex = -1;

  const destroyed = ++kaijuDestroyedBuildings;
  const total = kaijuBuildings.length;
  kaijuChargeFill.style.setProperty('--kaiju-charge-level', destroyed / total);
  kaijuCharge.setAttribute('aria-disabled', String(destroyed < total));
  kaijuChargeStatus.textContent = destroyed === total ? 'クリックで発射' : `破壊 ${destroyed}/${total}`;
  if (destroyed === total && event.detail === 0) kaijuCharge.focus({preventScroll: true});

  stopEffectSounds();
  if (!soundEnabled) return;
  const version = sceneVersion;
  prepareKaijuSounds();
  const [buffer] = await Promise.all([kaijuSoundBuffers?.charge, readyAudio()]);
  if (!buffer || !soundEnabled || version !== sceneVersion || destroyed !== kaijuDestroyedBuildings
      || kaijuBeamFired || audioContext?.state !== 'running') return;
  createEffectSound(buffer, .55).source.start();
}

async function playKaijuShot(impactDelay) {
  if (!soundEnabled) return;
  const version = sceneVersion;
  const firedAt = performance.now();
  prepareKaijuSounds();
  const [fire, impact] = await Promise.all([kaijuSoundBuffers?.fire, kaijuSoundBuffers?.impact, readyAudio()]);
  if (!soundEnabled || version !== sceneVersion || audioContext?.state !== 'running') return;
  const now = audioContext.currentTime;
  if (fire) createEffectSound(fire, .52).source.start(now, .08);
  if (impact) {
    const untilImpact = Math.max(0, impactDelay - (performance.now() - firedAt)) / 1000;
    createEffectSound(impact, .48).source.start(now + untilImpact);
  }
}

function fireKaijuBeam() {
  if (kaijuBeamFired || kaijuCharge.getAttribute('aria-disabled') === 'true') return;
  kaijuBeamFired = true;
  stopEffectSounds();
  kaijuChargeFill.style.setProperty('--kaiju-charge-level', 0);
  kaijuCharge.setAttribute('aria-disabled', 'true');
  kaijuChargeStatus.textContent = '発射済み';

  const track = document.createElement('div');
  track.className = 'kaiju-beam-track';
  const {width, height} = effectLayer.getBoundingClientRect();
  // Extend the wide end behind the viewport so the beam enters from the viewer's side.
  const originX = width * .39;
  const originY = height * 1.2;
  const sweepStart = {x: width * .1, y: height * .78};
  const sweepEnd = {x: width * .88, y: height * .2};
  const beamLength = Math.hypot(sweepEnd.x - originX, sweepEnd.y - originY);
  const aim = ({x, y}) => {
    const dx = x - originX;
    const dy = y - originY;
    return `rotate(${Math.atan2(dy, dx)}rad) scaleX(${Math.hypot(dx, dy) / beamLength})`;
  };
  track.style.left = `${originX}px`;
  track.style.top = `${originY}px`;
  track.style.width = `${beamLength}px`;
  track.style.transform = aim(sweepEnd);
  const ray = document.createElement('span');
  ray.className = 'kaiju-beam-ray';
  track.appendChild(ray);
  effectLayer.appendChild(track);

  if (reducedMotion.matches) {
    playKaijuShot(150);
    track.style.opacity = '.55';
    later(() => track.remove(), 260);
    return;
  }

  const flash = document.createElement('div');
  flash.className = 'kaiju-beam-flash';
  effectLayer.appendChild(flash);

  const sweepDelay = 65;
  const sweepDuration = 330;
  const sweepEndTime = sweepDelay + sweepDuration;
  playKaijuShot(sweepEndTime);
  const fadeDuration = 135;
  const rayDuration = sweepEndTime + fadeDuration;
  // Interpolate the tip across the screen while the beam pivots at its fixed origin.
  const sweepFrames = Array.from({length: 13}, (_, index) => {
    const progress = index / 12;
    return {transform: aim({
      x: sweepStart.x + (sweepEnd.x - sweepStart.x) * progress,
      y: sweepStart.y + (sweepEnd.y - sweepStart.y) * progress
    })};
  });
  animateEffect(track, sweepFrames, {
    delay: sweepDelay, duration: sweepDuration, easing: 'cubic-bezier(.42, 0, .35, 1)', fill: 'both'
  });
  animateEffect(ray, [
    {clipPath: 'inset(0 100% 0 0)', opacity: 1},
    {clipPath: 'inset(0)', opacity: 1, offset: sweepDelay / rayDuration},
    {clipPath: 'inset(0)', opacity: 1, offset: sweepEndTime / rayDuration},
    {clipPath: 'inset(0)', opacity: 0}
  ], {duration: rayDuration, fill: 'both'});
  animateEffect(flash, [
    {opacity: 0},
    {opacity: .82, offset: .16},
    {opacity: 0}
  ], {delay: sweepEndTime, duration: 165});
  animateEffect(cabinet, [
    {transform: 'translate(0, 0)'},
    {transform: 'translate(-7px, 5px)'},
    {transform: 'translate(7px, -4px)'},
    {transform: 'translate(-4px, 2px)'},
    {transform: 'translate(3px, -2px)'},
    {transform: 'translate(0, 0)'}
  ], {delay: sweepEndTime + 5, duration: 240});
  later(() => track.remove(), rayDuration);
  later(() => flash.remove(), sweepEndTime + 165);
}

kaijuBuildings.forEach(building => building.addEventListener('click', destroyKaijuBuilding));
kaijuCharge.addEventListener('click', fireKaijuBeam);
document.addEventListener('click', e => {
  const screen = screens[current];
  if ((screen !== 'ultima' && screen !== 'sushi' && screen !== 'kaiju') || e.button !== 0 || e.detail === 0 || e.defaultPrevented) return;
  if (document.querySelector('dialog[open]')) return;
  if (e.target.closest('a,button,input,textarea,select,label,summary,iframe,video,audio,[contenteditable],[role="button"],[role="link"],.video-frame,dialog')) return;
  if (screen === 'ultima') throwDart(e.clientX, e.clientY);
  else if (screen === 'sushi') showSushiPlate(e.clientX, e.clientY);
  else if (e.target.closest('#kaiju')) fireKaijuBeam();
});
function lightUp() {
  const samples = document.querySelector('#design-samples');
  samples.classList.add('lit');
  later(() => samples.classList.remove('lit'), 1400);
}
document.addEventListener('contextmenu', e => {
  if (document.querySelector('dialog[open]') || e.shiftKey || e.target.closest('a,button,input,textarea,select,.video-frame,dialog')) return;
  if (screens[current] !== 'ultima-design') return;
  e.preventDefault();
  lightUp();
});
showPageFromHash(false);
