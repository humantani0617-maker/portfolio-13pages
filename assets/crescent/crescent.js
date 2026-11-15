import {LayerStudio} from './renderer.js';
import {VoicePlayer} from './voice.js';

const work = document.querySelector('.web-work-motion');
const page = work.closest('.screen');
const canvas = work.querySelector('canvas');
const poster = work.querySelector('img');
const form = work.querySelector('form');
const line = form.querySelector('textarea');
const speak = form.querySelector('[type="submit"]');
const greeting = form.querySelector('.crescent-greeting');
const caption = work.querySelector('[role="status"]');
const song = document.querySelector('#pale-blue-rain');
const soundToggle = document.querySelector('.sound-toggle');
const audio = new URL('./greeting.wav', import.meta.url).href;
const score = new URL('./greeting.score.json', import.meta.url).href;
const muted = () => soundToggle.getAttribute('aria-pressed') === 'false';
const voiceApi = path => new URL('../../crescent-voice' + path, import.meta.url);
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
  const current = operation?.button;
  speak.disabled = current === greeting;
  greeting.disabled = current === speak;
  speak.textContent = current !== speak ? 'このセリフを話す'
    : operation.phase === 'playing' ? '再生を止める' : '生成を取り消す';
  greeting.textContent = current !== greeting ? '挨拶を聞く'
    : operation.phase === 'playing' ? '挨拶を止める' : '読み込みを取り消す';
}

function cancelJob(id) {
  if (id) void fetch(voiceApi('/api/jobs/' + id), {method: 'DELETE', keepalive: true}).catch(() => {});
}

function stop() {
  const previous = operation;
  operation = null;
  cancelJob(previous?.id);
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

async function requestJson(path, options) {
  let response;
  try { response = await fetch(voiceApi(path), options); }
  catch { throw new Error('音声スタジオに接続できません。'); }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    throw new Error(data?.error || '自由入力は、このPCのポートフォリオを起動してお試しください。');
  }
  return data;
}

async function generate(text, current) {
  const result = await requestJson('/api/speech', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({text}),
  });
  current.id = result.id;
  if (operation !== current) {
    cancelJob(result.id);
    return null;
  }
  const deadline = performance.now() + 180000;
  while (operation === current && performance.now() < deadline) {
    const job = await requestJson('/api/jobs/' + current.id);
    if (operation !== current) return null;
    if (job.status === 'ready') {
      current.id = undefined;
      return player.load({audio: voiceApi(job.audio), score: voiceApi(job.score)});
    }
    if (job.status === 'error' || job.status === 'cancelled') throw new Error(job.message);
    caption.textContent = job.message;
    await new Promise(resolve => setTimeout(resolve, 750));
  }
  if (operation === current) throw new Error('生成に時間がかかっています。短いセリフでもう一度お試しください。');
  return null;
}

async function play(button, text) {
  if (operation) {
    if (operation.button === button) stop();
    return;
  }
  if (muted()) {
    caption.textContent = '再生するには、右上のサウンドをオンにしてください。';
    return;
  }
  if (button === speak && !text) {
    caption.textContent = '話してほしいセリフを入力してください。';
    line.focus();
    return;
  }
  const current = {button, phase: 'loading'};
  operation = current;
  refreshButtons();
  caption.textContent = text ? '音声スタジオに接続中…' : '挨拶を読み込み中…';
  try {
    await player.unlock();
    if (operation !== current) return;
    if (!text) sample ??= await player.load({audio, score});
    const speech = text ? await generate(text, current) : sample;
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
      cancelJob(current.id);
      operation = null;
      refreshButtons();
    }
  }
}

form.addEventListener('submit', event => {
  event.preventDefault();
  void play(speak, line.value.trim());
});
greeting.addEventListener('click', () => void play(greeting));

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
