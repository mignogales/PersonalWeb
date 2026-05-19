// script.js
const canvas = document.getElementById("starfield");
const ctx = canvas.getContext("2d", { alpha: false });

const BACKGROUND = "#0A0E17";
const STAR_DENSITY = 0.00018;
const MIN_STARS = 110;
const MAX_STARS = 320;
const TWINKLE_RATIO = 0.82;
const LARGE_STAR_RATIO = 0.18;

let stars = [];
let width = 0;
let height = 0;
let dpr = 1;
let animationFrameId = null;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function createStars() {
  const count = clamp(
    Math.round(window.innerWidth * window.innerHeight * STAR_DENSITY),
    MIN_STARS,
    MAX_STARS
  );

  stars = Array.from({ length: count }, () => {
    const isLarge = Math.random() < LARGE_STAR_RATIO;
    const twinkles = Math.random() < TWINKLE_RATIO;

    return {
      x: Math.floor(Math.random() * width),
      y: Math.floor(Math.random() * height),
      isLarge,
      twinkles,
      baseAlpha: randomBetween(0.5, 0.9),
      phase: randomBetween(0, Math.PI * 2),
      speed: randomBetween(0.003, 0.0065),
      amplitude: twinkles ? randomBetween(0.06, 0.16) : 0
    };
  });
}

function resizeCanvas() {
  dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  width = window.innerWidth;
  height = window.innerHeight;

  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;

  createStars();
}

function getStarAlpha(star, time) {
  if (!star.twinkles) {
    return star.baseAlpha;
  }

  const slowWave = Math.sin(time * star.speed + star.phase);
  const softPulse = Math.sin(time * star.speed * 0.43 + star.phase * 1.7);
  const twinkle = slowWave * star.amplitude + softPulse * star.amplitude * 0.35;

  return clamp(star.baseAlpha + twinkle, 0.34, 1);
}

function drawPixel(x, y, color, alpha) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
}

function drawSmallStar(star, alpha) {
  const x = Math.round(star.x);
  const y = Math.round(star.y);

  drawPixel(x, y, "#f7fbff", alpha);
  drawPixel(x - 1, y, "#d9ecff", alpha * 0.82);
  drawPixel(x + 1, y, "#d9ecff", alpha * 0.82);
  drawPixel(x, y - 1, "#d9ecff", alpha * 0.82);
  drawPixel(x, y + 1, "#d9ecff", alpha * 0.82);
}

function drawLargeStar(star, alpha) {
  const x = Math.round(star.x);
  const y = Math.round(star.y);

  const core = "#fbfdff";
  const bright = "#dceeff";
  const mid = "#98c9ff";
  const dim = "#4f79a8";

  drawPixel(x, y, core, alpha);

  drawPixel(x - 1, y, bright, alpha * 0.9);
  drawPixel(x + 1, y, bright, alpha * 0.9);
  drawPixel(x, y - 1, bright, alpha * 0.9);
  drawPixel(x, y + 1, bright, alpha * 0.9);

  drawPixel(x - 2, y, mid, alpha * 0.62);
  drawPixel(x + 2, y, mid, alpha * 0.62);
  drawPixel(x, y - 2, mid, alpha * 0.62);
  drawPixel(x, y + 2, mid, alpha * 0.62);

  drawPixel(x - 1, y - 1, mid, alpha * 0.52);
  drawPixel(x + 1, y - 1, mid, alpha * 0.52);
  drawPixel(x - 1, y + 1, mid, alpha * 0.52);
  drawPixel(x + 1, y + 1, mid, alpha * 0.52);

  drawPixel(x - 2, y - 1, dim, alpha * 0.28);
  drawPixel(x + 2, y - 1, dim, alpha * 0.28);
  drawPixel(x - 2, y + 1, dim, alpha * 0.28);
  drawPixel(x + 2, y + 1, dim, alpha * 0.28);
  drawPixel(x - 1, y - 2, dim, alpha * 0.28);
  drawPixel(x + 1, y - 2, dim, alpha * 0.28);
  drawPixel(x - 1, y + 2, dim, alpha * 0.28);
  drawPixel(x + 1, y + 2, dim, alpha * 0.28);
}

function drawStar(star, time) {
  const alpha = getStarAlpha(star, time);

  if (star.isLarge) {
    drawLargeStar(star, alpha);
  } else {
    drawSmallStar(star, alpha);
  }

  ctx.globalAlpha = 1;
}

function animate(time) {
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, width, height);

  for (const star of stars) {
    drawStar(star, time);
  }

  animationFrameId = requestAnimationFrame(animate);
}

function handleResize() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }

  resizeCanvas();
  animationFrameId = requestAnimationFrame(animate);
}

const navToggle = document.querySelector(".nav-toggle");
const navItems = document.querySelectorAll(".nav-links a");

if (navToggle) {
  navToggle.addEventListener("click", () => {
    const isOpen = document.body.classList.toggle("nav-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });
}

navItems.forEach((link) => {
  link.addEventListener("click", () => {
    document.body.classList.remove("nav-open");

    if (navToggle) {
      navToggle.setAttribute("aria-expanded", "false");
    }
  });
});

const year = document.getElementById("year");

if (year) {
  year.textContent = new Date().getFullYear();
}

window.addEventListener("resize", handleResize, { passive: true });

resizeCanvas();
animationFrameId = requestAnimationFrame(animate);