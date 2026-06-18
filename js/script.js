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
const MOBILE_VIEWPORT_RESIZE_TOLERANCE = 2;
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
const HISTORY_CITY_IMAGES = {
  Badajoz: [
    { file: "alcazaba.png", alt: "Badajoz Alcazaba at sunset" },
    { file: "puerta palma.jpeg", alt: "Puerta de Palmas in Badajoz" },
    { file: "rio.jpeg", alt: "Guadiana river in Badajoz" }
  ],
  Sevilla: [
    { file: "torre del oro.jpeg", alt: "Torre del Oro in Sevilla" },
    { file: "portada.jpeg", alt: "Sevilla street view" },
    { file: "fachada.jpeg", alt: "Historic facade in Sevilla" },
    { file: "catedral.jpeg", alt: "Sevilla cathedral" },
    { file: "edificio.jpeg", alt: "Building in Sevilla" },
    { file: "feria.jpeg", alt: "Feria scene in Sevilla" }
  ],
  Milano: [
    { file: "duomo.jpg", alt: "Duomo di Milano" }
  ],
  Lugano: [
    { file: "uni.jpeg", alt: "University building in Lugano" },
    { file: "noche.jpeg", alt: "Lugano at night" },
    { file: "nevado.jpeg", alt: "Snowy Lugano view" },
    { file: "noche 2.jpeg", alt: "Night lights in Lugano" },
    { file: "patos.jpeg", alt: "Ducks by the water in Lugano" },
    { file: "corno.jpeg", alt: "Mountain view near Lugano" },
    { file: "otono.jpeg", alt: "Autumn in Lugano" },
    { file: "grulla.jpeg", alt: "Bird by the water in Lugano" },
    { file: "morcote.jpeg", alt: "Morcote near Lugano" },
    { file: "carretera.jpeg", alt: "Road near Lugano" },
    { file: "parque.jpeg", alt: "Park in Lugano" },
    { file: "rio.jpeg", alt: "Waterfront in Lugano" }
  ]
};
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
let mobileStableViewportWidth = 0;
let mobileStableViewportHeight = 0;
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
let slideCardsDisabled = false;
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

function getCanvasViewportSize() {
  const rawWidth = Math.round(window.innerWidth);
  const rawHeight = Math.round(window.innerHeight);

  if (getDeviceMode() !== DEVICE_MODES.MOBILE) {
    mobileStableViewportWidth = 0;
    mobileStableViewportHeight = 0;
    return {
      width: rawWidth,
      height: rawHeight
    };
  }

  const isNewMobileWidth =
    mobileStableViewportWidth === 0 ||
    Math.abs(rawWidth - mobileStableViewportWidth) > MOBILE_VIEWPORT_RESIZE_TOLERANCE;

  if (isNewMobileWidth) {
    mobileStableViewportWidth = rawWidth;
    mobileStableViewportHeight = rawHeight;
  } else {
    mobileStableViewportHeight = Math.max(mobileStableViewportHeight, rawHeight);
  }

  return {
    width: rawWidth,
    height: mobileStableViewportHeight
  };
}

function resizeCanvas() {
  const previousWidth = width;
  const previousHeight = height;
  const viewportSize = getCanvasViewportSize();
  const shouldRebuildScene =
    clouds.length === 0 ||
    stars.length === 0 ||
    Math.abs(viewportSize.width - previousWidth) > MOBILE_VIEWPORT_RESIZE_TOLERANCE ||
    (
      getDeviceMode() !== DEVICE_MODES.MOBILE &&
      Math.abs(viewportSize.height - previousHeight) > MOBILE_VIEWPORT_RESIZE_TOLERANCE
    );

  dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  width = viewportSize.width;
  height = viewportSize.height;

  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;

  if (shouldRebuildScene) {
    createClouds();
    createStars();
  }
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
  const shouldAnimateDuringScroll = currentTheme === THEMES.LIGHT;
  const elapsed = lastAnimationTime === null ? 0 : time - lastAnimationTime;
  lastAnimationTime = time;

  updateSpaceshipFlight(time);

  if (!isScrollPaused || shouldAnimateDuringScroll) {
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

function setSlideCardsDisabled(disabled) {
  if (slideCardsDisabled === disabled) {
    return;
  }

  slideCardsDisabled = disabled;

  if (disabled) {
    slideCards.forEach((card) => {
      card.style.setProperty("--scroll-slide-x", "0px");
    });
  }
}

function updateSlideCards() {
  const shouldDisableSlideCards =
    prefersReducedMotion ||
    getDeviceMode() === DEVICE_MODES.MOBILE;

  if (shouldDisableSlideCards) {
    setSlideCardsDisabled(true);
    return;
  }

  setSlideCardsDisabled(false);

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
  updateSpaceshipThemeLabel();
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

  const direction = currentTheme === THEMES.LIGHT ? -1 : 1;
  const distance = window.innerWidth + spaceship.offsetWidth * 2.7;
  spaceship.style.transform = `translate3d(${Math.round(direction * distance * spaceshipFlightProgress)}px, 0, 0)`;

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

function updateSpaceshipThemeLabel() {
  if (!spaceship) {
    return;
  }

  const flyerName = currentTheme === THEMES.LIGHT ? "Wingull" : "spaceship";
  spaceship.setAttribute("aria-label", `Boost ${flyerName}`);
  spaceship.title = `Boost ${flyerName}`;
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
    // Keep the device default theme.
  }

  return null;
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
  updateSpaceshipThemeLabel();
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

function getDefaultTheme() {
  return getDeviceMode() === DEVICE_MODES.MOBILE
    ? THEMES.LIGHT
    : THEMES.DARK;
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
  updateSpaceshipThemeLabel();
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

function clearCardTilt(card) {
  [
    "--tilt-x",
    "--tilt-y"
  ].forEach((property) => card.style.removeProperty(property));
}

const paperTooltip = paperCards.length ? document.createElement("div") : null;
let activePaperTooltipCard = null;

if (paperTooltip) {
  paperTooltip.className = "paper-tooltip";
  paperTooltip.setAttribute("aria-hidden", "true");
  document.body.appendChild(paperTooltip);
}

function getPaperDescription(card) {
  return (card.querySelector(".paper-abstract") || card
    .querySelector(".paper-card-body > p:not(.meta, .venue)")
  )?.textContent
    .replace(/\s+/g, " ")
    .trim();
}

function getPaperTooltipDetails(card) {
  const poster = card.dataset.poster || card.querySelector(".paper-poster")?.getAttribute("src");

  return {
    description: getPaperDescription(card),
    poster,
    posterRatio: card.dataset.posterRatio,
    title: card.querySelector("h3")?.textContent.replace(/\s+/g, " ").trim()
  };
}

function createAbstractParagraphs(text) {
  return [text.replace(/\s+/g, " ").trim()].filter(Boolean);
}

function isPdfPoster(src) {
  return /\.pdf(?:[?#].*)?$/i.test(src);
}

function setPaperTooltipContent(details) {
  if (!paperTooltip) {
    return;
  }

  const fragment = document.createDocumentFragment();

  const hasPoster = Boolean(details.poster);
  const label = document.createElement("div");
  label.className = "paper-tooltip-label";
  label.textContent = hasPoster ? "Poster" : "Abstract";
  fragment.appendChild(label);

  if (details.title) {
    const title = document.createElement("div");
    title.className = "paper-tooltip-title";
    title.textContent = details.title;
    fragment.appendChild(title);
  }

  paperTooltip.classList.toggle("has-poster", hasPoster);
  paperTooltip.style.removeProperty("--poster-ratio");
  if (details.posterRatio) {
    paperTooltip.style.setProperty("--poster-ratio", details.posterRatio);
  }

  if (hasPoster) {
    if (isPdfPoster(details.poster)) {
      const posterFrame = document.createElement("iframe");
      posterFrame.className = "paper-tooltip-poster paper-tooltip-poster-frame";
      posterFrame.src = `${details.poster}#toolbar=0&navpanes=0`;
      posterFrame.title = details.title ? `${details.title} poster` : "Paper poster";
      posterFrame.loading = "lazy";
      fragment.appendChild(posterFrame);
    } else {
      const poster = document.createElement("img");
      poster.className = "paper-tooltip-poster";
      poster.src = details.poster;
      poster.alt = "";
      poster.loading = "lazy";
      fragment.appendChild(poster);
    }
  } else {
    const description = document.createElement("div");
    description.className = "paper-tooltip-text";
    createAbstractParagraphs(details.description).forEach((paragraphText) => {
      const paragraph = document.createElement("p");
      paragraph.textContent = paragraphText;
      description.appendChild(paragraph);
    });
    fragment.appendChild(description);
  }
  paperTooltip.replaceChildren(fragment);
}

function syncPaperTooltipTheme(card) {
  if (!paperTooltip) {
    return;
  }

  const styles = getComputedStyle(card);
  paperTooltip.style.setProperty("--tooltip-panel", styles.getPropertyValue("--paper-panel"));
  paperTooltip.style.setProperty("--tooltip-panel-strong", styles.getPropertyValue("--paper-panel-strong"));
  paperTooltip.style.setProperty("--tooltip-border", styles.getPropertyValue("--paper-metal"));
  paperTooltip.style.setProperty("--tooltip-text", styles.getPropertyValue("--paper-text"));
  paperTooltip.style.setProperty("--tooltip-muted", styles.getPropertyValue("--paper-muted"));
  paperTooltip.style.setProperty("--tooltip-holo", styles.getPropertyValue("--paper-holo-a"));
  paperTooltip.style.setProperty("--tooltip-holo-soft", styles.getPropertyValue("--paper-holo-soft-b"));
}

function positionPaperTooltip() {
  if (!paperTooltip || !activePaperTooltipCard) {
    return;
  }

  const cardRect = activePaperTooltipCard.getBoundingClientRect();
  const cardCenter = cardRect.top + cardRect.height / 2;
  const focus = clamp(cardCenter / window.innerHeight, 0.18, 0.82);

  paperTooltip.style.setProperty("--drawer-focus", focus.toFixed(3));
}

function showPaperTooltip(card) {
  if (!paperTooltip) {
    return;
  }

  if (card === activePaperTooltipCard && paperTooltip.classList.contains("is-visible")) {
    return;
  }

  const details = getPaperTooltipDetails(card);

  if (!details.description && !details.poster) {
    return;
  }

  activePaperTooltipCard = card;
  setPaperTooltipContent(details);
  syncPaperTooltipTheme(card);
  paperTooltip.classList.add("is-visible");
  window.requestAnimationFrame(positionPaperTooltip);
}

function hidePaperTooltip(card) {
  if (!paperTooltip || card !== activePaperTooltipCard) {
    return;
  }

  paperTooltip.classList.remove("is-visible");
  activePaperTooltipCard = null;
}

function releasePaperCard(card) {
  hidePaperTooltip(card);
  clearCardTilt(card);
  card.blur();
}

function tuneHistoryCollageCrop(image, index) {
  const naturalRatio = image.naturalWidth / image.naturalHeight;
  const cropRatio = clamp(1 + (naturalRatio - 1) * 0.18, 0.92, 1.12);

  image.style.setProperty("--tile-ratio", cropRatio.toFixed(3));
  image.dataset.crop = naturalRatio > 1.16
    ? "landscape"
    : naturalRatio < 0.86
      ? "portrait"
      : "square";

  if (index === 0) {
    image.dataset.tile = "feature";
  } else if (index % 5 === 0) {
    image.dataset.tile = "large";
  } else if (index % 3 === 0) {
    image.dataset.tile = "wide";
  } else {
    image.dataset.tile = "standard";
  }
}

function whenHistoryImageReady(image, index) {
  const tune = () => tuneHistoryCollageCrop(image, index);

  if (image.complete && image.naturalWidth) {
    tune();
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    image.addEventListener(
      "load",
      () => {
        tune();
        resolve();
      },
      { once: true }
    );
    image.addEventListener(
      "error",
      () => {
        image.dataset.crop = "square";
        image.style.setProperty("--tile-ratio", "1");
        resolve();
      },
      { once: true }
    );
  });
}

function shuffleHistoryImages(images) {
  return images
    .map((image) => ({ image, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ image }) => image);
}

function getHistoryCollageColumnCount(grid, imageCount) {
  const width = grid.clientWidth;

  if (width < 560 || imageCount <= 2) {
    return 2;
  }

  if (imageCount <= 5) {
    return 3;
  }

  return width > 920 ? 4 : 3;
}

function layoutHistoryCollage(grid) {
  const images = Array.from(grid.querySelectorAll("img"));

  if (!images.length || grid.hidden || grid.clientWidth === 0) {
    return;
  }

  const columnCount = getHistoryCollageColumnCount(grid, images.length);
  const gap = Number.parseFloat(getComputedStyle(grid).gap) || 8;
  const columnWidth = (grid.clientWidth - gap * (columnCount - 1)) / columnCount;
  const columnHeights = Array.from({ length: columnCount }, () => 0);
  const columns = Array.from({ length: columnCount }, () => {
    const column = document.createElement("div");
    column.className = "history-collage-column";
    return column;
  });

  images.forEach((image) => {
    const ratio = Number.parseFloat(image.style.getPropertyValue("--tile-ratio")) || 1;
    const targetColumn = columnHeights.indexOf(Math.min(...columnHeights));

    columns[targetColumn].appendChild(image);
    columnHeights[targetColumn] += columnWidth / ratio + gap;
  });

  grid.style.setProperty("--collage-columns", String(columnCount));
  grid.replaceChildren(...columns);
  grid.classList.add("is-packed");
}

function layoutHistoryCollages() {
  document
    .querySelectorAll(".history-collage.has-collage[open] .history-collage-grid")
    .forEach(layoutHistoryCollage);
}

function initHistoryCollages() {
  document.querySelectorAll(".history-collage[data-history-city]").forEach((details) => {
    const city = details.dataset.historyCity;
    const placeholder = details.dataset.historyPlaceholder;
    const fallbackAlt = details.dataset.historyAlt || city || "City photo";
    const summary = details.querySelector("summary");
    const previewImage = summary?.querySelector("img");
    const grid = details.querySelector(".history-collage-grid");
    const images = (HISTORY_CITY_IMAGES[city] || []).map((image) => ({
      ...image,
      src: assetPath(`assets/about/${city}/${image.file}`)
    }));
    const hasCollage = images.length > 1;
    const preview = images[0] || {
      src: placeholder,
      alt: fallbackAlt
    };

    if (previewImage && preview.src) {
      previewImage.src = preview.src;
      previewImage.alt = preview.alt || fallbackAlt;
    }

    if (grid) {
      const gridImages = shuffleHistoryImages(images).map((image, index) => {
        const gridImage = document.createElement("img");
        gridImage.src = image.src;
        gridImage.alt = image.alt || fallbackAlt;
        gridImage.dataset.tile = index === 0 ? "feature" : "standard";
        return gridImage;
      });

      grid.replaceChildren(...gridImages);
      grid.hidden = !hasCollage;
      grid.dataset.ready = "false";

      Promise.all(gridImages.map(whenHistoryImageReady)).then(() => {
        grid.dataset.ready = "true";

        if (details.open) {
          layoutHistoryCollage(grid);
        }
      });
    }

    details.dataset.imageCount = String(images.length);
    details.classList.toggle("has-collage", hasCollage);
    details.classList.toggle("no-collage", !hasCollage);

    if (!hasCollage) {
      details.removeAttribute("open");
    }

    summary?.addEventListener("click", (event) => {
      if (event.target.closest("a")) {
        return;
      }

      if (!details.classList.contains("has-collage")) {
        event.preventDefault();
      }
    });

    summary?.addEventListener("keydown", (event) => {
      if (!["Enter", " "].includes(event.key) || event.target.closest("a")) {
        return;
      }

      if (!details.classList.contains("has-collage")) {
        event.preventDefault();
      }
    });

    details.addEventListener("toggle", () => {
      if (!details.classList.contains("has-collage") && details.open) {
        details.open = false;
        return;
      }

      if (details.open && grid) {
        window.requestAnimationFrame(() => {
          if (grid.dataset.ready === "true") {
            layoutHistoryCollage(grid);
          }
        });
      }
    });
  });
}

function handlePaperTooltipMove(event) {
  if (!paperTooltip) {
    return;
  }

  const targetCard = document
    .elementFromPoint(event.clientX, event.clientY)
    ?.closest(".paper-card");

  if (!targetCard) {
    return;
  }

  if (targetCard !== activePaperTooltipCard) {
    showPaperTooltip(targetCard);
  }
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
        releasePaperCard(card);
        window.open(cardLink.href, "_blank", "noopener,noreferrer");
        return;
      }

      releasePaperCard(card);
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

  card.addEventListener("pointerenter", () => showPaperTooltip(card));
  card.addEventListener("pointerleave", () => hidePaperTooltip(card));
  card.addEventListener("mouseover", () => showPaperTooltip(card));
  card.addEventListener("mouseout", (event) => {
    if (!card.contains(event.relatedTarget)) {
      hidePaperTooltip(card);
    }
  });
  card.addEventListener("focus", () => showPaperTooltip(card));
  card.addEventListener("blur", () => hidePaperTooltip(card));
  enablePointerTilt(card);
});

if (paperTooltip) {
  document.addEventListener("mousemove", handlePaperTooltipMove);
}

initHistoryCollages();

slideCards = document.querySelector(".research-page")
  ? []
  : Array.from(document.querySelectorAll(".section:not(.hero) .panel"));
slideCards.forEach((card) => card.classList.add("scroll-slide"));
updateSlideCards();
updateSpaceshipVisibility();
updateEarthPortalFocus();

window.addEventListener("resize", handleResize, { passive: true });
window.addEventListener("scroll", handleScroll, { passive: true });
window.addEventListener("resize", layoutHistoryCollages, { passive: true });
window.addEventListener("resize", positionPaperTooltip, { passive: true });
window.addEventListener("scroll", positionPaperTooltip, { passive: true });
window.addEventListener("pointermove", handlePointerMove, { passive: true });
window.addEventListener("pointerleave", handlePointerLeave, { passive: true });
window.addEventListener("blur", handlePointerLeave);

updateDeviceMode();
resizeCanvas();
applyTheme(getSavedTheme() || getDefaultTheme(), false);
animationFrameId = requestAnimationFrame(animate);
