const canvas = document.getElementById("starfield");
const ctx = canvas.getContext("2d", { alpha: false });

const BACKGROUND = "#0A0E17";
const STAR_DENSITY = 0.00018;
const MIN_STARS = 110;
const MAX_STARS = 320;
const TWINKLE_RATIO = 0.82;
const LARGE_STAR_RATIO = 0.16;
const GIANT_STAR_RATIO = 0.035;

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

function pickStarSize() {
  const roll = Math.random();

  if (roll < GIANT_STAR_RATIO) {
    return "giant";
  }

  if (roll < GIANT_STAR_RATIO + LARGE_STAR_RATIO) {
    return "large";
  }

  return "small";
}

function createStars() {
  const count = clamp(
    Math.round(window.innerWidth * window.innerHeight * STAR_DENSITY),
    MIN_STARS,
    MAX_STARS
  );

  stars = Array.from({ length: count }, () => {
    const size = pickStarSize();
    const twinkles = Math.random() < TWINKLE_RATIO;
    const isGiant = size === "giant";

    return {
      x: Math.floor(Math.random() * width),
      y: Math.floor(Math.random() * height),
      size,
      twinkles,
      baseAlpha: randomBetween(0.46, isGiant ? 0.78 : 0.86),
      phase: randomBetween(0, Math.PI * 2),
      speed: randomBetween(0.0011, 0.003),
      amplitude: twinkles ? randomBetween(0.14, isGiant ? 0.34 : 0.28) : 0
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

  const primaryPulse = Math.sin(time * star.speed + star.phase);
  const secondaryPulse = Math.sin(time * star.speed * 0.37 + star.phase * 1.9);
  const twinkle = primaryPulse * star.amplitude + secondaryPulse * star.amplitude * 0.28;

  return clamp(star.baseAlpha + twinkle, 0.18, 1);
}

function drawPixel(x, y, color, alpha, size = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), size, size);
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

  drawPixel(x, y, "#fbfdff", alpha);

  drawPixel(x - 1, y, "#dceeff", alpha * 0.9);
  drawPixel(x + 1, y, "#dceeff", alpha * 0.9);
  drawPixel(x, y - 1, "#dceeff", alpha * 0.9);
  drawPixel(x, y + 1, "#dceeff", alpha * 0.9);

  drawPixel(x - 2, y, "#98c9ff", alpha * 0.62);
  drawPixel(x + 2, y, "#98c9ff", alpha * 0.62);
  drawPixel(x, y - 2, "#98c9ff", alpha * 0.62);
  drawPixel(x, y + 2, "#98c9ff", alpha * 0.62);

  drawPixel(x - 1, y - 1, "#98c9ff", alpha * 0.52);
  drawPixel(x + 1, y - 1, "#98c9ff", alpha * 0.52);
  drawPixel(x - 1, y + 1, "#98c9ff", alpha * 0.52);
  drawPixel(x + 1, y + 1, "#98c9ff", alpha * 0.52);

  drawPixel(x - 2, y - 1, "#4f79a8", alpha * 0.28);
  drawPixel(x + 2, y - 1, "#4f79a8", alpha * 0.28);
  drawPixel(x - 2, y + 1, "#4f79a8", alpha * 0.28);
  drawPixel(x + 2, y + 1, "#4f79a8", alpha * 0.28);
  drawPixel(x - 1, y - 2, "#4f79a8", alpha * 0.28);
  drawPixel(x + 1, y - 2, "#4f79a8", alpha * 0.28);
  drawPixel(x - 1, y + 2, "#4f79a8", alpha * 0.28);
  drawPixel(x + 1, y + 2, "#4f79a8", alpha * 0.28);
}

function drawGiantStar(star, alpha) {
  const x = Math.round(star.x);
  const y = Math.round(star.y);

  drawPixel(x - 1, y - 1, "#ffffff", alpha, 2);

  drawPixel(x - 2, y - 1, "#eaf6ff", alpha * 0.92);
  drawPixel(x + 1, y - 1, "#eaf6ff", alpha * 0.92);
  drawPixel(x - 1, y - 2, "#eaf6ff", alpha * 0.92);
  drawPixel(x - 1, y + 1, "#eaf6ff", alpha * 0.92);

  drawPixel(x - 3, y - 1, "#a8d6ff", alpha * 0.72);
  drawPixel(x + 2, y - 1, "#a8d6ff", alpha * 0.72);
  drawPixel(x - 1, y - 3, "#a8d6ff", alpha * 0.72);
  drawPixel(x - 1, y + 2, "#a8d6ff", alpha * 0.72);

  drawPixel(x - 2, y - 2, "#8fc7ff", alpha * 0.56);
  drawPixel(x + 1, y - 2, "#8fc7ff", alpha * 0.56);
  drawPixel(x - 2, y + 1, "#8fc7ff", alpha * 0.56);
  drawPixel(x + 1, y + 1, "#8fc7ff", alpha * 0.56);

  drawPixel(x - 4, y - 1, "#47719e", alpha * 0.32);
  drawPixel(x + 3, y - 1, "#47719e", alpha * 0.32);
  drawPixel(x - 1, y - 4, "#47719e", alpha * 0.32);
  drawPixel(x - 1, y + 3, "#47719e", alpha * 0.32);
}

function drawStar(star, time) {
  const alpha = getStarAlpha(star, time);

  if (star.size === "giant") {
    drawGiantStar(star, alpha);
  } else if (star.size === "large") {
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