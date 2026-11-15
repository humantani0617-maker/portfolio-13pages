(() => {
  const spec = document.querySelector('#design-spec-dialog');
  const title = spec.querySelector('#design-spec-title');
  const enlargedImage = spec.querySelector('.image-dialog-content img');
  const footer = spec.querySelector('.dialog-footer');
  const download = footer.querySelector('a');
  const steps = spec.querySelector('.image-dialog-steps');
  const [previous, next] = steps.querySelectorAll('button');
  const stepCount = steps.querySelector('[role="status"]');
  const stages = Array.from(document.querySelectorAll('.kowloon-stages [data-design-image-title]'));
  let stageIndex = -1;

  function showImage(trigger) {
    const preview = trigger.querySelector('img');
    const fullSource = new URL(preview.dataset.fullSrc ?? preview.src, document.baseURI).href;
    title.textContent = trigger.dataset.designImageTitle;
    enlargedImage.width = Number(preview.dataset.fullWidth ?? preview.getAttribute('width'));
    enlargedImage.height = Number(preview.dataset.fullHeight ?? preview.getAttribute('height'));
    enlargedImage.alt = preview.dataset.fullAlt || preview.alt;
    enlargedImage.classList.toggle('pixel-art-enlarged', trigger.classList.contains('pixel-art-preview'));
    if (enlargedImage.src !== fullSource) enlargedImage.src = fullSource;
    const pdf = trigger.dataset.designImageDownload;
    footer.hidden = !pdf;
    if (pdf) download.href = pdf;
    else download.removeAttribute('href');

    stageIndex = stages.indexOf(trigger);
    steps.hidden = stageIndex === -1;
    if (steps.hidden) return;
    previous.setAttribute('aria-disabled', String(stageIndex === 0));
    next.setAttribute('aria-disabled', String(stageIndex === stages.length - 1));
    stepCount.textContent = `${stageIndex + 1} / ${stages.length}`;
  }

  function moveStage(direction) {
    const target = stages[stageIndex + direction];
    if (stageIndex !== -1 && target) showImage(target);
  }

  previous.addEventListener('click', () => moveStage(-1));
  next.addEventListener('click', () => moveStage(1));
  spec.addEventListener('keydown', event => {
    if (steps.hidden || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    moveStage(event.key === 'ArrowLeft' ? -1 : 1);
  });

  document.querySelectorAll('[data-design-image-title]').forEach(trigger => {
    trigger.addEventListener('click', () => {
      showImage(trigger);
      spec.showModal();
    });
  });
  const button = document.querySelector('#rotate-score');
  const canvas = button.querySelector('canvas');
  const poster = button.querySelector('img');
  const section = document.querySelector('#ultima-design');
  const turnHint = button.querySelector('.model-rotate-hint');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let loadingModel;
  let turning = false;
  let yaw = -.4;

  async function loadModel() {
    const gl = canvas.getContext('webgl', {alpha:true, antialias:true});
    if (!gl) throw new Error('WebGL unavailable');
    const mesh = await fetch('assets/ultima-design/score-seven.json').then(response => {
      if (!response.ok) throw new Error('Missing score model');
      return response.json();
    });
    const texture = new Image();
    texture.src = 'assets/ultima-design/score-texture.png';
    await texture.decode();

    function shader(type, code) {
      const compiled = gl.createShader(type);
      gl.shaderSource(compiled, code);
      gl.compileShader(compiled);
      if (!gl.getShaderParameter(compiled, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(compiled));
      }
      return compiled;
    }

    const program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, `
      attribute vec3 position, normal;
      attribute vec2 uv;
      uniform float yaw;
      varying mediump vec2 texcoord;
      varying mediump float shade;

      vec3 rotate(vec3 p) {
        float c = cos(yaw), s = sin(yaw);
        vec3 q = vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
        return vec3(q.x, .99156 * q.y + .12963 * q.z, -.12963 * q.y + .99156 * q.z);
      }

      void main() {
        vec3 p = rotate(position);
        float depth = 3.9 - p.z;
        gl_Position = vec4(3.1 * p.x * 420.0 / 360.0, 3.1 * p.y, depth - 3.5, depth);
        texcoord = uv;
        shade = .61 + .45 * abs(dot(rotate(normal), vec3(.3, .45, .84)));
      }
    `));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, `
      precision mediump float;
      uniform sampler2D atlas;
      varying mediump vec2 texcoord;
      varying mediump float shade;
      void main() {
        gl_FragColor = vec4(texture2D(atlas, texcoord).rgb * min(shade, 1.0) + .063, 1.0);
      }
    `));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh), gl.STATIC_DRAW);
    for (const [name, size, offset] of [['position', 3, 0], ['normal', 3, 12], ['uv', 2, 24]]) {
      const index = gl.getAttribLocation(program, name);
      gl.enableVertexAttribArray(index);
      gl.vertexAttribPointer(index, size, gl.FLOAT, false, 32, offset);
    }
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 0);
    const angle = gl.getUniformLocation(program, 'yaw');
    return rotation => {
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniform1f(angle, rotation);
      gl.drawArrays(gl.TRIANGLES, 0, mesh.length / 8);
    };
  }

  button.addEventListener('click', async () => {
    if (turning) return;
    turning = true;
    try {
      loadingModel ??= loadModel();
      const draw = await loadingModel;
      if (section.hidden) {
        turning = false;
        return;
      }
      canvas.hidden = false;
      poster.hidden = true;
      if (reduceMotion.matches) {
        yaw += Math.PI / 3;
        draw(yaw);
        turning = false;
        return;
      }
      const begin = performance.now();
      const update = now => {
        const progress = Math.min((now - begin) / 950, 1);
        if (!section.hidden && progress < 1) {
          draw(yaw + 2 * Math.PI * (1 - (1 - progress) ** 2));
          requestAnimationFrame(update);
        } else {
          draw(yaw);
          turning = false;
        }
      };
      draw(yaw);
      requestAnimationFrame(update);
    } catch {
      button.disabled = true;
      turnHint.hidden = true;
      turning = false;
    }
  });
})();
