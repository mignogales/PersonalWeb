const canvas = document.getElementById("starfield");
const ctx = canvas.getContext("2d", { alpha: false });

const BACKGROUND = "#0A0E17";
const STAR_DENSITY = 0.00036;
const MIN_STARS = 110;
const MAX_STARS = 640;
const TWINKLE_RATIO = 0.82;
const LARGE_STAR_RATIO = 0.16;
const GIANT_STAR_RATIO = 0.035;
const COLORED_STAR_RATIO = 0.1;
const STAR_ACCENT_COLORS = ["#ffee00", "#ff0000", "#ff00ff", "#00e1ff"];
const HOVER_RADIUS_MIN = 86;
const HOVER_RADIUS_MAX = 153;
const TRAIL_LIFETIME = 1000;
const TRAIL_STRENGTH = 0.48;
const TRAIL_SAMPLE_DISTANCE = 10;
const SCROLL_PARALLAX_FACTOR = 0.12;
const SCROLL_PARALLAX_EASE = 0.08;
const SCROLL_ANIMATION_PAUSE_DURATION = 150;
const SCROLL_CANVAS_RENDER_INTERVAL = 90;
const STAR_DEPTH_LAYERS = [0.18, 0.34, 0.58, 0.84, 1];
const STAR_DEPTH_JITTER = 0.035;
const SLIDE_CENTER_HOLD = 0.56;
const SLIDE_MAX_PROGRESS = 1.55;
const SLIDE_EDGE_GAP = 42;
const SPACESHIP_BOTTOM_THRESHOLD = 6;
const SPACESHIP_FLIGHT_DURATION = 12000;
const SPACESHIP_BOOST_DURATION = 3400;
const SPACESHIP_BOOST_RATE = 1.85;
const EARTH_STAR_MASK_PADDING = 6;
const SITE_ROOT = new URL("../", document.currentScript?.src || window.location.href);
const assetPath = (path) => new URL(path, SITE_ROOT).href;
const BACKGROUND_MUSIC_SRC = assetPath("assets/research/misc/sounds/Starbyte Run.mp3");
const BACKGROUND_MUSIC_VOLUME = 0.14;
const BACKGROUND_MUSIC_STATE_KEY = "miguel-site-background-music";
const BACKGROUND_MUSIC_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
const PAGE_TRANSITION_DURATION = 1400;

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
let scrollPauseUntil = 0;
let lastScrollCanvasRender = 0;
let lastStarfieldTime = 0;
let slideCards = [];
let prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let spaceshipBoostTimeoutId = null;
let spaceshipFlightComplete = false;
let spaceshipFlightActive = false;
let spaceshipFlightProgress = 0;
let spaceshipFlightLastTime = null;
let musicIsPlaying = false;
let musicPlayer = null;
let musicResumeTime = 0;
let musicResumeApplied = false;

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

function pickStarDepth() {
  const layer = STAR_DEPTH_LAYERS[Math.floor(Math.random() * STAR_DEPTH_LAYERS.length)];
  return clamp(layer + randomBetween(-STAR_DEPTH_JITTER, STAR_DEPTH_JITTER), 0.16, 1);
}

function pickStarColor() {
  if (Math.random() >= COLORED_STAR_RATIO) {
    return null;
  }

  return STAR_ACCENT_COLORS[Math.floor(Math.random() * STAR_ACCENT_COLORS.length)];
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
      depth: pickStarDepth(),
      size,
      twinkles,
      color: pickStarColor(),
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

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  const number = Number.parseInt(value, 16);

  return {
    r: (number >> 16) & 255,
    g: (number >> 8) & 255,
    b: number & 255
  };
}

function rgbaFromHex(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawStarGlow(star, alpha, influence) {
  if (influence <= 0) {
    return;
  }

  const glowRadius = 7 + influence * 22;
  const gradient = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, glowRadius);

  if (star.color) {
    gradient.addColorStop(0, rgbaFromHex(star.color, 0.34 * alpha * influence));
    gradient.addColorStop(0.34, rgbaFromHex(star.color, 0.16 * alpha * influence));
    gradient.addColorStop(1, rgbaFromHex(star.color, 0));
  } else {
    gradient.addColorStop(0, `rgba(234, 246, 255, ${0.34 * alpha * influence})`);
    gradient.addColorStop(0.34, `rgba(143, 199, 255, ${0.16 * alpha * influence})`);
    gradient.addColorStop(1, "rgba(143, 199, 255, 0)");
  }

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
  const coreColor = star.color || "#f7fbff";
  const armColor = star.color || "#d9ecff";

  drawPixel(x, y, coreColor, alpha, size);
  drawPixel(x - arm, y, armColor, alpha * 0.82, size);
  drawPixel(x + arm, y, armColor, alpha * 0.82, size);
  drawPixel(x, y - arm, armColor, alpha * 0.82, size);
  drawPixel(x, y + arm, armColor, alpha * 0.82, size);
}

function drawLargeStar(star, alpha, influence) {
  const x = Math.round(star.x);
  const y = Math.round(star.y);
  const size = 1 + influence * 1.9;
  const spread = 1 + influence * 2.8;
  const near = Math.round(spread);
  const far = Math.round(2 + influence * 5);
  const coreColor = star.color || "#fbfdff";
  const nearColor = star.color || "#dceeff";
  const farColor = star.color || "#98c9ff";
  const dimColor = star.color || "#4f79a8";

  drawPixel(x, y, coreColor, alpha, size);

  drawPixel(x - near, y, nearColor, alpha * 0.9, size);
  drawPixel(x + near, y, nearColor, alpha * 0.9, size);
  drawPixel(x, y - near, nearColor, alpha * 0.9, size);
  drawPixel(x, y + near, nearColor, alpha * 0.9, size);

  drawPixel(x - far, y, farColor, alpha * 0.62, size);
  drawPixel(x + far, y, farColor, alpha * 0.62, size);
  drawPixel(x, y - far, farColor, alpha * 0.62, size);
  drawPixel(x, y + far, farColor, alpha * 0.62, size);

  drawPixel(x - near, y - near, farColor, alpha * 0.52, size);
  drawPixel(x + near, y - near, farColor, alpha * 0.52, size);
  drawPixel(x - near, y + near, farColor, alpha * 0.52, size);
  drawPixel(x + near, y + near, farColor, alpha * 0.52, size);

  drawPixel(x - far, y - near, dimColor, alpha * 0.28, size);
  drawPixel(x + far, y - near, dimColor, alpha * 0.28, size);
  drawPixel(x - far, y + near, dimColor, alpha * 0.28, size);
  drawPixel(x + far, y + near, dimColor, alpha * 0.28, size);
  drawPixel(x - near, y - far, dimColor, alpha * 0.28, size);
  drawPixel(x + near, y - far, dimColor, alpha * 0.28, size);
  drawPixel(x - near, y + far, dimColor, alpha * 0.28, size);
  drawPixel(x + near, y + far, dimColor, alpha * 0.28, size);
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
  const coreColor = star.color || "#ffffff";
  const nearColor = star.color || "#eaf6ff";
  const farColor = star.color || "#a8d6ff";
  const midColor = star.color || "#8fc7ff";
  const dimColor = star.color || "#47719e";

  drawPixel(x - 1, y - 1, coreColor, alpha, coreSize);

  drawPixel(x - mid, y - near, nearColor, alpha * 0.92, size);
  drawPixel(x + near, y - near, nearColor, alpha * 0.92, size);
  drawPixel(x - near, y - mid, nearColor, alpha * 0.92, size);
  drawPixel(x - near, y + near, nearColor, alpha * 0.92, size);

  drawPixel(x - far, y - near, farColor, alpha * 0.72, size);
  drawPixel(x + mid, y - near, farColor, alpha * 0.72, size);
  drawPixel(x - near, y - far, farColor, alpha * 0.72, size);
  drawPixel(x - near, y + mid, farColor, alpha * 0.72, size);

  drawPixel(x - mid, y - mid, midColor, alpha * 0.56, size);
  drawPixel(x + near, y - mid, midColor, alpha * 0.56, size);
  drawPixel(x - mid, y + near, midColor, alpha * 0.56, size);
  drawPixel(x + near, y + near, midColor, alpha * 0.56, size);

  drawPixel(x - long, y - near, dimColor, alpha * 0.32, size);
  drawPixel(x + far, y - near, dimColor, alpha * 0.32, size);
  drawPixel(x - near, y - long, dimColor, alpha * 0.32, size);
  drawPixel(x - near, y + far, dimColor, alpha * 0.32, size);
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

function updateCanvasParallax() {
  parallax.targetY = -window.scrollY * SCROLL_PARALLAX_FACTOR;
  parallax.y += (parallax.targetY - parallax.y) * SCROLL_PARALLAX_EASE;
}

function renderStarfield(time) {
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, width, height);
  pointerTrail = pointerTrail.filter((point) => time - point.time < TRAIL_LIFETIME);

  for (const star of stars) {
    drawStar(star, time);
  }

  maskEarthPortalStars();
}

function maskEarthPortalStars() {
  if (!earthPortal) {
    return;
  }

  const rect = earthPortal.getBoundingClientRect();

  if (
    rect.right < 0 ||
    rect.bottom < 0 ||
    rect.left > width ||
    rect.top > height
  ) {
    return;
  }

  ctx.globalAlpha = 1;
  ctx.fillStyle = BACKGROUND;
  ctx.beginPath();
  ctx.ellipse(
    rect.left + rect.width / 2,
    rect.top + rect.height / 2,
    rect.width / 2 + EARTH_STAR_MASK_PADDING,
    rect.height / 2 + EARTH_STAR_MASK_PADDING,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();
}

function animate(time) {
  const isScrollPaused = time < scrollPauseUntil;

  updateCanvasParallax();
  updateSpaceshipFlight(time);

  if (!isScrollPaused) {
    renderStarfield(time);
    lastStarfieldTime = time;
  } else if (time - lastScrollCanvasRender >= SCROLL_CANVAS_RENDER_INTERVAL) {
    renderStarfield(lastStarfieldTime || time);
    lastScrollCanvasRender = time;
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

function updateMusicToggle() {
  if (!musicToggle) {
    return;
  }

  musicToggle.classList.toggle("is-playing", musicIsPlaying);
  musicToggle.setAttribute("aria-pressed", String(musicIsPlaying));

  const label = musicIsPlaying ? "Pause Starbyte Run" : "Play Starbyte Run";
  musicToggle.setAttribute("aria-label", label);
  musicToggle.setAttribute("title", label);
}

function createMusicToggleButton() {
  const existingButton = document.querySelector(".music-toggle");

  if (existingButton) {
    return existingButton;
  }

  const button = document.createElement("button");
  button.className = "music-toggle";
  button.type = "button";
  button.setAttribute("aria-label", "Play Starbyte Run");
  button.setAttribute("aria-pressed", "false");
  button.title = "Play Starbyte Run";

  const moon = document.createElement("img");
  moon.className = "music-toggle-icon";
  moon.src = assetPath("assets/research/misc/moon.png");
  moon.alt = "";
  moon.setAttribute("aria-hidden", "true");

  button.append(moon);
  document.body.append(button);

  return button;
}

function getSavedMusicState() {
  let storedState = "";

  try {
    storedState = window.localStorage?.getItem(BACKGROUND_MUSIC_STATE_KEY) || "";
  } catch {
    storedState = "";
  }

  if (!storedState) {
    const cookiePrefix = `${BACKGROUND_MUSIC_STATE_KEY}=`;
    const cookie = document.cookie
      .split("; ")
      .find((value) => value.startsWith(cookiePrefix));

    storedState = cookie ? decodeURIComponent(cookie.slice(cookiePrefix.length)) : "";
  }

  try {
    return JSON.parse(storedState) || {};
  } catch {
    return {};
  }
}

function saveMusicState(isPlaying = musicIsPlaying, time = getMusicCurrentTime()) {
  const serializedState = JSON.stringify({
    isPlaying,
    time
  });

  try {
    window.localStorage?.setItem(BACKGROUND_MUSIC_STATE_KEY, serializedState);
  } catch {
    // Fall back to a cookie below.
  }

  document.cookie = `${BACKGROUND_MUSIC_STATE_KEY}=${encodeURIComponent(serializedState)}; max-age=${BACKGROUND_MUSIC_COOKIE_MAX_AGE}; path=/; SameSite=Lax`;
}

function getMusicCurrentTime() {
  if (!musicPlayer) {
    return musicResumeTime || 0;
  }

  return musicPlayer.currentTime || 0;
}

function getMusicPlayerContainer() {
  let playerContainer = document.querySelector(".audio-background-player");

  if (!playerContainer) {
    playerContainer = document.createElement("div");
    playerContainer.className = "audio-background-player";
    document.body.append(playerContainer);
  }

  return playerContainer;
}

function createMusicPlayer() {
  if (musicPlayer) {
    return;
  }

  const playerContainer = getMusicPlayerContainer();
  const audio = document.createElement("audio");
  audio.src = BACKGROUND_MUSIC_SRC;
  audio.loop = true;
  audio.preload = "auto";
  audio.volume = BACKGROUND_MUSIC_VOLUME;

  playerContainer.replaceChildren(audio);
  musicPlayer = audio;
}

function startBackgroundMusic() {
  createMusicPlayer();
  musicPlayer.volume = BACKGROUND_MUSIC_VOLUME;

  if (!musicResumeApplied && musicResumeTime > 0) {
    musicPlayer.currentTime = musicResumeTime;
    musicResumeApplied = true;
  }

  const playPromise = musicPlayer.play();
  saveMusicState(true);

  if (playPromise) {
    playPromise.catch(() => {
      musicIsPlaying = false;
      saveMusicState(false);
      updateMusicToggle();
    });
  }
}

function stopBackgroundMusic() {
  if (musicPlayer) {
    musicPlayer.pause();
  }

  saveMusicState(false);
}

function toggleBackgroundMusic() {
  if (musicIsPlaying) {
    stopBackgroundMusic();
    musicIsPlaying = false;
  } else {
    startBackgroundMusic();
    musicIsPlaying = true;
  }

  updateMusicToggle();
}

function handleScroll() {
  scrollPauseUntil = performance.now() + SCROLL_ANIMATION_PAUSE_DURATION;
  updateSlideCards();
  updateSpaceshipVisibility();
  updateEarthPortalFocus();
}

function handleResize() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }

  resizeCanvas();
  updateSlideCards();
  updateSpaceshipVisibility();
  updateEarthPortalFocus();
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
const musicToggle = createMusicToggleButton();
const earthPortal = document.querySelector(".earth-portal");
const aboutMePortalSection = document.querySelector(".about-me-portal-section");
const paperCards = document.querySelectorAll(".paper-card");
const researchCards = document.querySelectorAll(".research-card");

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

if (musicToggle) {
  const savedMusicState = getSavedMusicState();
  musicIsPlaying = savedMusicState.isPlaying === true;
  musicResumeTime = Number(savedMusicState.time) || 0;
  createMusicPlayer();
  musicToggle.addEventListener("click", toggleBackgroundMusic);
  updateMusicToggle();

  if (musicIsPlaying) {
    startBackgroundMusic();
  }
}

window.addEventListener("pageshow", () => {
  document.body.classList.remove("page-transitioning");
});

window.addEventListener("pagehide", () => {
  saveMusicState(musicIsPlaying);
  document.body.classList.remove("page-transitioning");
});

function handleEarthPortalClick(event) {
  if (!earthPortal || prefersReducedMotion) {
    return;
  }

  const topElement = document.elementFromPoint(event.clientX, event.clientY);

  if (!topElement || !earthPortal.contains(topElement)) {
    event.preventDefault();
    return;
  }

  event.preventDefault();
  document.body.classList.add("page-transitioning");
  window.setTimeout(() => {
    window.location.href = earthPortal.href;
  }, PAGE_TRANSITION_DURATION);
}

function updateEarthPortalFocus() {
  if (!earthPortal || !aboutMePortalSection) {
    return;
  }

  const rect = aboutMePortalSection.getBoundingClientRect();
  const sectionCenter = rect.top + rect.height / 2;
  const viewportCenter = window.innerHeight / 2;
  const maxDistance = window.innerHeight * 0.82;
  const distance = Math.abs(sectionCenter - viewportCenter);
  const proximity = 1 - clamp(distance / maxDistance, 0, 1);
  const focus = proximity * proximity * (3 - 2 * proximity);

  earthPortal.style.setProperty("--portal-focus", focus.toFixed(3));
}

if (earthPortal) {
  earthPortal.addEventListener("click", handleEarthPortalClick);
  updateEarthPortalFocus();
}

function setCardTilt(card, x, y, strength = 16) {
  const dx = x - 0.5;
  const dy = y - 0.5;
  const tiltY = dx * strength;
  const tiltX = -dy * strength;

  card.style.setProperty("--tilt-x", `${tiltX.toFixed(2)}deg`);
  card.style.setProperty("--tilt-y", `${tiltY.toFixed(2)}deg`);
}

function enablePointerTilt(card, strength = 16) {
  card.addEventListener("pointermove", (event) => {
    if (prefersReducedMotion) {
      return;
    }

    const rect = card.getBoundingClientRect();
    const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    setCardTilt(card, x, y, strength);
  });

  card.addEventListener("pointerleave", () => {
    [
      "--tilt-x",
      "--tilt-y"
    ].forEach((property) => card.style.removeProperty(property));
  });
}

paperCards.forEach((card) => {
  const cardLink = card.querySelector(".paper-links a[href]");

  if (cardLink) {
    const cardTitle = card.querySelector("h3")?.textContent.trim();

    card.classList.add("has-card-link");
    card.setAttribute("tabindex", "0");
    card.setAttribute("role", "link");
    card.setAttribute(
      "aria-label",
      cardTitle ? `Open ${cardTitle}` : cardLink.textContent.trim()
    );

    card.addEventListener("click", (event) => {
      if (event.target.closest("a")) {
        return;
      }

      if (cardLink.target === "_blank") {
        window.open(cardLink.href, "_blank", "noopener,noreferrer");
        return;
      }

      window.location.href = cardLink.href;
    });

    card.addEventListener("keydown", (event) => {
      if (event.target.closest("a") || !["Enter", " "].includes(event.key)) {
        return;
      }

      event.preventDefault();
      card.click();
    });
  }

  enablePointerTilt(card);
});

slideCards = document.querySelector(".research-page")
  ? []
  : Array.from(document.querySelectorAll(".section:not(.hero) .panel"));
slideCards.forEach((card) => card.classList.add("scroll-slide"));
updateSlideCards();
updateSpaceshipVisibility();
updateEarthPortalFocus();

window.addEventListener("resize", handleResize, { passive: true });
window.addEventListener("scroll", handleScroll, { passive: true });
window.addEventListener("pointermove", handlePointerMove, { passive: true });
window.addEventListener("pointerleave", handlePointerLeave, { passive: true });
window.addEventListener("blur", handlePointerLeave);

resizeCanvas();
animationFrameId = requestAnimationFrame(animate);
