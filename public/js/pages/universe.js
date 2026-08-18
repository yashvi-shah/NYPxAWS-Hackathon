/* ==========================================================================
   universe.js — "My Gravity" 
   A canvas-based planetary ecosystem that grows with the student's progress.
   Planet size = XP, stars = semesters completed, particles = recent activity.
   ========================================================================== */

import { html, render } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { session, myWorkspace, levelFromXp } from '../services/store.js';
import { setLayer } from '../core/actions.js';

/* --------------------------------------------------------------------------
   Progression helpers — derive universe state from real data
   -------------------------------------------------------------------------- */

/** Polytechnic: 3 years × 2 semesters = 6 semesters total. */
function deriveSemester(user) {
  const year = user.year || 1;
  // Assume semester 1 if before January, semester 2 otherwise (rough heuristic)
  const month = new Date().getMonth(); // 0-based
  const semInYear = month >= 3 && month <= 9 ? 1 : 2; // Apr-Sep = sem 1, Oct-Mar = sem 2
  return (year - 1) * 2 + semInYear;
}

function deriveStats(user, assignments) {
  const xp = user.xp || 0;
  const level = levelFromXp(xp);
  const completed = assignments.filter((a) => a.status === 'completed');
  const earlySubmissions = (user.xpHistory || []).filter((h) =>
    h.reason && (h.reason.toLowerCase().includes('early') || h.reason.toLowerCase().includes('bonus'))
  ).length;
  const tasksCompleted = (user.xpHistory || []).filter((h) =>
    h.reason && (h.reason.toLowerCase().includes('completed'))
  ).length;
  const semester = deriveSemester(user);
  const completedSemesters = Math.max(0, semester - 1); // semesters fully done

  return {
    xp,
    level,
    year: user.year || 1,
    semester,
    completedSemesters,
    streak: user.streak || 0,
    badges: (user.badges || []).length,
    tasksCompleted,
    earlySubmissions,
    assignmentsCompleted: completed.length,
    totalAssignments: assignments.length,
  };
}

/* --------------------------------------------------------------------------
   Canvas renderer — the planetary ecosystem
   -------------------------------------------------------------------------- */

class UniverseRenderer {
  constructor(canvas, stats) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.stats = stats;
    this.particles = [];
    this.orbitParticles = [];
    this.stars = [];
    this.time = 0;
    this.animId = null;
    this.dpr = window.devicePixelRatio || 1;

    this._resize();
    this._initStars();
    this._initParticles();
    this._initOrbitParticles();
  }

  _resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.w = rect.width;
    this.h = rect.height;
    this.canvas.width = this.w * this.dpr;
    this.canvas.height = this.h * this.dpr;
    this.canvas.style.width = this.w + 'px';
    this.canvas.style.height = this.h + 'px';
    this.ctx.scale(this.dpr, this.dpr);
    this.cx = this.w / 2;
    this.cy = this.h / 2;
  }

  /** Background stars — static twinkle */
  _initStars() {
    this.bgStars = [];
    const count = Math.min(200, Math.floor(this.w * this.h / 3000));
    for (let i = 0; i < count; i++) {
      this.bgStars.push({
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        r: Math.random() * 1.2 + 0.3,
        twinkle: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.02 + 0.005,
      });
    }
  }

  /** Debris particles that drift toward the planet */
  _initParticles() {
    this.particles = [];
    // Number of particles proportional to XP (max ~40)
    const count = Math.min(40, Math.floor(this.stats.xp / 50) + 5);
    for (let i = 0; i < count; i++) {
      this.particles.push(this._newParticle());
    }
  }

  _newParticle() {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * 150 + this._planetRadius() + 60;
    return {
      x: this.cx + Math.cos(angle) * dist,
      y: this.cy + Math.sin(angle) * dist,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 2.5 + 1,
      alpha: Math.random() * 0.6 + 0.4,
      hue: Math.random() * 40 + 200, // blue-purple range
    };
  }

  /** Orbit particles — represent badges/achievements */
  _initOrbitParticles() {
    this.orbitParticles = [];
    const count = Math.min(8, this.stats.badges);
    for (let i = 0; i < count; i++) {
      const orbitDist = this._planetRadius() + 20 + i * 12;
      this.orbitParticles.push({
        angle: (Math.PI * 2 / count) * i,
        dist: orbitDist,
        speed: 0.003 + Math.random() * 0.004,
        r: 3 + Math.random() * 2,
        hue: 40 + i * 35,
      });
    }
  }

  /** Planet radius scales with XP. Min 25, max 90. */
  _planetRadius() {
    // XP 0→5000 maps to 25→90
    return Math.min(90, 25 + (this.stats.xp / 5000) * 65);
  }

  /** Planet detail/layer count based on tasks completed */
  _planetLayers() {
    return Math.min(5, 1 + Math.floor(this.stats.tasksCompleted / 3));
  }

  /* ---- Drawing ---- */

  _drawBackground() {
    const ctx = this.ctx;
    // Deep space gradient
    const grad = ctx.createRadialGradient(this.cx, this.cy, 0, this.cx, this.cy, Math.max(this.w, this.h) * 0.7);
    grad.addColorStop(0, '#0a0e24');
    grad.addColorStop(0.5, '#060918');
    grad.addColorStop(1, '#020308');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.w, this.h);
  }

  _drawBgStars() {
    const ctx = this.ctx;
    for (const s of this.bgStars) {
      const alpha = 0.4 + 0.4 * Math.sin(this.time * s.speed + s.twinkle);
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(2)})`;
      ctx.fill();
    }
  }

  _drawSemesterStars() {
    const ctx = this.ctx;
    const count = this.stats.completedSemesters;
    if (count === 0) return;

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / 6) * i - Math.PI / 2;
      const dist = this._planetRadius() + 100 + i * 30;
      const x = this.cx + Math.cos(angle + this.time * 0.001) * dist;
      const y = this.cy + Math.sin(angle + this.time * 0.001) * dist;
      const size = 6 + i * 1.5;

      // Glow
      const glow = ctx.createRadialGradient(x, y, 0, x, y, size * 3);
      glow.addColorStop(0, `rgba(255, 220, 100, 0.3)`);
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.fillRect(x - size * 3, y - size * 3, size * 6, size * 6);

      // Star body
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      const starGrad = ctx.createRadialGradient(x, y, 0, x, y, size);
      starGrad.addColorStop(0, '#fffbe6');
      starGrad.addColorStop(0.6, '#ffd54f');
      starGrad.addColorStop(1, '#ff8f00');
      ctx.fillStyle = starGrad;
      ctx.fill();
    }
  }

  _drawPlanet() {
    const ctx = this.ctx;
    const r = this._planetRadius();
    const layers = this._planetLayers();

    // Planet glow
    const glow = ctx.createRadialGradient(this.cx, this.cy, r * 0.8, this.cx, this.cy, r * 2);
    glow.addColorStop(0, 'rgba(41, 98, 159, 0.15)');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, r * 2, 0, Math.PI * 2);
    ctx.fill();

    // Planet body — gradient with layers
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, r, 0, Math.PI * 2);
    const planetGrad = ctx.createRadialGradient(
      this.cx - r * 0.3, this.cy - r * 0.3, r * 0.1,
      this.cx, this.cy, r
    );
    planetGrad.addColorStop(0, '#5ab4d4');
    planetGrad.addColorStop(0.4, '#1f5f61');
    planetGrad.addColorStop(0.75, '#0f3a3c');
    planetGrad.addColorStop(1, '#081e20');
    ctx.fillStyle = planetGrad;
    ctx.fill();

    // Surface detail bands (more layers = more detail)
    for (let i = 0; i < layers; i++) {
      const bandY = this.cy - r + (r * 2 / (layers + 1)) * (i + 1);
      const bandW = Math.sqrt(r * r - Math.pow(bandY - this.cy, 2)) * 2;
      if (bandW <= 0) continue;
      ctx.beginPath();
      ctx.ellipse(this.cx, bandY, bandW / 2, 3 + i, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(129, 189, 164, ${0.08 + i * 0.03})`;
      ctx.fill();
    }

    // Streak ring (if streak > 3)
    if (this.stats.streak >= 3) {
      const ringR = r + 8;
      ctx.beginPath();
      ctx.ellipse(this.cx, this.cy, ringR, ringR * 0.3, Math.PI * 0.1, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 200, 60, ${0.3 + 0.1 * Math.sin(this.time * 0.02)})`;
      ctx.lineWidth = 2 + (this.stats.streak > 7 ? 1 : 0);
      ctx.stroke();

      if (this.stats.streak >= 7) {
        ctx.beginPath();
        ctx.ellipse(this.cx, this.cy, ringR + 5, (ringR + 5) * 0.3, Math.PI * 0.1, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 160, 40, ${0.2 + 0.08 * Math.sin(this.time * 0.015)})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }

  _drawParticles() {
    const ctx = this.ctx;
    const pr = this._planetRadius();

    for (const p of this.particles) {
      // Gravitational pull toward center
      const dx = this.cx - p.x;
      const dy = this.cy - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const force = 0.015 / Math.max(1, dist / 200);
      p.vx += (dx / dist) * force;
      p.vy += (dy / dist) * force;

      // Damping
      p.vx *= 0.998;
      p.vy *= 0.998;

      p.x += p.vx;
      p.y += p.vy;

      // Reset if absorbed into planet
      if (dist < pr + 2) {
        Object.assign(p, this._newParticle());
        // Push far out
        const angle = Math.random() * Math.PI * 2;
        const farDist = pr + 120 + Math.random() * 100;
        p.x = this.cx + Math.cos(angle) * farDist;
        p.y = this.cy + Math.sin(angle) * farDist;
      }

      // Draw
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, 60%, 70%, ${p.alpha * (0.5 + 0.5 * Math.min(1, dist / 200))})`;
      ctx.fill();
    }
  }

  _drawOrbitParticles() {
    const ctx = this.ctx;
    for (const o of this.orbitParticles) {
      o.angle += o.speed;
      const x = this.cx + Math.cos(o.angle) * o.dist;
      const y = this.cy + Math.sin(o.angle) * o.dist * 0.6; // elliptical

      ctx.beginPath();
      ctx.arc(x, y, o.r, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(x, y, 0, x, y, o.r);
      grad.addColorStop(0, `hsla(${o.hue}, 70%, 75%, 0.9)`);
      grad.addColorStop(1, `hsla(${o.hue}, 70%, 50%, 0.2)`);
      ctx.fillStyle = grad;
      ctx.fill();
    }
  }

  /* ---- Animation loop ---- */

  _frame() {
    this.time++;
    this.ctx.clearRect(0, 0, this.w, this.h);
    this._drawBackground();
    this._drawBgStars();
    this._drawSemesterStars();
    this._drawParticles();
    this._drawPlanet();
    this._drawOrbitParticles();
    this.animId = requestAnimationFrame(() => this._frame());
  }

  start() {
    if (!this.animId) this._frame();
  }

  stop() {
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  handleResize() {
    this.stop();
    this._resize();
    this._initStars();
    this.start();
  }
}

/* --------------------------------------------------------------------------
   Page render
   -------------------------------------------------------------------------- */

let renderer = null;
let resizeHandler = null;

function statusMessage(stats) {
  if (stats.xp === 0) return 'Your journey begins. Build your world through your progress.';
  if (stats.year === 1 && stats.xp < 500) return 'Your planet is forming. Every task pulls more matter into orbit.';
  if (stats.year === 1) return 'Year 1 — Your world is taking shape.';
  if (stats.year === 2 && stats.xp < 1500) return 'Year 2 — Your solar system is expanding.';
  if (stats.year === 2) return 'Year 2 — The ecosystem grows with each achievement.';
  if (stats.year === 3 && stats.completedSemesters >= 6) return '3 Years. 6 Semesters. Your world is complete.';
  if (stats.year === 3) return 'Year 3 — Your universe nears completion.';
  return 'Keep building your world.';
}

async function renderPage(view, { isCurrent }) {
  // Clean up previous renderer
  if (renderer) { renderer.stop(); renderer = null; }
  if (resizeHandler) { window.removeEventListener('resize', resizeHandler); resizeHandler = null; }

  let assignments = [];
  try {
    const workspace = await myWorkspace();
    assignments = workspace.assignments || [];
  } catch { /* proceed with empty */ }

  if (!isCurrent()) return;

  const user = session.user || {};
  const stats = deriveStats(user, assignments);

  render(view, html`
    <div class="page-universe">
      <div class="universe-canvas-wrap">
        <canvas id="universe-canvas" aria-label="Your academic universe visualization"></canvas>
        <div class="universe-tagline">${statusMessage(stats)}</div>
      </div>
      <aside class="universe-panel">
        <h1 class="universe-title">${icon('target', { size: 18 })} My Gravity</h1>
        <div class="universe-stats">
          <div class="ustat">
            <span class="ustat-label">Year</span>
            <span class="ustat-value num">${stats.year}</span>
          </div>
          <div class="ustat">
            <span class="ustat-label">Semester</span>
            <span class="ustat-value num">${stats.semester}</span>
          </div>
          <div class="ustat">
            <span class="ustat-label">XP</span>
            <span class="ustat-value num">${stats.xp.toLocaleString()}</span>
          </div>
          <div class="ustat">
            <span class="ustat-label">Level</span>
            <span class="ustat-value num">${stats.level.level}</span>
          </div>
          <div class="ustat">
            <span class="ustat-label">Tasks completed</span>
            <span class="ustat-value num">${stats.tasksCompleted}</span>
          </div>
          <div class="ustat">
            <span class="ustat-label">Early submissions</span>
            <span class="ustat-value num">${stats.earlySubmissions}</span>
          </div>
          <div class="ustat">
            <span class="ustat-label">Current streak</span>
            <span class="ustat-value num">${stats.streak} day${stats.streak !== 1 ? 's' : ''}</span>
          </div>
          <div class="ustat">
            <span class="ustat-label">Badges</span>
            <span class="ustat-value num">${stats.badges}</span>
          </div>
          <div class="ustat">
            <span class="ustat-label">Assignments done</span>
            <span class="ustat-value num">${stats.assignmentsCompleted} / ${stats.totalAssignments}</span>
          </div>
        </div>
        <div class="universe-legend">
          <h2>Your Universe</h2>
          <ul>
            <li><span class="legend-dot planet"></span> Planet — overall progress</li>
            <li><span class="legend-dot star"></span> Stars — completed semesters (${stats.completedSemesters})</li>
            <li><span class="legend-dot orbit"></span> Moons — badges & achievements</li>
            <li><span class="legend-dot ring"></span> Rings — active streak</li>
            <li><span class="legend-dot debris"></span> Debris — gravitational pull (XP)</li>
          </ul>
        </div>
      </aside>
    </div>
  `);

  // Mount canvas renderer
  const canvas = document.getElementById('universe-canvas');
  if (canvas) {
    renderer = new UniverseRenderer(canvas, stats);
    renderer.start();

    resizeHandler = () => {
      if (renderer) renderer.handleResize();
    };
    window.addEventListener('resize', resizeHandler);
  }

  setLayer('page', {});
}

export default { render: renderPage };
