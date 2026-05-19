// script.js
const canvas = document.getElementById("starfield");
const ctx = canvas.getContext("2d", { alpha: false });

const STAR_DENSITY = 0.00016;
const MIN_STARS = 90;
const MAX_STARS = 260;
const TWINKLE_RATIO = 0.78;

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
  const starCount = clamp(Math.round(width * height * STAR_DENSITY), MIN_STARS, MAX_STARS);

  stars = Array.from({ length: starCount }, () => {
    const twinkles = Math.random() < TWINKLE_RATIO;

    return {
      x: Math.floor(Math.random() * width),
      y: Math.floor(Math.random() * height),
      size: Math.random() < 0.82 ? 1 : 2,
      baseAlpha: randomBetween(0.42, 0.92),
      twinkles,
      speed: randomBetween(0.0035, 0.008),
      amplitude: twinkles ? randomBetween(0.12, 0.32) : 0,
      noise: Math.random()
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

function drawPixelStar(star, time) {
  const wave = Math.sin(time * star.speed + star.phase);
  const shimmer = (Math.random() - 0.5) * 0.08;

  const twinkle = star.twinkles
    ? wave * star.amplitude + shimmer
    : 0;

  const alpha = clamp(star.baseAlpha + twinkle, 0.26, 1);
  const x = Math.round(star.x);
  const y = Math.round(star.y);
  const s = star.size;



  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#f4f8ff";

  ctx.fillRect(x, y, s, s);
  ctx.fillRect(x - s, y, s, s);
  ctx.fillRect(x + s, y, s, s);
  ctx.fillRect(x, y - s, s, s);
  ctx.fillRect(x, y + s, s, s);

  if (s === 2) {
    ctx.globalAlpha = alpha * 0.45;
    ctx.fillStyle = "#8fc7ff";
    ctx.fillRect(x - 2 * s, y, s, s);
    ctx.fillRect(x + 2 * s, y, s, s);
    ctx.fillRect(x, y - 2 * s, s, s);
    ctx.fillRect(x, y + 2 * s, s, s);
  }

  ctx.globalAlpha = 1;
}

function animate(time) {
  ctx.fillStyle = "#0A0E17";
  ctx.fillRect(0, 0, width, height);

  for (const star of stars) {
    drawPixelStar(star, time);
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
const navLinks = document.querySelector(".nav-links");
const navItems = document.querySelectorAll(".nav-links a");

navToggle.addEventListener("click", () => {
  const isOpen = document.body.classList.toggle("nav-open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

navItems.forEach((link) => {
  link.addEventListener("click", () => {
    document.body.classList.remove("nav-open");
    navToggle.setAttribute("aria-expanded", "false");
  });
});

window.addEventListener("resize", handleResize, { passive: true });

document.getElementById("year").textContent = new Date().getFullYear();

resizeCanvas();
animationFrameId = requestAnimationFrame(animate);