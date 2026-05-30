const canvas = document.getElementById("starfield");
const ctx = canvas.getContext("2d", { alpha: false });

const THEMES = {
  LIGHT: "light",
  DARK: "dark"
};
const DEVICE_MODES = {
  DESKTOP: "desktop",
  MOBILE: "mobile"
};
const THEME_STATE_KEY = "miguel-site-theme";
const SKY_BACKGROUND = "#DFF5FF";
const SPACE_BACKGROUND = "#0A0E17";
const CLOUD_DENSITY = 0.000018;
const MIN_CLOUDS = 14;
const MAX_CLOUDS = 34;
const STAR_DENSITY = 0.00036;
const MIN_STARS = 110;
const MAX_STARS = 640;
const TWINKLE_RATIO = 0.82;
const LARGE_STAR_RATIO = 0.16;
const GIANT_STAR_RATIO = 0.035;
const COLORED_STAR_RATIO = 0.1;
const STAR_ACCENT_COLORS = ["#ffee00", "#fcc2cf", "#ff00ff", "#00e1ff"];
const HOVER_RADIUS_MIN = 86;
const HOVER_RADIUS_MAX = 153;
const TRAIL_LIFETIME = 1000;
const TRAIL_STRENGTH = 0.48;
const TRAIL_SAMPLE_DISTANCE = 10;
const SCROLL_PARALLAX_FACTOR = 0.12;
const SCROLL_PARALLAX_EASE = 0.08;
const SCROLL_ANIMATION_PAUSE_DURATION = 150;
const SCROLL_CANVAS_RENDER_INTERVAL = 90;
const CLOUD_DEPTH_LAYERS = [0.22, 0.38, 0.56, 0.74, 0.92];
const CLOUD_DEPTH_JITTER = 0.045;
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
const CLOUD_ASSETS = [
  { src: assetPath("assets/research/misc/cloud1.png"), weight: 0.58 },
  { src: assetPath("assets/research/misc/cloud2.png"), weight: 0.24 },
  { src: assetPath("assets/research/misc/cloud3.png"), weight: 0.18 }
];
const THEME_ASSETS = {
  [THEMES.LIGHT]: {
    portal: assetPath("assets/research/misc/sun.png"),
    toggle: assetPath("assets/research/misc/earth.png")
  },
  [THEMES.DARK]: {
    portal: assetPath("assets/research/misc/earth.png"),
    toggle: assetPath("assets/research/misc/sun.png")
  }
};
const sunImage = new Image();
sunImage.src = THEME_ASSETS[THEMES.LIGHT].portal;
const cloudImages = CLOUD_ASSETS.map((asset) => {
  const image = new Image();
  image.src = asset.src;
  return {
    ...asset,
    image
  };
});

let clouds = [];
let stars = [];
let width = 0;
let height = 0;
let dpr = 1;
let animationFrameId = null;
let currentTheme = THEMES.LIGHT;
let sceneTime = 0;
let lastAnimationTime = null;
let scrollPauseUntil = 0;
let lastScrollCanvasRender = 0;
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

function pickCloudDepth() {
  const layer = CLOUD_DEPTH_LAYERS[Math.floor(Math.random() * CLOUD_DEPTH_LAYERS.length)];
  return clamp(layer + randomBetween(-CLOUD_DEPTH_JITTER, CLOUD_DEPTH_JITTER), 0.16, 1);
}

function pickCloudImage() {
  const roll = Math.random();
  let cursor = 0;

  for (const cloud of cloudImages) {
    cursor += cloud.weight;

    if (roll <= cursor) {
      return cloud.image;
    }
  }

  return cloudImages[0].image;
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

function createClouds() {
  const count = clamp(
    Math.round(window.innerWidth * window.innerHeight * CLOUD_DENSITY),
    MIN_CLOUDS,
    MAX_CLOUDS
  );

  clouds = Array.from({ length: count }, () => {
    const depth = pickCloudDepth();
    const cloudWidth = Math.round(randomBetween(180, 430) * (0.62 + depth * 0.58));

    return {
      x: randomBetween(-cloudWidth, width + cloudWidth),
      y: randomBetween(-height * 0.06, height * 0.9),
      depth,
      width: cloudWidth,
      speed: randomBetween(0.002, 0.014) * (0.54 + depth),
      image: pickCloudImage()
    };
  });
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

  createClouds();
  createStars();
}

function wrapPosition(value, max) {
  return ((value % max) + max) % max;
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

function drawSkyBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#bfeeff");
  gradient.addColorStop(0.5, "#e9f9ff");
  gradient.addColorStop(1, "#ffffff");

  ctx.globalAlpha = 1;
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawCloud(cloud, time) {
  const renderedWidth = cloud.width;
  const renderedHeight = renderedWidth * (369 / 677);
  const drift = time * cloud.speed;
  const x = wrapPosition(cloud.x + drift, width + renderedWidth * 2) - renderedWidth;
  const rawY = cloud.y + Math.sin(time * 0.00012 + cloud.depth * 8) * (6 + cloud.depth * 8);
  const y = wrapPosition(rawY + renderedHeight, height + renderedHeight * 2) - renderedHeight;

  ctx.globalAlpha = 1;

  if (cloud.image.complete && cloud.image.naturalWidth > 0) {
    ctx.drawImage(cloud.image, x, y, renderedWidth, renderedHeight);
  } else {
    ctx.fillStyle = "rgba(255, 255, 255, 0.62)";
    ctx.beginPath();
    ctx.ellipse(
      x + renderedWidth * 0.5,
      y + renderedHeight * 0.55,
      renderedWidth * 0.42,
      renderedHeight * 0.26,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

function drawCanvasSun() {
  if (!earthPortal || !sunImage.complete || sunImage.naturalWidth === 0) {
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

  const focus = Number.parseFloat(
    earthPortal.style.getPropertyValue("--portal-focus")
  ) || 0;

  ctx.globalAlpha = 0.32 + focus * 0.38;
  ctx.filter = `brightness(${1 + focus * 0.3}) drop-shadow(0 0 ${10 + focus * 16}px rgba(255, 184, 64, 0.36))`;
  ctx.drawImage(sunImage, rect.left, rect.top, rect.width, rect.height);
  ctx.filter = "none";
  ctx.globalAlpha = 1;
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

function drawStar(star, time) {
  const renderedStar = getRenderedStar(star);
  const influence = getHoverInfluence(renderedStar, time);
  const alpha = clamp(getStarAlpha(star, time) + influence * 0.74, 0.18, 1);
  const x = Math.round(renderedStar.x);
  const y = Math.round(renderedStar.y);
  const coreColor = renderedStar.color || "#f7fbff";
  const armColor = renderedStar.color || "#d9ecff";
  const size = renderedStar.size === "giant" ? 2 + influence * 2.4 : 1 + influence * 1.8;
  const near = renderedStar.size === "small" ? 1 : 2;
  const far = renderedStar.size === "giant" ? 5 : 3;

  drawStarGlow(renderedStar, alpha, influence);
  drawPixel(x, y, coreColor, alpha, size);
  drawPixel(x - near, y, armColor, alpha * 0.82, size);
  drawPixel(x + near, y, armColor, alpha * 0.82, size);
  drawPixel(x, y - near, armColor, alpha * 0.82, size);
  drawPixel(x, y + near, armColor, alpha * 0.82, size);

  if (renderedStar.size !== "small") {
    drawPixel(x - far, y, "#8fc7ff", alpha * 0.46, 1);
    drawPixel(x + far, y, "#8fc7ff", alpha * 0.46, 1);
    drawPixel(x, y - far, "#8fc7ff", alpha * 0.46, 1);
    drawPixel(x, y + far, "#8fc7ff", alpha * 0.46, 1);
  }

  ctx.globalAlpha = 1;
}

function drawSpaceBackground() {
  ctx.globalAlpha = 1;
  ctx.fillStyle = SPACE_BACKGROUND;
  ctx.fillRect(0, 0, width, height);
}

function updateCanvasParallax() {
  parallax.targetY = -window.scrollY * SCROLL_PARALLAX_FACTOR;
  parallax.y += (parallax.targetY - parallax.y) * SCROLL_PARALLAX_EASE;
}

function maskPortalStars() {
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
  ctx.fillStyle = SPACE_BACKGROUND;
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

function renderLightScene(time) {
  drawSkyBackground();
  drawCanvasSun();

  for (const cloud of clouds) {
    drawCloud(cloud, time);
  }
}

function renderDarkScene(time) {
  drawSpaceBackground();
  pointerTrail = pointerTrail.filter((point) => time - point.time < TRAIL_LIFETIME);

  for (const star of stars) {
    drawStar(star, time);
  }

  maskPortalStars();
}

function renderScene(time) {
  if (currentTheme === THEMES.DARK) {
    updateCanvasParallax();
    renderDarkScene(time);
    return;
  }

  renderLightScene(time);
}

function animate(time) {
  const isScrollPaused = time < scrollPauseUntil;
  const elapsed = lastAnimationTime === null ? 0 : time - lastAnimationTime;
  lastAnimationTime = time;

  updateSpaceshipFlight(time);

  if (!isScrollPaused) {
    sceneTime += elapsed;
    renderScene(sceneTime);
  } else if (time - lastScrollCanvasRender >= SCROLL_CANVAS_RENDER_INTERVAL) {
    renderScene(sceneTime);
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
    if (card.dataset.slideLocked === "true") {
      card.style.setProperty("--scroll-slide-x", "0px");
      return;
    }

    const rect = card.getBoundingClientRect();
    const cardCenter = rect.top + rect.height / 2;
    const normalizedDistance = (cardCenter - viewportCenter) / viewportCenter;
    const progress = getSlideProgress(normalizedDistance);
    const travel = viewportWidth / 2 + rect.width / 2 + SLIDE_EDGE_GAP;

    if (progress === 0) {
      card.dataset.slideLocked = "true";
    }

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

function getSavedTheme() {
  try {
    const savedTheme = window.localStorage?.getItem(THEME_STATE_KEY);

    if (Object.values(THEMES).includes(savedTheme)) {
      return savedTheme;
    }
  } catch {
    // Keep the default light theme.
  }

  return THEMES.LIGHT;
}

function saveTheme(theme) {
  try {
    window.localStorage?.setItem(THEME_STATE_KEY, theme);
  } catch {
    // Theme persistence is a nicety; the UI still works without it.
  }
}

function createThemeToggleButton() {
  const existingButton = document.querySelector(".theme-toggle");

  if (existingButton) {
    return existingButton;
  }

  const button = document.createElement("button");
  button.className = "theme-toggle";
  button.type = "button";

  const icon = document.createElement("img");
  icon.className = "theme-toggle-icon";
  icon.alt = "";
  icon.setAttribute("aria-hidden", "true");

  button.append(icon);
  document.body.append(button);

  return button;
}

function updateThemeToggle() {
  if (!themeToggle) {
    return;
  }

  const isDark = currentTheme === THEMES.DARK;
  const nextThemeLabel = isDark ? "light" : "dark";
  const label = `Switch to ${nextThemeLabel} theme`;
  const icon = themeToggle.querySelector(".theme-toggle-icon");

  themeToggle.setAttribute("aria-label", label);
  themeToggle.setAttribute("aria-pressed", String(isDark));
  themeToggle.title = label;

  if (icon) {
    icon.src = THEME_ASSETS[currentTheme].toggle;
  }
}

function updatePortalThemeImage() {
  const portalImage = earthPortal?.querySelector("img");

  if (portalImage) {
    portalImage.src = THEME_ASSETS[currentTheme].portal;
  }
}

function applyTheme(theme, shouldSave = true) {
  currentTheme = Object.values(THEMES).includes(theme) ? theme : THEMES.LIGHT;
  document.documentElement.dataset.theme = currentTheme;
  updatePortalThemeImage();
  updateThemeToggle();
  pointerTrail = [];
  renderScene(sceneTime);

  if (shouldSave) {
    saveTheme(currentTheme);
  }
}

function toggleTheme() {
  applyTheme(currentTheme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK);
}

function getDeviceMode() {
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const noHover = window.matchMedia("(hover: none)").matches;
  const narrowViewport = window.matchMedia("(max-width: 760px)").matches;
  const likelyTouchMobile = coarsePointer && noHover;

  return likelyTouchMobile || narrowViewport
    ? DEVICE_MODES.MOBILE
    : DEVICE_MODES.DESKTOP;
}

function updateDeviceMode() {
  document.documentElement.dataset.device = getDeviceMode();
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

  updateDeviceMode();
  resizeCanvas();
  updateSlideCards();
  updateSpaceshipVisibility();
  updateEarthPortalFocus();
  renderScene(sceneTime);
  animationFrameId = requestAnimationFrame(animate);
}

function handlePointerMove(event) {
  if (currentTheme !== THEMES.DARK) {
    return;
  }

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
      time: sceneTime
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
const themeToggle = createThemeToggleButton();
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

if (themeToggle) {
  themeToggle.addEventListener("click", toggleTheme);
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

updateDeviceMode();
resizeCanvas();
applyTheme(getSavedTheme(), false);
animationFrameId = requestAnimationFrame(animate);
