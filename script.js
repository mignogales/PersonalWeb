const canvas = document.getElementById("starfield");
const ctx = canvas.getContext("2d", { alpha: false });

const BACKGROUND = "#0A0E17";
const STAR_DENSITY = 0.00036;
const MIN_STARS = 110;
const MAX_STARS = 640;
const TWINKLE_RATIO = 0.82;
const LARGE_STAR_RATIO = 0.16;
const GIANT_STAR_RATIO = 0.035;
const HOVER_RADIUS_MIN = 86;
const HOVER_RADIUS_MAX = 153;
const TRAIL_LIFETIME = 1000;
const TRAIL_STRENGTH = 0.48;
const TRAIL_SAMPLE_DISTANCE = 10;
const SCROLL_PARALLAX_FACTOR = 0.12;
const SCROLL_PARALLAX_EASE = 0.08;
const SLIDE_CENTER_HOLD = 0.32;
const SLIDE_MAX_PROGRESS = 1.06;
const SLIDE_EDGE_GAP = 42;
const SPACESHIP_BOTTOM_THRESHOLD = 6;
const SPACESHIP_FLIGHT_DURATION = 7800;
const SPACESHIP_BOOST_DURATION = 3400;
const SPACESHIP_BOOST_RATE = 2.9;

let stars = [];
let width = 0;
let height = 0;
let dpr = 1;
let animationFrameId = null;
let pointer = {
  active: false,
  x: 0,
  y: 0
};
let pointerTrail = [];
let parallax = {
  y: 0,
  targetY: 0
};
let slideCards = [];
let prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let spaceshipBoostTimeoutId = null;
let spaceshipFlightComplete = false;
let spaceshipFlightActive = false;
let spaceshipFlightProgress = 0;
let spaceshipFlightLastTime = null;

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
      depth: randomBetween(0.16, 1),
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

function getRenderedStar(star) {
  return {
    ...star,
    y: wrapPosition(star.y + parallax.y * star.depth, height)
  };
}

function wrapPosition(value, max) {
  return ((value % max) + max) % max;
}

function getPointInfluence(star, point, radius) {
  const dx = star.x - point.x;
  const dy = star.y - point.y;
  const distance = Math.hypot(dx, dy);

  if (distance >= radius) {
    return 0;
  }

  const proximity = 1 - distance / radius;
  return proximity * proximity * (3 - 2 * proximity);
}

function getHoverInfluence(star, time) {
  const radius = clamp(Math.min(width, height) * 0.16, HOVER_RADIUS_MIN, HOVER_RADIUS_MAX);
  let influence = 0;

  for (const point of pointerTrail) {
    const age = time - point.time;

    if (age >= TRAIL_LIFETIME) {
      continue;
    }

    const fade = 1 - age / TRAIL_LIFETIME;
    const trailInfluence = getPointInfluence(star, point, radius) * fade * TRAIL_STRENGTH;
    influence = Math.max(influence, trailInfluence);
  }

  return influence;
}

function drawStarGlow(star, alpha, influence) {
  if (influence <= 0) {
    return;
  }

  const glowRadius = 7 + influence * 22;
  const gradient = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, glowRadius);

  gradient.addColorStop(0, `rgba(234, 246, 255, ${0.34 * alpha * influence})`);
  gradient.addColorStop(0.34, `rgba(143, 199, 255, ${0.16 * alpha * influence})`);
  gradient.addColorStop(1, "rgba(143, 199, 255, 0)");

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(star.x, star.y, glowRadius, 0, Math.PI * 2);
  ctx.fill();
}

function drawPixel(x, y, color, alpha, size = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(x - size / 2, y - size / 2, size, size);
}

function drawSmallStar(star, alpha, influence) {
  const x = Math.round(star.x);
  const y = Math.round(star.y);
  const size = 1 + influence * 2.2;
  const arm = Math.round(1 + influence * 3);

  drawPixel(x, y, "#f7fbff", alpha, size);
  drawPixel(x - arm, y, "#d9ecff", alpha * 0.82, size);
  drawPixel(x + arm, y, "#d9ecff", alpha * 0.82, size);
  drawPixel(x, y - arm, "#d9ecff", alpha * 0.82, size);
  drawPixel(x, y + arm, "#d9ecff", alpha * 0.82, size);
}

function drawLargeStar(star, alpha, influence) {
  const x = Math.round(star.x);
  const y = Math.round(star.y);
  const size = 1 + influence * 1.9;
  const spread = 1 + influence * 2.8;
  const near = Math.round(spread);
  const far = Math.round(2 + influence * 5);

  drawPixel(x, y, "#fbfdff", alpha, size);

  drawPixel(x - near, y, "#dceeff", alpha * 0.9, size);
  drawPixel(x + near, y, "#dceeff", alpha * 0.9, size);
  drawPixel(x, y - near, "#dceeff", alpha * 0.9, size);
  drawPixel(x, y + near, "#dceeff", alpha * 0.9, size);

  drawPixel(x - far, y, "#98c9ff", alpha * 0.62, size);
  drawPixel(x + far, y, "#98c9ff", alpha * 0.62, size);
  drawPixel(x, y - far, "#98c9ff", alpha * 0.62, size);
  drawPixel(x, y + far, "#98c9ff", alpha * 0.62, size);

  drawPixel(x - near, y - near, "#98c9ff", alpha * 0.52, size);
  drawPixel(x + near, y - near, "#98c9ff", alpha * 0.52, size);
  drawPixel(x - near, y + near, "#98c9ff", alpha * 0.52, size);
  drawPixel(x + near, y + near, "#98c9ff", alpha * 0.52, size);

  drawPixel(x - far, y - near, "#4f79a8", alpha * 0.28, size);
  drawPixel(x + far, y - near, "#4f79a8", alpha * 0.28, size);
  drawPixel(x - far, y + near, "#4f79a8", alpha * 0.28, size);
  drawPixel(x + far, y + near, "#4f79a8", alpha * 0.28, size);
  drawPixel(x - near, y - far, "#4f79a8", alpha * 0.28, size);
  drawPixel(x + near, y - far, "#4f79a8", alpha * 0.28, size);
  drawPixel(x - near, y + far, "#4f79a8", alpha * 0.28, size);
  drawPixel(x + near, y + far, "#4f79a8", alpha * 0.28, size);
}

function drawGiantStar(star, alpha, influence) {
  const x = Math.round(star.x);
  const y = Math.round(star.y);
  const size = 1 + influence * 1.7;
  const coreSize = 2 + influence * 2.7;
  const near = Math.round(1 + influence * 2);
  const mid = Math.round(2 + influence * 4);
  const far = Math.round(3 + influence * 6);
  const long = Math.round(4 + influence * 8);

  drawPixel(x - 1, y - 1, "#ffffff", alpha, coreSize);

  drawPixel(x - mid, y - near, "#eaf6ff", alpha * 0.92, size);
  drawPixel(x + near, y - near, "#eaf6ff", alpha * 0.92, size);
  drawPixel(x - near, y - mid, "#eaf6ff", alpha * 0.92, size);
  drawPixel(x - near, y + near, "#eaf6ff", alpha * 0.92, size);

  drawPixel(x - far, y - near, "#a8d6ff", alpha * 0.72, size);
  drawPixel(x + mid, y - near, "#a8d6ff", alpha * 0.72, size);
  drawPixel(x - near, y - far, "#a8d6ff", alpha * 0.72, size);
  drawPixel(x - near, y + mid, "#a8d6ff", alpha * 0.72, size);

  drawPixel(x - mid, y - mid, "#8fc7ff", alpha * 0.56, size);
  drawPixel(x + near, y - mid, "#8fc7ff", alpha * 0.56, size);
  drawPixel(x - mid, y + near, "#8fc7ff", alpha * 0.56, size);
  drawPixel(x + near, y + near, "#8fc7ff", alpha * 0.56, size);

  drawPixel(x - long, y - near, "#47719e", alpha * 0.32, size);
  drawPixel(x + far, y - near, "#47719e", alpha * 0.32, size);
  drawPixel(x - near, y - long, "#47719e", alpha * 0.32, size);
  drawPixel(x - near, y + far, "#47719e", alpha * 0.32, size);
}

function drawStar(star, time) {
  const renderedStar = getRenderedStar(star);
  const influence = getHoverInfluence(renderedStar, time);
  const alpha = clamp(getStarAlpha(star, time) + influence * 0.74, 0.18, 1);

  drawStarGlow(renderedStar, alpha, influence);

  if (star.size === "giant") {
    drawGiantStar(renderedStar, alpha, influence);
  } else if (star.size === "large") {
    drawLargeStar(renderedStar, alpha, influence);
  } else {
    drawSmallStar(renderedStar, alpha, influence);
  }

  ctx.globalAlpha = 1;
}

function animate(time) {
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, width, height);
  pointerTrail = pointerTrail.filter((point) => time - point.time < TRAIL_LIFETIME);
  parallax.targetY = -window.scrollY * SCROLL_PARALLAX_FACTOR;
  parallax.y += (parallax.targetY - parallax.y) * SCROLL_PARALLAX_EASE;
  updateSpaceshipFlight(time);

  for (const star of stars) {
    drawStar(star, time);
  }

  animationFrameId = requestAnimationFrame(animate);
}

function getSlideProgress(distanceFromCenter) {
  const direction = Math.sign(distanceFromCenter);
  const distance = Math.abs(distanceFromCenter);

  if (distance <= SLIDE_CENTER_HOLD) {
    return 0;
  }

  return direction * clamp(
    (distance - SLIDE_CENTER_HOLD) / (SLIDE_MAX_PROGRESS - SLIDE_CENTER_HOLD),
    0,
    1
  );
}

function updateSlideCards() {
  if (prefersReducedMotion) {
    return;
  }

  const viewportCenter = window.innerHeight / 2;
  const viewportWidth = window.innerWidth;

  slideCards.forEach((card) => {
    const rect = card.getBoundingClientRect();
    const cardCenter = rect.top + rect.height / 2;
    const normalizedDistance = (cardCenter - viewportCenter) / viewportCenter;
    const progress = getSlideProgress(normalizedDistance);
    const travel = viewportWidth / 2 + rect.width / 2 + SLIDE_EDGE_GAP;

    card.style.setProperty("--scroll-slide-x", `${Math.round(progress * travel)}px`);
  });
}

function isAtScrollBottom() {
  const scrollBottom = window.scrollY + window.innerHeight;
  const pageBottom = document.documentElement.scrollHeight;

  return scrollBottom >= pageBottom - SPACESHIP_BOTTOM_THRESHOLD;
}

function updateSpaceshipVisibility() {
  if (isAtScrollBottom()) {
    startSpaceshipFlight();
  }
}

function startSpaceshipFlight() {
  if (!spaceship || spaceshipFlightActive || spaceshipFlightComplete) {
    return;
  }

  if (prefersReducedMotion) {
    spaceshipFlightComplete = true;
    return;
  }

  spaceshipFlightActive = true;
  spaceshipFlightProgress = 0;
  spaceshipFlightLastTime = null;
  spaceship.style.transform = "translate3d(0, 0, 0)";
  document.body.classList.add("spaceship-visible");
}

function updateSpaceshipFlight(time) {
  if (!spaceship || !spaceshipFlightActive || prefersReducedMotion) {
    return;
  }

  if (spaceshipFlightLastTime === null) {
    spaceshipFlightLastTime = time;
    return;
  }

  const elapsed = time - spaceshipFlightLastTime;
  const speed = document.body.classList.contains("spaceship-boost")
    ? SPACESHIP_BOOST_RATE
    : 1;
  spaceshipFlightLastTime = time;
  spaceshipFlightProgress = clamp(
    spaceshipFlightProgress + (elapsed * speed) / SPACESHIP_FLIGHT_DURATION,
    0,
    1
  );

  const distance = window.innerWidth + spaceship.offsetWidth * 2.7;
  spaceship.style.transform = `translate3d(${Math.round(distance * spaceshipFlightProgress)}px, 0, 0)`;

  if (spaceshipFlightProgress >= 1) {
    handleSpaceshipFlightEnd();
  }
}

function boostSpaceship() {
  if (!spaceship || !spaceshipFlightActive || spaceshipFlightComplete) {
    return;
  }

  document.body.classList.add("spaceship-boost");
  window.clearTimeout(spaceshipBoostTimeoutId);
  spaceshipBoostTimeoutId = window.setTimeout(() => {
    document.body.classList.remove("spaceship-boost");
  }, SPACESHIP_BOOST_DURATION);
}

function handleSpaceshipFlightEnd() {
  if (!spaceship) {
    return;
  }

  spaceshipFlightComplete = true;
  spaceshipFlightActive = false;
  spaceshipFlightLastTime = null;
  document.body.classList.remove("spaceship-visible", "spaceship-boost");
  window.clearTimeout(spaceshipBoostTimeoutId);
  spaceship.style.transform = "translate3d(0, 0, 0)";
}

function handleScroll() {
  updateSlideCards();
  updateSpaceshipVisibility();
}

function handleResize() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }

  resizeCanvas();
  updateSlideCards();
  updateSpaceshipVisibility();
  animationFrameId = requestAnimationFrame(animate);
}

function handlePointerMove(event) {
  const previous = pointerTrail[pointerTrail.length - 1] || pointer;
  const dx = event.clientX - previous.x;
  const dy = event.clientY - previous.y;
  const hasMoved = Math.hypot(dx, dy) >= TRAIL_SAMPLE_DISTANCE;

  pointer = {
    active: true,
    x: event.clientX,
    y: event.clientY
  };

  if (hasMoved) {
    pointerTrail.push({
      x: pointer.x,
      y: pointer.y,
      time: performance.now()
    });
  }
}

function handlePointerLeave() {
  pointer.active = false;
}

const navToggle = document.querySelector(".nav-toggle");
const navItems = document.querySelectorAll(".nav-links a");
const spaceship = document.querySelector(".spaceship");

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

if (spaceship) {
  spaceship.addEventListener("click", boostSpaceship);
}

slideCards = Array.from(document.querySelectorAll(".section:not(.hero) .panel"));
slideCards.forEach((card) => card.classList.add("scroll-slide"));
updateSlideCards();
updateSpaceshipVisibility();

window.addEventListener("resize", handleResize, { passive: true });
window.addEventListener("scroll", handleScroll, { passive: true });
window.addEventListener("pointermove", handlePointerMove, { passive: true });
window.addEventListener("pointerleave", handlePointerLeave, { passive: true });
window.addEventListener("blur", handlePointerLeave);

resizeCanvas();
animationFrameId = requestAnimationFrame(animate);
