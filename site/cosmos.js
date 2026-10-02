(function () {
  'use strict';
  const starsCanvas = document.getElementById('starfield');
  const coreCanvas = document.getElementById('coreCanvas');
  const core = document.querySelector('.computer-visual');
  if (!starsCanvas || !coreCanvas || !core) return;
  const starsContext = starsCanvas.getContext('2d');
  const ctx = coreCanvas.getContext('2d');
  if (!starsContext || !ctx) return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const palettes = { neutral: [131, 221, 255], pending: [255, 205, 139], awake: [146, 255, 217] };
  let width = 1, height = 1, size = 1, raf = 0, lastFrame = -Infinity;
  let pointerX = 0, pointerY = 0, smoothX = 0, smoothY = 0;
  let clock = 0, lastTime = null;
  let seed = 6127;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const stars = Array.from({ length: 280 }, () => ({ x: random(), y: random(), r: random() * .9 + .2, a: random() * .6 + .12, phase: random() * Math.PI * 2, depth: random() }));
  const points = Array.from({ length: 480 }, (_, i) => {
    const y = 1 - (i / 479) * 2;
    const radius = Math.sqrt(1 - y * y);
    const angle = i * Math.PI * (3 - Math.sqrt(5));
    return { x: Math.cos(angle) * radius, y, z: Math.sin(angle) * radius, phase: random() * Math.PI * 2 };
  });
  const links = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const a = points[i], b = points[j];
      const distance = (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
      if (distance < .049 && random() > .24) links.push([i, j]);
    }
  }

  function resizeCanvas(canvas, context, w, h) {
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  function resize() {
    width = starsCanvas.clientWidth;
    height = starsCanvas.clientHeight;
    size = core.clientWidth;
    resizeCanvas(starsCanvas, starsContext, width, height);
    resizeCanvas(coreCanvas, ctx, size, size);
    draw(clock);
  }
  function rotate(point, yaw, tilt = -.24, roll = -.3) {
    const x = point.x * Math.cos(yaw) + point.z * Math.sin(yaw);
    const z = -point.x * Math.sin(yaw) + point.z * Math.cos(yaw);
    const y = point.y * Math.cos(tilt) - z * Math.sin(tilt);
    const depth = point.y * Math.sin(tilt) + z * Math.cos(tilt);
    return { x: x * Math.cos(roll) - y * Math.sin(roll), y: x * Math.sin(roll) + y * Math.cos(roll), z: depth };
  }
  function project(point, radius) {
    const scale = 3.8 / (3.8 - point.z * .16);
    return { x: size / 2 + point.x * radius * scale, y: size / 2 + point.y * radius * scale, z: point.z };
  }
  function drawStars(t) {
    starsContext.clearRect(0, 0, width, height);
    for (const star of stars) {
      const drift = motion.matches ? 0 : t * .0007 * (star.depth + .2);
      const x = ((star.x + drift) % 1) * width + smoothX * (star.depth + .2) * 7;
      const y = ((star.y + drift * .08) % 1) * height + smoothY * (star.depth + .2) * 5;
      const alpha = star.a * (.76 + Math.sin(t * .45 + star.phase) * .18);
      starsContext.fillStyle = `rgba(182,213,255,${alpha})`;
      starsContext.beginPath(); starsContext.arc(x, y, star.r, 0, Math.PI * 2); starsContext.fill();
      if (star.r > .95) {
        starsContext.strokeStyle = `rgba(192,227,255,${alpha * .18})`;
        starsContext.lineWidth = .5;
        starsContext.beginPath(); starsContext.moveTo(x - 3, y); starsContext.lineTo(x + 3, y); starsContext.moveTo(x, y - 3); starsContext.lineTo(x, y + 3); starsContext.stroke();
      }
    }
  }
  function drawCore(t) {
    ctx.clearRect(0, 0, size, size);
    const color = palettes[core.dataset.state] || palettes.neutral;
    const rgb = color.join(',');
    const radius = size * .302;
    const yaw = t * .065 + smoothX * .1;
    const tilt = -.24 + smoothY * .08;
    const projected = points.map(point => project(rotate(point, yaw, tilt), radius));
    // Three inclined orbital paths. Draw the far arcs before the sphere.
    const orbits = [0, 1, 2].map(index => {
      const angle = index * .95 + .4;
      const ring = [];
      for (let step = 0; step <= 120; step++) {
        const theta = step / 120 * Math.PI * 2;
        ring.push(project(rotate({ x: Math.cos(theta) * 1.39, y: Math.sin(theta) * 1.39, z: 0 }, angle, .98 + index * .28, -.35 + index * .74), radius));
      }
      return ring;
    });
    function orbitArcs(front) {
      orbits.forEach((ring, index) => {
        ctx.strokeStyle = `rgba(${rgb},${front ? .38 - index * .06 : .09})`;
        ctx.lineWidth = index === 0 ? .9 : .6;
        ctx.beginPath();
        let drawing = false;
        ring.forEach(point => {
          if ((point.z >= 0) === front) { if (drawing) ctx.lineTo(point.x, point.y); else ctx.moveTo(point.x, point.y); drawing = true; } else drawing = false;
        });
        ctx.stroke();
      });
    }
    orbitArcs(false);
    const energy = ctx.createRadialGradient(size * .43, size * .4, 0, size / 2, size / 2, radius);
    energy.addColorStop(0, `rgba(${rgb},.04)`); energy.addColorStop(.82, `rgba(${rgb},.008)`); energy.addColorStop(.98, `rgba(${rgb},.05)`); energy.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = energy;ctx.beginPath();ctx.arc(size / 2,size / 2,radius,0,Math.PI*2);ctx.fill();
    // Moving energy filaments stay on the near hemisphere of the neural core.
    for (let ribbon = 0; ribbon < 4; ribbon++) {
      ctx.beginPath();
      for (let step = 0; step <= 75; step++) {
        const longitude = -.5 * Math.PI + step / 75 * Math.PI;
        const latitude = -.55 + ribbon * .34 + Math.sin(longitude * 2 + t * .25 + ribbon) * .13;
        const point = project(rotate({ x: Math.cos(latitude) * Math.sin(longitude), y: Math.sin(latitude), z: Math.cos(latitude) * Math.cos(longitude) }, .1, -.35, -.35), radius * .985);
        if (step === 0) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y);
      }
      ctx.strokeStyle = `rgba(${rgb},${.1 + Math.sin(t * .35 + ribbon) * .035})`;
      ctx.lineWidth = .8;
      ctx.stroke();
    }
    for (const [aIndex, bIndex] of links) {
      const a = projected[aIndex], b = projected[bIndex];
      const depth = (a.z + b.z) / 2;
      if (depth < -.1) continue;
      const shimmer = .65 + Math.sin(t * .6 + points[aIndex].phase) * .35;
      ctx.strokeStyle = `rgba(${rgb},${(.05 + depth * .23) * shimmer})`;
      ctx.lineWidth = .55;
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
    }
    projected.forEach((point, index) => {
      if (point.z < -.25) return;
      const intensity = .4 + Math.sin(t * .9 + points[index].phase) * .3;
      const alpha = (.14 + Math.max(0, point.z) * .7) * intensity;
      ctx.fillStyle = `rgba(${rgb},${alpha})`;
      ctx.beginPath();ctx.arc(point.x,point.y,.55 + Math.max(0,point.z) * .7,0,Math.PI*2);ctx.fill();
      if (index % 37 === 0 && point.z > .2) {
        const glow = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, 7);
        glow.addColorStop(0,`rgba(${rgb},${alpha * .6})`);glow.addColorStop(1,`rgba(${rgb},0)`);
        ctx.fillStyle=glow;ctx.fillRect(point.x-7,point.y-7,14,14);
      }
    });
    orbitArcs(true);
    orbits.forEach((ring, index) => {
      const head = Math.floor((t * (3 + index) + index * 37) % 120);
      const point = ring[head];
      if (point.z < 0) return;
      const glow=ctx.createRadialGradient(point.x,point.y,0,point.x,point.y,8);
      glow.addColorStop(0,`rgba(${rgb},.65)`);glow.addColorStop(1,`rgba(${rgb},0)`);
      ctx.fillStyle=glow;ctx.fillRect(point.x-8,point.y-8,16,16);
      ctx.fillStyle=`rgba(${rgb},.95)`;ctx.beginPath();ctx.arc(point.x,point.y,1.5,0,Math.PI*2);ctx.fill();
    });
  }
  function draw(t) { drawStars(t); drawCore(t); }
  function frame(time) {
    if (document.hidden || motion.matches) { raf = 0; lastTime = null; return; }
    if (time - lastFrame >= 1000 / 30) {
      if (lastTime !== null) clock += Math.min((time - lastTime) / 1000, .15);
      lastTime = time; lastFrame = time;
      smoothX += (pointerX - smoothX) * .025; smoothY += (pointerY - smoothY) * .025;
      draw(clock);
    }
    raf = requestAnimationFrame(frame);
  }
  function syncMotion() {
    cancelAnimationFrame(raf); raf = 0; lastTime = null;
    document.body.classList.toggle('is-background', document.hidden);
    if (!document.hidden && !motion.matches) raf = requestAnimationFrame(frame);
    else draw(clock);
  }
  window.addEventListener('pointermove', event => { if (event.pointerType !== 'mouse') return; pointerX = event.clientX / width * 2 - 1; pointerY = event.clientY / height * 2 - 1; }, { passive: true });
  document.addEventListener('visibilitychange', syncMotion);
  motion.addEventListener('change', syncMotion);
  new MutationObserver(() => { if (motion.matches) draw(clock); }).observe(core, { attributes: true, attributeFilter: ['data-state'] });
  if ('ResizeObserver' in window) { const observer = new ResizeObserver(resize); observer.observe(core); observer.observe(starsCanvas); }
  else window.addEventListener('resize', resize);
  resize(); syncMotion();
}());
