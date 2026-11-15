const introScreen = document.querySelector('#intro');
const introMachine = introScreen.querySelector('.intro-machine');
const introLever = document.querySelector('#intro-lever');
const introStatus = document.querySelector('#intro-status');
const introReels = Array.from(introScreen.querySelectorAll('.intro-reel'));
const introLights = Array.from(introScreen.querySelectorAll('.intro-stop-lights i'));
const reelSymbols = ['target', 'seven', 'pad', 'diamond'];
const reelStartOffsets = [0, 1, 3];

introReels.forEach((reel, index) => {
  const track = document.createElement('div');
  track.className = 'intro-track';
  const offset = reelStartOffsets[index];
  // Repeat the first visible rows after one revolution for a seamless loop.
  for (let row = -1; row <= reelSymbols.length + 1; row++) {
    const symbol = reelSymbols[(offset + row + reelSymbols.length) % reelSymbols.length];
    const cell = document.createElement('span');
    cell.className = `intro-symbol intro-symbol-${symbol}`;
    cell.append(symbol === 'seven' ? '7' : document.createElement('i'));
    track.append(cell);
  }
  reel.style.setProperty('--reel-speed', `${270 + index * 45}ms`);
  const stopRow = (reelSymbols.indexOf('pad') - offset + reelSymbols.length) % reelSymbols.length;
  reel.style.setProperty('--stop-index', stopRow);
  reel.append(track);
});

introScreen.addEventListener('introreset', () => {
  introMachine.dataset.phase = 'ready';
  introLever.removeAttribute('aria-disabled');
  introReels.forEach(reel => reel.classList.remove('is-spinning', 'is-stopped'));
  introLights.forEach(light => light.classList.remove('is-stopped'));
  introStatus.textContent = '';
});

introLever.addEventListener('click', () => {
  if (introMachine.dataset.phase !== 'ready') return;
  readyAudio();
  introLever.setAttribute('aria-disabled', 'true');
  introMachine.dataset.phase = 'spinning';
  introStatus.textContent = 'リール回転中';
  introReels.forEach(reel => reel.classList.add('is-spinning'));

  const stopTimes = reducedMotion.matches ? [100, 220, 340] : [880, 1420, 1960];
  introReels.forEach((reel, index) => {
    later(() => {
      reel.classList.replace('is-spinning', 'is-stopped');
      introLights[index].classList.add('is-stopped');
    }, stopTimes[index]);
  });

  const revealTime = stopTimes.at(-1) + (reducedMotion.matches ? 60 : 230);
  later(() => {
    introMachine.dataset.phase = 'revealed';
    introStatus.textContent = 'ゲームのアイコンが揃いました。ポートフォリオを開きます。';
    hitSound();
  }, revealTime);
  later(() => showScreen('contents'), revealTime + (reducedMotion.matches ? 650 : 1560));
});
