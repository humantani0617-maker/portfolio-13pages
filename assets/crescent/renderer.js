const VERTEX = `precision highp float;
attribute vec2 aUV;
varying mediump vec2 vUV;
uniform vec4 uRect;
uniform vec2 uFit;
uniform vec2 uHeadPose;
uniform vec3 uBodyPose;
uniform float uTime, uZoom, uWind, uHead, uHair, uMouthScale, uMouthWidth;
uniform float uRigidStaff, uFootwear, uHatStar;
uniform float uStarAngle;

vec2 rotateAround(vec2 point, vec2 pivot, float angle) {
    vec2 local = point - pivot;
    float sine = sin(angle);
    float cosine = cos(angle);
    return pivot + vec2(local.x * cosine - local.y * sine, local.x * sine + local.y * cosine);
}

void main() {
    vUV = aUV;
    vec2 p = uRect.xy + aUV * uRect.zw;
    p += (aUV - .5) * uRect.zw * (vec2(uMouthWidth, uMouthScale) - 1.);
    p = rotateAround(p, vec2(.7355, .215), uStarAngle * uHatStar);
    vec2 neck = vec2(.505, .398);
    p.y = neck.y + (p.y - neck.y) * (1. + uHeadPose.y * uHead);
    p = rotateAround(p, neck, uHeadPose.x * uHead);

    float looseEnd = smoothstep(.18, .95, aUV.y);
    p.x += sin(uTime * 1.5 + aUV.y * 2.1 + uRect.x * 5.) * uHair * uWind * .007 * looseEnd;
    p.y += sin(uTime * 1.1 + aUV.x * 4.) * uHair * uWind * .0025 * looseEnd;

    vec2 feetPivot = vec2(.505, .905);
    float stance = (1. - smoothstep(.64, .825, p.y)) * (1. - uFootwear);
    // Legs ease into the planted boots, while the staff keeps its rigid shape.
    p = mix(p, rotateAround(p, feetPivot, uBodyPose.x) + uBodyPose.yz, max(stance, uRigidStaff));
    gl_Position = vec4((p.x - .5) * uFit.x * uZoom, - (p.y - .5) * uFit.y * uZoom + .035, 0., 1.);
}
`;
const FRAGMENT = `precision highp float;
varying mediump vec2 vUV;
uniform sampler2D uTexture, uEyeMask;
uniform vec4 uRect, uIrisRect;
uniform vec2 uGaze;
uniform float uOpacity, uIris;

void main() {
    vec4 c;
    if (uIris > .5) {
        vec2 point = uRect.xy + vUV * uRect.zw;
        vec2 irisUV = (point - uIrisRect.xy - uGaze) / uIrisRect.zw;
        if (any(lessThan(irisUV, vec2(0.))) || any(greaterThan(irisUV, vec2(1.)))) discard;
        c = texture2D(uTexture, irisUV) * texture2D(uEyeMask, vUV).a;
    } else {
        c = texture2D(uTexture, vUV);
    }
    gl_FragColor = c * uOpacity;
}`;

const NECK = [.505, .398];
const FEET = [.505, .905];
const TOP_OF_HAT = [.7355, .215];
const EYES = [.505, .336];
const PET_DURATION = 1.20;
const DRAG_THRESHOLD = 5;
const STROKE_LINGER = .27;
const TILT_DURATION = 1.25;
const BODY_TARGETS = new Set(['topwear', 'bottomwear', 'handwear-l', 'handwear-r', 'repair body']);
const clamp = value => Math.max(-1, Math.min(1, value));
const ease = (start, end, value) => {
    const t = Math.min(1, Math.max(0, (value - start) / (end - start)));
    return t * t * (3 - 2 * t);
};

function rotate([x, y], [cx, cy], angle) {
    const sine = Math.sin(angle);
    const cosine = Math.cos(angle);
    return [cx + (x - cx) * cosine - (y - cy) * sine, cy + (x - cx) * sine + (y - cy) * cosine];
}

function compile(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));
    return shader;
}

async function loadTexture(gl, url) {
    const im = new Image();
    im.src = new URL(url, import.meta.url).href;
    await im.decode();
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
    return {texture, image: im};
}

function readAlpha(image) {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', {willReadFrequently: true});
    context.drawImage(image, 0, 0);
    return context.getImageData(0, 0, canvas.width, canvas.height);
}

function alphaAt(mask, u, v) {
    const x = Math.floor(u * mask.width);
    const y = Math.floor(v * mask.height);
    return x >= 0 && x < mask.width && y >= 0 && y < mask.height
        ? mask.data[(y * mask.width + x) * 4 + 3]
        : 0;
}

function hitsLayer(layer, [x, y]) {
    const [left, top, width, height] = layer.rect;
    return alphaAt(layer.pickMask, (x - left) / width, (y - top) / height) >= 96;
}

const isHatStar = id => id.startsWith('hat-star');
const isHeadTarget = id => ['headwear', 'front hair', 'back hair', 'face', 'repair head'].includes(id)
    || isHatStar(id);

export class LayerStudio {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl', {alpha: true, antialias: true, preserveDrawingBuffer: true});
        if (!this.gl) throw Error('WebGLを起動できません。ハードウェアアクセラレーションを有効にしてください。');
        this.time = 0;
        this.paused = false;
        this.wind = .5;
        this.bodySway = .7;
        this.breath = .35;
        this.zoom = 1;
        this.tracking = true;
        this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.autoBlink = true;
        this.mouth = 0;
        this.look = [0, 0];
        this.blinkAt = -10;
        this.nextBlink = 3;
        this.nodAt = -10;
        this.petAt = -10;
        this.petFrom = 0;
        this.petDrag = null;
        this.suppressDragClick = false;
        this.strokeAmount = 0;
        this.strokeLean = 0;
        this.tiltAt = -10;
        this.tiltFrom = 0;
        this.tiltDirection = 1;
        this.original = false;
        this.handlers = new AbortController();
    }

    async init() {
        const gl = this.gl;
        const response=await fetch(new URL('./assets/rig.json', import.meta.url));if(!response.ok)throw Error('パーツ素材がありません。分解・素材出力が完了しているか確認してください。');this.rig=await response.json();
        const program = gl.createProgram();
        gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
        gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
        gl.useProgram(program);
        const names = [
            'uRect', 'uFit', 'uTime', 'uZoom', 'uWind', 'uHead', 'uHair', 'uMouthScale',
            'uMouthWidth', 'uRigidStaff', 'uFootwear', 'uHatStar', 'uBodyPose', 'uHeadPose',
            'uStarAngle', 'uTexture', 'uEyeMask', 'uOpacity', 'uIris', 'uIrisRect', 'uGaze',
        ];
        this.u = Object.fromEntries(names.map(name => [name, gl.getUniformLocation(program, name)]));
        this.makeMesh(program);
        this.layers = [];
        for (const layer of this.rig.layers) {
            const {texture, image} = await loadTexture(gl, layer.url);
            const pickMask = isHeadTarget(layer.id) || BODY_TARGETS.has(layer.id) || layer.id === 'staff'
                ? readAlpha(image) : null;
            this.layers.push({...layer, texture, pickMask, visible: true});
        }
        for (const layer of this.layers.filter(layer => layer.id.startsWith('irides-'))) {
            layer.eyeMask = this.layers.find(mask => mask.id === layer.id.replace('irides-', 'eyewhite-'));
        }
        this.source = {id: 'source', rect: [0, 0, 1, 1], ...(await loadTexture(gl, 'assets/source.png')), visible: true};
        gl.uniform1i(this.u.uTexture, 0);
        gl.uniform1i(this.u.uEyeMask, 1);
        gl.clearColor(0, 0, 0, 0);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        this.observer = new ResizeObserver(() => this.resize());
        this.observer.observe(this.canvas);
        this.resize();
        this.bindPointer();
        this.frame = requestAnimationFrame(now => this.tick(now));
        return this;
    }

    makeMesh(program) {
        const gl = this.gl;
        const vertices = [];
        const indices = [];
        const divisions = 24;
        for (let y = 0; y <= divisions; y++) {
            for (let x = 0; x <= divisions; x++) vertices.push(x / divisions, y / divisions);
        }
        for (let y = 0; y < divisions; y++) {
            for (let x = 0; x < divisions; x++) {
                const i = y * (divisions + 1) + x;
                indices.push(i, i + 1, i + divisions + 1, i + 1, i + divisions + 2, i + divisions + 1);
            }
        }
        this.count = indices.length;
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
        const location = gl.getAttribLocation(program, 'aUV');
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    }

    resize() {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = Math.min(devicePixelRatio || 1, 2);
        this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
        this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    get scale() {
        return Math.min(this.canvas.width * .96, this.canvas.height * .94);
    }

    bindPointer() {
        const options = {signal: this.handlers.signal};
        this.canvas.addEventListener('pointerdown', event => {
            if (!event.isPrimary || event.button !== 0 || this.paused || this.petDrag) return;
            this.suppressDragClick = false;
            if (this.targetAt(event.clientX, event.clientY)?.zone !== 'head') return;
            const point = [event.clientX, event.clientY];
            this.petDrag = {id: event.pointerId, start: point, point, movedAt: -Infinity, direction: 0};
            this.canvas.setPointerCapture(event.pointerId);
        }, options);
        this.canvas.addEventListener('pointermove', event => {
            if (event.pointerType !== 'touch') this.pointer = [event.clientX, event.clientY];
            const drag = this.petDrag;
            if (!drag || drag.id !== event.pointerId || this.paused) return;
            if (!(event.buttons & 1)) {
                this.finishPetDrag(event.pointerId);
                return;
            }
            const point = [event.clientX, event.clientY];
            const [x, y] = point;
            if (!this.suppressDragClick && Math.hypot(x - drag.start[0], y - drag.start[1]) < DRAG_THRESHOLD) return;
            const dx = x - drag.point[0];
            const dy = y - drag.point[1];
            drag.point = point;
            this.suppressDragClick = true;
            if (this.targetAt(x, y)?.zone !== 'head') {
                drag.movedAt = -Infinity;
                return;
            }
            if (Math.hypot(dx, dy) < .5) return;
            drag.movedAt = this.time;
            drag.direction = clamp(dx / 4);
        }, options);
        this.canvas.addEventListener('pointerleave', () => {
            this.pointer = null;
            this.canvas.style.cursor = '';
        }, options);
        this.canvas.addEventListener('click', event => {
            if (this.paused || (event.detail > 0 && this.suppressDragClick)) return;
            const hit = this.targetAt(event.clientX, event.clientY);
            if (hit?.zone === 'head') this.pet();
            if (hit?.zone === 'body') this.tiltHead(hit.x < NECK[0] ? -1 : 1);
        }, options);
        for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
            this.canvas.addEventListener(type, event => this.finishPetDrag(event.pointerId), options);
        }
        this.canvas.addEventListener('contextmenu', event => {
            if (this.petDrag && this.targetAt(event.clientX, event.clientY)?.zone === 'head') {
                event.preventDefault();
            }
        }, options);
        window.addEventListener('blur', () => this.finishPetDrag(), options);
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.finishPetDrag();
        }, options);
    }

    finishPetDrag(pointerId = this.petDrag?.id) {
        if (!this.petDrag || this.petDrag.id !== pointerId) return;
        this.petDrag = null;
        if (this.canvas.hasPointerCapture(pointerId)) this.canvas.releasePointerCapture(pointerId);
    }

    canvasPoint(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        const size = this.scale * this.zoom;
        const x = (clientX - rect.left) / rect.width;
        const y = (clientY - rect.top) / rect.height;
        return [.5 + (x - .5) * this.canvas.width / size,
            .5 + (y - .4825) * this.canvas.height / size];
    }

    pose() {
        const time = this.original ? 0 : this.time;
        const breath = this.original ? 0 : this.breath;
        const wind = this.original ? 0 : this.wind;
        const sway = this.original ? 0 : this.bodySway;
        const petTime = this.original ? -1 : time - this.petAt;
        const tap = petTime < 0 ? 0 : (this.petFrom + (1 - this.petFrom) * ease(0, .23, petTime))
            * (1 - ease(.76, PET_DURATION, petTime));
        const stroke = this.original ? 0 : this.strokeAmount;
        const pet = Math.max(tap, stroke);
        const nodTime = this.original ? -1 : time - this.nodAt;
        const nod = nodTime >= 0 && nodTime < .9 ? Math.sin(nodTime / .9 * Math.PI * 2) : 0;
        const press = this.reducedMotion ? 0 : pet;
        const tiltTime = this.original ? -1 : time - this.tiltAt;
        const tilt = tiltTime < 0 ? 0 :
            (this.tiltFrom + (this.tiltDirection - this.tiltFrom) * ease(0, .33, tiltTime))
            * (1 - ease(.63, TILT_DURATION, tiltTime));
        return {
            pet,
            tilt,
            head: [Math.sin(time * .62) * .013 * breath - press * .026
                + (this.reducedMotion ? 0 : this.strokeLean * .046 * stroke)
                + tilt * (this.reducedMotion ? .045 : .13), -press * .067 - nod * .044],
            body: [(Math.sin(time * .88) * .042 + Math.sin(time * .40) * .011) * sway,
                Math.sin(time * .88) * .016 * sway,
                Math.sin(time * 1.05) * .0033 * sway + Math.sin(time * 1.55) * .003 * breath],
            star: Math.sin(time * 1.8 - .6) * .14 * wind
                + (this.reducedMotion ? 0 : tap * Math.sin(petTime * 16) * .17 + this.strokeLean * stroke * .14),
        };
    }

    targetAt(clientX, clientY) {
        if (this.original) return null;
        const {body, head, star} = this.drawnPose ?? this.pose();
        const [angle, dx, dy] = body;
        const [x, y] = this.canvasPoint(clientX, clientY);
        const point = rotate([x - dx, y - dy], FEET, -angle);
        const [hx, hy] = rotate(point, NECK, -head[0]);
        const modelPoint = [hx, NECK[1] + (hy - NECK[1]) / (1 + head[1])];
        const targets = this.layers.filter(layer => layer.visible && layer.pickMask);
        // The staff is in front of the costume, with the gripping hand above it.
        for (const id of ['handwear-r', 'staff']) {
            const layer = targets.find(candidate => candidate.id === id);
            if (layer && hitsLayer(layer, point)) {
                return id === 'staff' ? null : {zone: 'body', x: point[0]};
            }
        }
        const headHit = targets.some(layer => {
            if (!isHeadTarget(layer.id)) return false;
            const [px, py] = isHatStar(layer.id) ? rotate(modelPoint, TOP_OF_HAT, -star) : modelPoint;
            return hitsLayer(layer, [px, py]);
        });
        if (headHit) return {zone: 'head'};

        // Undo the torso's sway, including the taper used below the waist.
        let torso = point;
        for (let attempt = 0; attempt < 3; attempt++) {
            const weight = 1 - ease(.64, .825, torso[1]);
            const [movedX, movedY] = rotate(torso, FEET, angle);
            torso = [x - (movedX + dx - torso[0]) * weight, y - (movedY + dy - torso[1]) * weight];
        }
        if (torso[1] > .72) return null;
        return targets.some(layer => layer.id !== 'handwear-r' && BODY_TARGETS.has(layer.id) && hitsLayer(layer, torso))
            ? {zone: 'body', x: torso[0]} : null;
    }

    tick(now) {
        const dt = Math.min((now - (this.lastFrame ?? now)) / 1000, .05);
        this.lastFrame = now;
        if (!this.paused && !document.hidden) {
            this.time += dt;
            this.updateStroke(dt);
            if (this.autoBlink && this.time > this.nextBlink) {
                this.blink();
                this.nextBlink = this.time + 2.6 + Math.random() * 3.5;
            }
            let target = [0, 0];
            if (this.pointer && this.tracking) {
                const [x, y] = this.canvasPoint(...this.pointer);
                target = [clamp((x - EYES[0]) / .37), clamp((y - EYES[1]) / .37)];
            }
            const easeToTarget = 1 - Math.exp(-dt * 13);
            for (let i = 0; i < 2; i++) this.look[i] += (target[i] - this.look[i]) * easeToTarget;
        } else {
            this.finishPetDrag();
        }
        this.draw();
        this.canvas.style.cursor = !this.paused && this.pointer && this.targetAt(...this.pointer)
            ? 'pointer' : '';
        this.frame = requestAnimationFrame(time => this.tick(time));
    }

    updateStroke(dt) {
        const drag = this.petDrag;
        const stroking = drag && this.time - drag.movedAt < STROKE_LINGER;
        const target = stroking ? 1 : 0;
        const nextAmount = this.strokeAmount + (target - this.strokeAmount)
            * (1 - Math.exp(-dt * (stroking ? 22 : 8)));
        this.strokeAmount = Math.abs(nextAmount - target) < .008 ? target : nextAmount;
        const lean = stroking ? drag.direction : 0;
        this.strokeLean += (lean - this.strokeLean) * (1 - Math.exp(-dt * 10));
        if (stroking) this.nextBlink = Math.max(this.nextBlink, this.time + .65);
    }

    blink() {
        this.blinkAt = this.time;
    }

    nod() {
        this.nodAt = this.time;
    }

    pet() {
        if (this.paused || this.original) return;
        this.petFrom = this.pose().pet;
        this.petAt = this.time;
        this.nextBlink = Math.max(this.nextBlink, this.time + PET_DURATION + .55);
    }

    tiltHead(direction = 1) {
        if (this.paused || this.original) return;
        this.tiltFrom = this.pose().tilt;
        this.tiltAt = this.time;
        this.tiltDirection = direction;
    }

    draw() {
        const gl = this.gl;
        const u = this.u;
        const {width, height} = this.canvas;
        const pose = this.pose();
        this.drawnPose = pose;
        const blinkTime = this.time - this.blinkAt;
        const blink = blinkTime >= 0 && blinkTime < .28 ? Math.sin(blinkTime / .28 * Math.PI) : 0;
        this.blinkAmount = this.original ? 0 : Math.max(blink, pose.pet);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform2f(u.uFit, 2 * this.scale / width, 2 * this.scale / height);
        gl.uniform1f(u.uZoom, this.zoom);
        gl.uniform1f(u.uTime, this.original ? 0 : this.time);
        gl.uniform1f(u.uWind, this.original ? 0 : this.wind);
        gl.uniform2fv(u.uHeadPose, pose.head);
        gl.uniform3fv(u.uBodyPose, pose.body);
        gl.uniform1f(u.uStarAngle, pose.star);
        gl.uniform2f(u.uGaze, this.look[0] * .0045, this.look[1] * .0019);
        const layers = this.original ? [this.source] : this.layers;
        for (const layer of layers) {
            if (layer.visible) this.drawLayer(layer);
        }
    }

    drawLayer(layer) {
        const gl = this.gl;
        const u = this.u;
        const mouthOpacity = Math.min(1, this.mouth * 5);
        const opacity = {
            eye: 1 - this.blinkAmount,
            lid: this.blinkAmount,
            talk: mouthOpacity,
            'mouth-clean': mouthOpacity,
        }[layer.role] ?? 1;
        if (opacity < .005) return;
        const speaking = layer.role === 'talk';
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, layer.texture);
        gl.uniform1f(u.uIris, layer.eyeMask ? 1 : 0);
        gl.uniform4fv(u.uRect, layer.eyeMask?.rect ?? layer.rect);
        if (layer.eyeMask) {
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, layer.eyeMask.texture);
            gl.uniform4fv(u.uIrisRect, layer.rect);
        }
        gl.uniform1f(u.uHead, layer.head ?? 0);
        gl.uniform1f(u.uRigidStaff, Number(layer.id === 'staff'));
        gl.uniform1f(u.uFootwear, Number(layer.id.startsWith('footwear')));
        gl.uniform1f(u.uHatStar, Number(isHatStar(layer.id)));
        gl.uniform1f(u.uHair, layer.hair ?? 0);
        gl.uniform1f(u.uMouthScale, speaking ? .20 + this.mouth * .80 : 1);
        gl.uniform1f(u.uMouthWidth, speaking ? (this.mouthWidth || 1) : 1);
        gl.uniform1f(u.uOpacity, opacity);
        gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
    }

    async capture() {
        this.draw();
        return new Promise(resolve => this.canvas.toBlob(resolve, 'image/png'));
    }

    dispose() {
        this.finishPetDrag();
        cancelAnimationFrame(this.frame);
        this.observer?.disconnect();
        this.handlers.abort();
    }
}
