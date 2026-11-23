import {LayerStudio} from './renderer.js';
import {VoicePlayer} from './voice.js';

const work = document.querySelector('.web-work-motion');
const page = work.closest('.screen');
const canvas = work.querySelector('canvas');
const poster = work.querySelector('img');
const greeting = work.querySelector('.crescent-greeting');
const caption = work.querySelector('[role="status"]');
const song = document.querySelector('#pale-blue-rain');
const soundToggle = document.querySelector('.sound-toggle');
const audio = new URL('./greeting.wav', import.meta.url).href;
const score = new URL('./greeting.score.json', import.meta.url).href;
const muted = () => soundToggle.getAttribute('aria-pressed') === 'false';
const isVisible = () => !page.hidden && !document.hidden;

let studio;
let sample;
let transcript = '';
let operation;
let inView = false;
let initialised = false;
let frame;

const player = new VoicePlayer(playing => {
  if (playing) caption.textContent = transcript;
  else if (operation?.phase === 'playing') {
    operation = null;
    caption.textContent = transcript;
  }
  refreshButtons();
});

function refreshButtons() {
  greeting.disabled = false;
  greeting.textContent = !operation ? '挨拶を聞く'
    : operation.phase === 'playing' ? '挨拶を止める' : '読み込みを取り消す';
}

function stop() {
  const previous = operation;
  operation = null;
  if (player.playing) player.stop();
  if (studio) studio.mouth = 0;
  if (previous) caption.textContent = '';
  refreshButtons();
}

function updateVisibility() {
  if (studio) {
    studio.paused = !inView || page.hidden || document.hidden;
    if (studio.paused) studio.finishPetDrag();
  }
  if (page.hidden || document.hidden) stop();
}

function animateMouth() {
  studio.mouth = player.sample();
  studio.mouthWidth = player.width;
  frame = requestAnimationFrame(animateMouth);
}

async function start() {
  initialised = true;
  try {
    studio = await new LayerStudio(canvas).init();
    studio.zoom = 1.14;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      studio.bodySway = studio.breath = studio.wind = 0;
      studio.tracking = false;
      studio.autoBlink = false;
    }
    canvas.tabIndex = 0;
    canvas.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      if (!event.repeat) studio.pet();
    });
    poster.hidden = true;
    updateVisibility();
    animateMouth();
  } catch (error) {
    console.error(error);
    canvas.hidden = true;
    caption.textContent = 'このブラウザでは立ち絵のアニメーションを表示できません。';
  } finally {
    refreshButtons();
  }
}

async function playGreeting() {
  if (operation) {
    stop();
    return;
  }
  if (muted()) {
    caption.textContent = '再生するには、右上のサウンドをオンにしてください。';
    return;
  }
  const current = {phase: 'loading'};
  operation = current;
  refreshButtons();
  caption.textContent = '挨拶を読み込み中…';
  try {
    await player.unlock();
    if (operation !== current) return;
    sample ??= await player.load({audio, score});
    const speech = sample;
    if (!speech || operation !== current || !isVisible() || muted()) return;
    transcript = speech.score.characters.map(character => character.text).join('');
    song.pause();
    await player.play(speech, () => operation === current && isVisible() && !muted());
    if (operation === current && player.playing) {
      current.phase = 'playing';
      refreshButtons();
    }
  } catch (error) {
    if (operation === current) caption.textContent = error.message || '再生できませんでした。もう一度お試しください。';
  } finally {
    if (operation === current && current.phase === 'loading') {
      operation = null;
      refreshButtons();
    }
  }
}

greeting.addEventListener('click', () => void playGreeting());

song.addEventListener('play', stop);
new MutationObserver(() => { if (muted()) stop(); })
  .observe(soundToggle, {attributes: true, attributeFilter: ['aria-pressed']});
new MutationObserver(updateVisibility).observe(page, {attributes: true, attributeFilter: ['hidden']});
new IntersectionObserver(([entry]) => {
  inView = entry.isIntersecting;
  if (inView && !initialised) void start();
  updateVisibility();
}).observe(canvas);
for (const type of ['touchstart', 'touchend', 'touchcancel']) {
  canvas.addEventListener(type, event => event.stopPropagation(), {passive: true});
}
document.addEventListener('visibilitychange', updateVisibility);
window.addEventListener('pagehide', event => {
  stop();
  if (!event.persisted) {
    cancelAnimationFrame(frame);
    player.dispose();
    studio?.dispose();
  }
});
