// Navigate straight to the content page, without a selection dialog.
const chapterRoutes = {profile:'intro-profile',games:'ultima',documents:'documents',other:'other',contents:'contents'};
document.addEventListener('click', e => {
  if (e.target.closest('[data-go]')) return;
  const route = e.target.closest('[data-chapter]');
  if (route) showScreen(chapterRoutes[route.dataset.chapter]);
});

function drawRatingRadar(chart) {
  const canvas = chart.querySelector('canvas');
  const context = canvas.getContext('2d');
  if (!context) return;

  const scores = Array.from(chart.querySelectorAll('data'), item => Number(item.value));
  const maxScore = 5;
  const center = canvas.width / 2;
  const radius = center - 4;
  const directions = scores.map((_, index) => {
    const angle = (index / scores.length) * 2 * Math.PI;
    return [Math.sin(angle), -Math.cos(angle)];
  });

  function point(index, score) {
    const [x, y] = directions[index];
    const distance = radius * score / maxScore;
    return [center + x * distance, center + y * distance];
  }

  function tracePolygon(values) {
    context.moveTo(...point(0, values[0]));
    values.slice(1).forEach((value, index) => context.lineTo(...point(index + 1, value)));
    context.closePath();
  }

  context.beginPath();
  for (let level = 1; level <= maxScore; level++) {
    tracePolygon(scores.map(() => level));
  }
  directions.forEach((_, index) => {
    context.moveTo(center, center);
    context.lineTo(...point(index, maxScore));
  });
  context.strokeStyle = '#c9cecb';
  context.lineWidth = 2;
  context.stroke();

  context.beginPath();
  tracePolygon(scores);
  context.fillStyle = 'rgba(232, 86, 60, .42)';
  context.fill();
  context.strokeStyle = '#d66151';
  context.lineWidth = 3;
  context.stroke();
}

drawRatingRadar(document.querySelector('.rating-chart'));
