const screens = {
  welcome: document.querySelector('[data-screen="welcome"]'),
  setup: document.querySelector('[data-screen="setup"]'),
  game: document.querySelector('[data-screen="game"]'),
};

const helloWords = Array.from(document.querySelectorAll(".hello-word"));
const startButton = document.getElementById("startButton");
const launchButton = document.getElementById("launchButton");
const clipboardButton = document.getElementById("clipboardButton");
const photoInput = document.getElementById("photoInput");
const dropzone = document.getElementById("dropzone");
const uploadIdle = document.getElementById("uploadIdle");
const uploadPreview = document.getElementById("uploadPreview");
const previewImage = document.getElementById("previewImage");
const fileName = document.getElementById("fileName");
const sessionName = document.getElementById("sessionName");
const noticeModal = document.getElementById("noticeModal");
const noticeCloseButton = document.getElementById("noticeCloseButton");
const noticeConfirmButton = document.getElementById("noticeConfirmButton");
const gamePhoto = document.getElementById("gamePhoto");
const gameSessionLabel = document.getElementById("gameSessionLabel");
const gameFileName = document.getElementById("gameFileName");
const arenaScene = document.querySelector(".arena-scene");
const welcomeTitle = document.querySelector(".welcome-panel h1");
const photoMonolith = document.querySelector(".photo-monolith");
const photoMonolithFrame = document.querySelector(".photo-monolith-frame");
const photoGroundShadow = document.getElementById("photoGroundShadow");
const potatoCursor = document.getElementById("potatoCursor");
const potatoProjectilesBack = document.getElementById("potatoProjectilesBack");
const potatoProjectiles = document.getElementById("potatoProjectiles");

const NOTICE_ANIMATION_MS = 320;
const POTATO_SPRITE_PATH = "./resources/common_potato.png";
const POTATO_THROW_MS = 860;
const POTATO_RESPAWN_MS = 110;
const POTATO_CURSOR_RELOAD_MS = 95;
const POTATO_CURSOR_BASE_ROTATION = -18;
const POTATO_IMPACT_PROGRESS = 0.4;
const PHOTO_HITBOX_INSET_X = 8;
const PHOTO_HITBOX_INSET_Y = 10;
const POTATO_HIT_POLYGON = [
  [0.06, 0.53],
  [0.09, 0.4],
  [0.16, 0.31],
  [0.25, 0.24],
  [0.37, 0.2],
  [0.5, 0.18],
  [0.63, 0.2],
  [0.75, 0.23],
  [0.84, 0.28],
  [0.91, 0.37],
  [0.94, 0.5],
  [0.92, 0.62],
  [0.86, 0.71],
  [0.77, 0.77],
  [0.65, 0.81],
  [0.52, 0.83],
  [0.39, 0.82],
  [0.27, 0.79],
  [0.17, 0.73],
  [0.1, 0.64],
];
const DEBUG_TARGET_DATA_URI = `data:image/svg+xml;utf8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 740 1000" preserveAspectRatio="none">
    <rect width="740" height="1000" fill="#d6dce8"/>
  </svg>
`)}`;
const POTATO_POLYGON_RAY_COUNT = 120;
const POTATO_ALPHA_THRESHOLD = 28;
const DEFAULT_POTATO_REFERENCE = {
  points: POTATO_HIT_POLYGON.map(([x, y]) => [x * 100, y * 100]),
  viewBox: {
    minX: 0,
    minY: 0,
    width: 100,
    height: 100,
  },
};

let helloIndex = 0;
let activePhoto = null;
let noticeHideTimer = null;
let potatoRespawnTimer = null;
let potatoCursorReloadTimer = null;
let potatoCursorRotationFrame = null;
let photoHitTimer = null;
let isPotatoReady = true;
let isPointerOverArena = false;
let isCursorPointerActive = false;
let isDebugMode = false;
let debugHitboxFrame = null;
let lastThrowState = null;
let potatoHitPolygon = POTATO_HIT_POLYGON;
let potatoHitPolygonReference = DEFAULT_POTATO_REFERENCE;
let potatoReloadDirection = 1;
let potatoCursorRotation = POTATO_CURSOR_BASE_ROTATION;
let potatoCursorRotationTarget = POTATO_CURSOR_BASE_ROTATION;
let lastPointerPosition = {
  x: window.innerWidth * 0.5,
  y: window.innerHeight * 0.62,
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const lerp = (start, end, amount) => start + (end - start) * amount;
const easeInQuad = (amount) => amount * amount;
const easeOutQuad = (amount) => 1 - (1 - amount) ** 2;

const buildPotatoHitPolygonFromSprite = (image) => {
  if (!image?.naturalWidth || !image?.naturalHeight) {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    return null;
  }

  context.drawImage(image, 0, 0);
  const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
  const centerX = width * 0.5;
  const centerY = height * 0.5;
  const maxRadius = Math.hypot(width, height) * 0.5;
  const normalizedPolygon = [];
  const sourcePoints = [];

  for (let index = 0; index < POTATO_POLYGON_RAY_COUNT; index += 1) {
    const angle = (-Math.PI * 0.5) + ((Math.PI * 2) * index) / POTATO_POLYGON_RAY_COUNT;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    let hitPoint = null;

    for (let radius = maxRadius; radius >= 0; radius -= 1) {
      const sampleX = Math.round(centerX + cos * radius);
      const sampleY = Math.round(centerY + sin * radius);

      if (sampleX < 0 || sampleX >= width || sampleY < 0 || sampleY >= height) {
        continue;
      }

      const alpha = data[(sampleY * width + sampleX) * 4 + 3];
      if (alpha < POTATO_ALPHA_THRESHOLD) {
        continue;
      }

      hitPoint = [sampleX, sampleY];
      break;
    }

    if (hitPoint) {
      sourcePoints.push(hitPoint);
      normalizedPolygon.push([hitPoint[0] / width, hitPoint[1] / height]);
    }
  }

  if (normalizedPolygon.length < 8 || sourcePoints.length < 8) {
    return null;
  }

  const pointXs = sourcePoints.map(([pointX]) => pointX);
  const pointYs = sourcePoints.map(([, pointY]) => pointY);
  const minX = Math.min(...pointXs);
  const maxX = Math.max(...pointXs);
  const minY = Math.min(...pointYs);
  const maxY = Math.max(...pointYs);

  return {
    normalizedPolygon,
    reference: {
      points: sourcePoints,
      viewBox: {
        minX,
        minY,
        width: Math.max(1, maxX - minX),
        height: Math.max(1, maxY - minY),
      },
    },
  };
};

const refreshPotatoHitPolygon = () => {
  if (!potatoCursor?.complete || !potatoCursor.naturalWidth || !potatoCursor.naturalHeight) {
    potatoHitPolygon = POTATO_HIT_POLYGON;
    potatoHitPolygonReference = DEFAULT_POTATO_REFERENCE;
    return;
  }

  const spritePolygon = buildPotatoHitPolygonFromSprite(potatoCursor);

  if (!spritePolygon) {
    potatoHitPolygon = POTATO_HIT_POLYGON;
    potatoHitPolygonReference = DEFAULT_POTATO_REFERENCE;
    return;
  }

  potatoHitPolygon = spritePolygon.normalizedPolygon;
  potatoHitPolygonReference = spritePolygon.reference;
};
const setPotatoCursorRotation = (rotation = potatoCursorRotation) => {
  if (!potatoCursor) {
    return;
  }

  potatoCursor.style.setProperty("--potato-cursor-rotation", `${rotation.toFixed(2)}deg`);
};

const runPotatoCursorRotation = () => {
  potatoCursorRotationTarget = lerp(potatoCursorRotationTarget, POTATO_CURSOR_BASE_ROTATION, 0.08);
  potatoCursorRotation = lerp(potatoCursorRotation, potatoCursorRotationTarget, 0.34);
  setPotatoCursorRotation();

  const isSettled =
    Math.abs(potatoCursorRotation - POTATO_CURSOR_BASE_ROTATION) < 0.12 &&
    Math.abs(potatoCursorRotationTarget - POTATO_CURSOR_BASE_ROTATION) < 0.12;

  if (isSettled) {
    potatoCursorRotationFrame = null;
    return;
  }

  potatoCursorRotationFrame = window.requestAnimationFrame(runPotatoCursorRotation);
};

const ensurePotatoCursorRotationFrame = () => {
  if (potatoCursorRotationFrame) {
    return;
  }

  potatoCursorRotationFrame = window.requestAnimationFrame(runPotatoCursorRotation);
};

const nudgePotatoCursorRotation = (deltaX, deltaY) => {
  potatoCursorRotationTarget = clamp(
    POTATO_CURSOR_BASE_ROTATION + deltaX * 0.72 + deltaY * 0.18,
    -72,
    42,
  );
  ensurePotatoCursorRotationFrame();
};

const resetPotatoCursorRotation = () => {
  potatoCursorRotationTarget = POTATO_CURSOR_BASE_ROTATION;
  ensurePotatoCursorRotationFrame();
};

const clearPotatoRespawnTimer = () => {
  if (!potatoRespawnTimer) {
    return;
  }

  window.clearTimeout(potatoRespawnTimer);
  potatoRespawnTimer = null;
};

const clearPotatoCursorReload = () => {
  if (potatoCursorReloadTimer) {
    window.clearTimeout(potatoCursorReloadTimer);
    potatoCursorReloadTimer = null;
  }

  potatoCursor?.classList.remove("is-spawning");
};

const isGameScreenActive = () => screens.game.classList.contains("is-active");

const setPotatoCursorVisible = (isVisible) => {
  if (!potatoCursor) {
    return;
  }

  potatoCursor.classList.toggle(
    "is-visible",
    isVisible && isGameScreenActive() && isPotatoReady && isPointerOverArena && isCursorPointerActive,
  );
};

const clearThrownPotatoes = () => {
  if (!potatoProjectiles || !potatoProjectilesBack) {
    return;
  }

  while (potatoProjectiles.firstChild) {
    potatoProjectiles.firstChild.remove();
  }

  while (potatoProjectilesBack.firstChild) {
    potatoProjectilesBack.firstChild.remove();
  }
};

const debugHitboxOverlay = (() => {
  if (!arenaScene) {
    return null;
  }

  const overlay = document.createElement("div");
  overlay.className = "debug-hitbox-overlay";
  overlay.hidden = true;
  arenaScene.appendChild(overlay);
  return overlay;
})();

const debugPotatoOverlay = (() => {
  if (!arenaScene) {
    return null;
  }

  const overlay = document.createElement("div");
  overlay.className = "debug-potato-overlay";
  overlay.innerHTML = `
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <polygon></polygon>
    </svg>
  `;
  overlay.hidden = true;
  arenaScene.appendChild(overlay);
  return overlay;
})();

const debugPotatoReference = (() => {
  if (!arenaScene) {
    return null;
  }

  const overlay = document.createElement("div");
  overlay.className = "debug-potato-reference";
  overlay.innerHTML = `
    <span class="debug-reference-label">Sprite Outline</span>
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <polygon></polygon>
    </svg>
  `;
  overlay.hidden = true;
  arenaScene.appendChild(overlay);
  return overlay;
})();

const stopDebugHitboxTracking = () => {
  if (!debugHitboxFrame) {
    return;
  }

  window.cancelAnimationFrame(debugHitboxFrame);
  debugHitboxFrame = null;
};

const updateDebugHitboxOverlay = () => {
  if (!debugHitboxOverlay || !debugPotatoOverlay || !debugPotatoReference || !photoMonolithFrame || !isDebugMode || !isGameScreenActive()) {
    if (debugHitboxOverlay) {
      debugHitboxOverlay.hidden = true;
    }
    if (debugPotatoOverlay) {
      debugPotatoOverlay.hidden = true;
    }
    if (debugPotatoReference) {
      debugPotatoReference.hidden = true;
    }
    return;
  }

  const targetRect = getPhotoHitRect();
  if (!targetRect) {
    debugHitboxOverlay.hidden = true;
    debugPotatoOverlay.hidden = true;
    return;
  }

  debugHitboxOverlay.hidden = false;
  debugHitboxOverlay.style.left = `${targetRect.left}px`;
  debugHitboxOverlay.style.top = `${targetRect.top}px`;
  debugHitboxOverlay.style.width = `${targetRect.width}px`;
  debugHitboxOverlay.style.height = `${targetRect.height}px`;

  debugPotatoReference.hidden = false;
  const referenceSvg = debugPotatoReference.querySelector("svg");
  const referencePolygon = debugPotatoReference.querySelector("polygon");
  if (referenceSvg) {
    const {
      minX,
      minY,
      width,
      height,
    } = potatoHitPolygonReference.viewBox;
    referenceSvg.setAttribute("viewBox", `${minX} ${minY} ${width} ${height}`);
    debugPotatoReference.style.setProperty("--debug-reference-aspect", `${width} / ${height}`);
  }
  if (referencePolygon) {
    referencePolygon.setAttribute(
      "points",
      potatoHitPolygonReference.points.map(([x, y]) => `${x},${y}`).join(" "),
    );
  }

  if (!lastThrowState) {
    debugPotatoOverlay.hidden = true;
    return;
  }

  const projectileRect = getProjectileHitRectAtProgress(
    POTATO_IMPACT_PROGRESS,
    lastThrowState.sceneX,
    lastThrowState.sceneY,
    lastThrowState.throwX,
    lastThrowState.initialVelocityY,
    lastThrowState.gravity,
    lastThrowState.rotationStart,
    lastThrowState.rotationTravel,
  );

  debugPotatoOverlay.hidden = false;
  debugPotatoOverlay.style.left = `${projectileRect.x}px`;
  debugPotatoOverlay.style.top = `${projectileRect.y}px`;
  debugPotatoOverlay.style.width = `${projectileRect.width}px`;
  debugPotatoOverlay.style.height = `${projectileRect.height}px`;
  const polygon = debugPotatoOverlay.querySelector("polygon");
  if (polygon) {
    polygon.setAttribute(
      "points",
      projectileRect.points
        .map((point) => `${((point.x - projectileRect.x) / projectileRect.width) * 100},${((point.y - projectileRect.y) / projectileRect.height) * 100}`)
        .join(" "),
    );
  }
};

const trackDebugHitboxOverlay = () => {
  updateDebugHitboxOverlay();

  if (!isDebugMode || !isGameScreenActive()) {
    debugHitboxFrame = null;
    return;
  }

  debugHitboxFrame = window.requestAnimationFrame(trackDebugHitboxOverlay);
};

const ensureDebugHitboxTracking = () => {
  if (debugHitboxFrame || !isDebugMode || !isGameScreenActive()) {
    return;
  }

  debugHitboxFrame = window.requestAnimationFrame(trackDebugHitboxOverlay);
};

const triggerPhotoHitEffect = () => {
  if (!photoMonolith || !photoMonolithFrame || !photoGroundShadow) {
    return;
  }

  if (photoHitTimer) {
    window.clearTimeout(photoHitTimer);
    photoHitTimer = null;
  }

  photoMonolith.classList.remove("is-hit");
  photoMonolithFrame.classList.remove("is-hit");
  photoGroundShadow.classList.remove("is-hit");

  void photoMonolithFrame.offsetWidth;

  photoMonolith.classList.add("is-hit");
  photoMonolithFrame.classList.add("is-hit");
  photoGroundShadow.classList.add("is-hit");

  photoHitTimer = window.setTimeout(() => {
    photoMonolith.classList.remove("is-hit");
    photoMonolithFrame.classList.remove("is-hit");
    photoGroundShadow.classList.remove("is-hit");
    photoHitTimer = null;
  }, 420);
};

const getArenaRelativeRect = (element) => {
  if (!arenaScene || !element) {
    return null;
  }

  const arenaRect = arenaScene.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();

  return {
    left: elementRect.left - arenaRect.left,
    right: elementRect.right - arenaRect.left,
    top: elementRect.top - arenaRect.top,
    bottom: elementRect.bottom - arenaRect.top,
    width: elementRect.width,
    height: elementRect.height,
  };
};

const getPhotoHitRect = () => {
  const targetRect = getArenaRelativeRect(photoMonolithFrame);
  if (!targetRect) {
    return null;
  }

  return {
    left: targetRect.left + PHOTO_HITBOX_INSET_X,
    right: targetRect.right - PHOTO_HITBOX_INSET_X,
    top: targetRect.top + PHOTO_HITBOX_INSET_Y,
    bottom: targetRect.bottom - PHOTO_HITBOX_INSET_Y,
    width: Math.max(0, targetRect.width - PHOTO_HITBOX_INSET_X * 2),
    height: Math.max(0, targetRect.height - PHOTO_HITBOX_INSET_Y * 2),
  };
};

const getProjectilePositionAtProgress = (
  progress,
  sceneX,
  sceneY,
  throwX,
  initialVelocityY,
  gravity,
) => {
  const x = sceneX + lerp(0, throwX, easeOutQuad(progress));
  const y = sceneY + initialVelocityY * progress + 0.5 * gravity * progress * progress;

  return { x, y };
};

const getProjectileRotationAtProgress = (progress, rotationStart, rotationTravel) => {
  const rotationProgress = 1 - (1 - progress) ** 1.18;
  return rotationStart + rotationTravel * rotationProgress;
};

const getProjectileScaleAtProgress = (progress) => lerp(1, 0.18, easeOutQuad(progress));

const rotatePoint = (pointX, pointY, originX, originY, angleRadians) => {
  const deltaX = pointX - originX;
  const deltaY = pointY - originY;
  const cos = Math.cos(angleRadians);
  const sin = Math.sin(angleRadians);

  return {
    x: originX + deltaX * cos - deltaY * sin,
    y: originY + deltaX * sin + deltaY * cos,
  };
};

const pointInRect = (point, rect) =>
  point.x >= rect.left
  && point.x <= rect.right
  && point.y >= rect.top
  && point.y <= rect.bottom;

const pointInPolygon = (point, polygon) => {
  let isInside = false;

  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    const intersects =
      ((currentPoint.y > point.y) !== (previousPoint.y > point.y))
      && (
        point.x
        < ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) / ((previousPoint.y - currentPoint.y) || 0.00001)
        + currentPoint.x
      );

    if (intersects) {
      isInside = !isInside;
    }
  }

  return isInside;
};

const lineSegmentsIntersect = (startA, endA, startB, endB) => {
  const cross = (pointA, pointB, pointC) =>
    (pointB.x - pointA.x) * (pointC.y - pointA.y) - (pointB.y - pointA.y) * (pointC.x - pointA.x);
  const onSegment = (pointA, pointB, pointC) =>
    Math.min(pointA.x, pointB.x) <= pointC.x
    && pointC.x <= Math.max(pointA.x, pointB.x)
    && Math.min(pointA.y, pointB.y) <= pointC.y
    && pointC.y <= Math.max(pointA.y, pointB.y);

  const direction1 = cross(startA, endA, startB);
  const direction2 = cross(startA, endA, endB);
  const direction3 = cross(startB, endB, startA);
  const direction4 = cross(startB, endB, endA);

  if (((direction1 > 0 && direction2 < 0) || (direction1 < 0 && direction2 > 0))
    && ((direction3 > 0 && direction4 < 0) || (direction3 < 0 && direction4 > 0))) {
    return true;
  }

  if (direction1 === 0 && onSegment(startA, endA, startB)) return true;
  if (direction2 === 0 && onSegment(startA, endA, endB)) return true;
  if (direction3 === 0 && onSegment(startB, endB, startA)) return true;
  if (direction4 === 0 && onSegment(startB, endB, endA)) return true;

  return false;
};

const polygonIntersectsRect = (polygon, rect) => {
  if (polygon.some((point) => pointInRect(point, rect))) {
    return true;
  }

  const rectPoints = [
    { x: rect.left, y: rect.top },
    { x: rect.right, y: rect.top },
    { x: rect.right, y: rect.bottom },
    { x: rect.left, y: rect.bottom },
  ];

  if (rectPoints.some((point) => pointInPolygon(point, polygon))) {
    return true;
  }

  const rectEdges = rectPoints.map((point, index) => [point, rectPoints[(index + 1) % rectPoints.length]]);

  for (let index = 0; index < polygon.length; index += 1) {
    const edgeStart = polygon[index];
    const edgeEnd = polygon[(index + 1) % polygon.length];

    if (rectEdges.some(([rectStart, rectEnd]) => lineSegmentsIntersect(edgeStart, edgeEnd, rectStart, rectEnd))) {
      return true;
    }
  }

  return false;
};

const getPotatoSpriteDimensions = () => {
  const baseWidth = potatoCursor?.getBoundingClientRect().width
    || parseFloat(window.getComputedStyle(arenaScene).getPropertyValue("--potato-cursor-size"))
    || 132;
  const aspectRatio = potatoCursor?.naturalWidth && potatoCursor?.naturalHeight
    ? potatoCursor.naturalHeight / potatoCursor.naturalWidth
    : 0.78;

  return { baseWidth, aspectRatio };
};

const getProjectileHitRectAtProgress = (
  progress,
  sceneX,
  sceneY,
  throwX,
  initialVelocityY,
  gravity,
  rotationStart,
  rotationTravel,
) => {
  const point = getProjectilePositionAtProgress(
    progress,
    sceneX,
    sceneY,
    throwX,
    initialVelocityY,
    gravity,
  );
  const { baseWidth, aspectRatio } = getPotatoSpriteDimensions();
  const scale = getProjectileScaleAtProgress(progress);
  const width = baseWidth * scale;
  const height = width * aspectRatio;
  const x = point.x - width * 0.42;
  const y = point.y - height * 0.4;
  const rotation = getProjectileRotationAtProgress(progress, rotationStart, rotationTravel);
  const rotationRadians = (rotation * Math.PI) / 180;
  const originX = x + width * 0.5;
  const originY = y + height * 0.55;
  const points = potatoHitPolygon.map(([normalizedX, normalizedY]) =>
    rotatePoint(
      x + width * normalizedX,
      y + height * normalizedY,
      originX,
      originY,
      rotationRadians,
    ));
  const pointXs = points.map((polygonPoint) => polygonPoint.x);
  const pointYs = points.map((polygonPoint) => polygonPoint.y);

  return {
    centerX: point.x,
    centerY: point.y,
    x: Math.min(...pointXs),
    y: Math.min(...pointYs),
    width: Math.max(...pointXs) - Math.min(...pointXs),
    height: Math.max(...pointYs) - Math.min(...pointYs),
    points,
  };
};

const resolveImpactAtProgress = ({
  progress,
  sceneX,
  sceneY,
  throwX,
  initialVelocityY,
  gravity,
  rotationStart,
  rotationTravel,
}) => {
  const targetRect = getPhotoHitRect();
  if (!targetRect) {
    return null;
  }

  const projectileRect = getProjectileHitRectAtProgress(
    progress,
    sceneX,
    sceneY,
    throwX,
    initialVelocityY,
    gravity,
    rotationStart,
    rotationTravel,
  );

  if (!polygonIntersectsRect(projectileRect.points, targetRect)) {
    return null;
  }

  return {
    progress,
    x: projectileRect.centerX,
    y: projectileRect.centerY,
  };
};

const getThrowState = (sceneX, sceneY, rect) => {
  const horizontalPull = (0.5 - sceneX / rect.width) * Math.min(rect.width * 0.2, 128);
  const verticalRatio = clamp(sceneY / rect.height, 0, 1);
  const maxDownwardTravel = clamp(rect.height * 0.14, 84, 144);
  const maxUpwardTravel = clamp(rect.height * 0.44, 280, 420);
  const throwX = Math.round(horizontalPull);
  const throwY = Math.round(lerp(maxDownwardTravel, -maxUpwardTravel, verticalRatio));
  const peakTime = lerp(0.48, 0.35, verticalRatio);
  const arcLift = clamp(rect.height * (0.16 + verticalRatio * 0.14), 110, 220);
  const arcOvershoot = clamp(Math.abs(throwY) * lerp(0.2, 0.34, verticalRatio), 44, 132);
  const throwArcY = Math.min(-Math.round(arcLift), throwY - arcOvershoot);
  const gravity = (2 * (throwArcY - throwY * peakTime)) / (peakTime * peakTime - peakTime);
  const initialVelocityY = throwY - 0.5 * gravity;
  const spinDirection = throwX === 0
    ? (potatoCursorRotation >= POTATO_CURSOR_BASE_ROTATION ? 1 : -1)
    : (throwX >= 0 ? 1 : -1);

  return {
    sceneX,
    sceneY,
    throwX,
    initialVelocityY,
    gravity,
    peakTime,
    rotationStart: potatoCursorRotation,
    rotationTravel: 188 * spinDirection,
  };
};

const getProjectileVisualStateAtProgress = (progress, throwState) => {
  const position = getProjectilePositionAtProgress(
    progress,
    throwState.sceneX,
    throwState.sceneY,
    throwState.throwX,
    throwState.initialVelocityY,
    throwState.gravity,
  );
  const rotation = getProjectileRotationAtProgress(
    progress,
    throwState.rotationStart,
    throwState.rotationTravel,
  );
  const scale = getProjectileScaleAtProgress(progress);
  const fadeProgress = clamp((progress - throwState.peakTime) / (1 - throwState.peakTime), 0, 1);
  const opacity = lerp(0.98, 0, easeInQuad(fadeProgress));

  return {
    x: position.x - throwState.sceneX,
    y: position.y - throwState.sceneY,
    rotation,
    scale,
    opacity,
  };
};

const spawnPotatoImpact = (impactPoint) => {
  if (!potatoProjectiles) {
    return;
  }

  const impact = document.createElement("div");
  impact.className = "potato-impact";
  impact.style.left = `${impactPoint.x}px`;
  impact.style.top = `${impactPoint.y}px`;
  impact.innerHTML = `
    <span class="potato-impact-dust"></span>
    <span class="potato-impact-shard shard-a"></span>
    <span class="potato-impact-shard shard-b"></span>
    <span class="potato-impact-shard shard-c"></span>
    <span class="potato-impact-shard shard-d"></span>
    <span class="potato-impact-shard shard-e"></span>
    <span class="potato-impact-shard shard-f"></span>
  `;

  potatoProjectiles.appendChild(impact);

  window.setTimeout(() => {
    impact.remove();
  }, 520);
};

const playPotatoCursorReload = () => {
  if (!potatoCursor) {
    return;
  }

  clearPotatoCursorReload();

  potatoCursor.style.setProperty("--potato-reload-x", `${18 * potatoReloadDirection}px`);
  potatoCursor.style.setProperty("--potato-reload-y", "10px");
  potatoCursor.style.setProperty("--potato-reload-rotation", `${12 * potatoReloadDirection}deg`);

  void potatoCursor.offsetWidth;
  potatoCursor.classList.add("is-spawning");

  potatoCursorReloadTimer = window.setTimeout(() => {
    potatoCursor.classList.remove("is-spawning");
    potatoCursorReloadTimer = null;
  }, POTATO_CURSOR_RELOAD_MS);
};

const queuePotatoRespawn = () => {
  clearPotatoRespawnTimer();

  potatoRespawnTimer = window.setTimeout(() => {
    isPotatoReady = true;
    potatoRespawnTimer = null;

    if (!isGameScreenActive() || !isPointerOverArena) {
      return;
    }

    syncPotatoCursor();
    setPotatoCursorVisible(true);
    playPotatoCursorReload();
  }, POTATO_RESPAWN_MS);
};

const syncPotatoCursor = (clientX = lastPointerPosition.x, clientY = lastPointerPosition.y) => {
  if (!arenaScene || !potatoCursor) {
    return null;
  }

  const rect = arenaScene.getBoundingClientRect();
  const sceneX = clamp(clientX - rect.left, 0, rect.width);
  const sceneY = clamp(clientY - rect.top, 0, rect.height);

  potatoCursor.style.left = `${sceneX}px`;
  potatoCursor.style.top = `${sceneY}px`;

  return { rect, sceneX, sceneY };
};

const throwPotato = (clientX, clientY) => {
  if (!arenaScene || !potatoProjectiles || !potatoProjectilesBack || !isGameScreenActive() || !isPotatoReady) {
    return;
  }

  const cursorState = syncPotatoCursor(clientX, clientY);
  if (!cursorState) {
    return;
  }

  const { rect, sceneX, sceneY } = cursorState;
  const throwState = getThrowState(sceneX, sceneY, rect);
  const {
    throwX,
    initialVelocityY,
    gravity,
    peakTime,
    rotationStart,
    rotationTravel,
  } = throwState;
  lastThrowState = throwState;

  isPotatoReady = false;
  potatoReloadDirection = throwX >= 0 ? -1 : 1;
  clearPotatoCursorReload();
  setPotatoCursorVisible(false);

  const projectile = document.createElement("img");
  projectile.className = "potato-projectile";
  projectile.src = POTATO_SPRITE_PATH;
  projectile.alt = "";
  projectile.draggable = false;
  projectile.decoding = "async";
  projectile.style.left = `${sceneX}px`;
  projectile.style.top = `${sceneY}px`;

  potatoProjectiles.appendChild(projectile);
  queuePotatoRespawn();
  projectile.style.transform =
    `translate(-42%, -40%) translate(0px, 0px) rotate(${rotationStart}deg) scale(1)`;

  const throwStart = window.performance.now();
  let hasMovedBehindPhoto = false;
  let hasResolvedImpact = false;

  const animateProjectile = (now) => {
    if (!projectile.isConnected) {
      return;
    }

    const progress = clamp((now - throwStart) / POTATO_THROW_MS, 0, 1);
    const visualState = getProjectileVisualStateAtProgress(progress, throwState);

    projectile.style.transform =
      `translate(-42%, -40%) translate(${visualState.x}px, ${visualState.y}px) rotate(${visualState.rotation}deg) scale(${visualState.scale})`;
    projectile.style.opacity = `${visualState.opacity}`;

    if (!hasResolvedImpact && progress >= POTATO_IMPACT_PROGRESS) {
      hasResolvedImpact = true;
      const impactPoint = resolveImpactAtProgress({
        progress: POTATO_IMPACT_PROGRESS,
        sceneX,
        sceneY,
        throwX,
        initialVelocityY,
        gravity,
        rotationStart,
        rotationTravel,
      });

      if (impactPoint) {
        projectile.remove();
        spawnPotatoImpact(impactPoint);
        triggerPhotoHitEffect();
        return;
      }
    }

    if (hasResolvedImpact && !hasMovedBehindPhoto && progress >= peakTime) {
      potatoProjectilesBack.appendChild(projectile);
      hasMovedBehindPhoto = true;
    }

    if (progress < 1) {
      window.requestAnimationFrame(animateProjectile);
      return;
    }

    projectile.remove();
  };

  window.requestAnimationFrame(animateProjectile);
};

const showScreen = (target) => {
  Object.entries(screens).forEach(([name, element]) => {
    const isActive = name === target;
    element.classList.toggle("is-active", isActive);
    element.setAttribute("aria-hidden", String(!isActive));
  });

  if (target === "game") {
    clearPotatoRespawnTimer();
    clearPotatoCursorReload();
    isPotatoReady = true;
    isPointerOverArena = isCursorPointerActive;
    resetPotatoCursorRotation();
    syncPotatoCursor();
    setPotatoCursorVisible(true);
    playPotatoCursorReload();
    ensureDebugHitboxTracking();
    return;
  }

  clearPotatoRespawnTimer();
  clearPotatoCursorReload();
  isPotatoReady = true;
  isPointerOverArena = false;
  resetPotatoCursorRotation();
  setPotatoCursorVisible(false);
  clearThrownPotatoes();
  lastThrowState = null;
  stopDebugHitboxTracking();
  updateDebugHitboxOverlay();
};

const rotateHello = () => {
  helloWords[helloIndex].classList.remove("is-visible");
  helloIndex = (helloIndex + 1) % helloWords.length;
  helloWords[helloIndex].classList.add("is-visible");
};

const updateLaunchState = () => {
  launchButton.disabled = !activePhoto;
};

const readClipboardImageFile = async () => {
  if (!navigator.clipboard?.read) {
    throw new Error("Clipboard read unavailable");
  }

  const clipboardItems = await navigator.clipboard.read();
  for (const clipboardItem of clipboardItems) {
    const imageType = clipboardItem.types.find((type) => type.startsWith("image/"));
    if (!imageType) {
      continue;
    }

    const blob = await clipboardItem.getType(imageType);
    const extension = imageType.split("/")[1] || "png";
    return new File([blob], `clipboard-image.${extension}`, { type: imageType });
  }

  throw new Error("No image in clipboard");
};

const setNoticeOpen = (isOpen) => {
  if (noticeHideTimer) {
    window.clearTimeout(noticeHideTimer);
    noticeHideTimer = null;
  }

  if (isOpen) {
    noticeModal.hidden = false;
    noticeModal.classList.remove("is-closing");
    document.body.style.overflow = "hidden";

    window.requestAnimationFrame(() => {
      noticeModal.classList.add("is-visible");
    });
    return;
  }

  noticeModal.classList.remove("is-visible");
  noticeModal.classList.add("is-closing");

  noticeHideTimer = window.setTimeout(() => {
    noticeModal.hidden = true;
    noticeModal.classList.remove("is-closing");
    document.body.style.overflow = "";
    noticeHideTimer = null;
  }, NOTICE_ANIMATION_MS);
};

const launchGame = () => {
  if ((!activePhoto && !isDebugMode) || !gamePhoto) {
    return;
  }

  gameSessionLabel.textContent = isDebugMode
    ? "Debug Mode"
    : (sessionName.value.trim() || "Potato Target");
  gameFileName.textContent = isDebugMode ? "debug-target" : activePhoto.name;
  showScreen("game");
};

const enterDebugMode = () => {
  if (!gamePhoto || !previewImage) {
    return;
  }

  isDebugMode = true;
  activePhoto = {
    name: "debug-target",
    type: "image/svg+xml",
  };

  previewImage.src = DEBUG_TARGET_DATA_URI;
  gamePhoto.src = DEBUG_TARGET_DATA_URI;
  fileName.textContent = "debug-target";
  uploadIdle.hidden = true;
  uploadPreview.hidden = false;
  updateLaunchState();
  launchGame();
};

const applyFile = (file) => {
  if (!file || !file.type.startsWith("image/")) {
    return;
  }

  isDebugMode = false;
  activePhoto = file;
  fileName.textContent = file.name;

  const reader = new FileReader();
  reader.onload = (event) => {
    const imageSource = event.target?.result;
    previewImage.src = imageSource;
    gamePhoto.src = imageSource;
    uploadIdle.hidden = true;
    uploadPreview.hidden = false;
    updateLaunchState();
  };
  reader.readAsDataURL(file);
};

startButton.addEventListener("click", () => {
  showScreen("setup");
});

welcomeTitle?.addEventListener("dblclick", (event) => {
  event.preventDefault();
  enterDebugMode();
});

photoInput.addEventListener("change", (event) => {
  const [file] = event.target.files ?? [];
  applyFile(file);
});

clipboardButton?.addEventListener("click", async () => {
  try {
    const file = await readClipboardImageFile();
    applyFile(file);
  } catch (error) {
    window.alert("클립보드 이미지 읽기를 지원하지 않거나 현재 클립보드에 이미지가 없습니다.\n이미지를 복사한 뒤 Ctrl+V로도 붙여넣을 수 있습니다.");
  }
});

["dragenter", "dragover"].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.add("is-dragging");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.remove("is-dragging");
  });
});

dropzone.addEventListener("drop", (event) => {
  const [file] = event.dataTransfer?.files ?? [];
  applyFile(file);
});

window.addEventListener("paste", (event) => {
  const clipboardItems = Array.from(event.clipboardData?.items ?? []);
  const imageItem = clipboardItems.find((item) => item.type.startsWith("image/"));
  const file = imageItem?.getAsFile();

  if (!file) {
    return;
  }

  event.preventDefault();
  applyFile(file);
});

launchButton.addEventListener("click", (event) => {
  if (!activePhoto) {
    return;
  }

  event.preventDefault();
  setNoticeOpen(true);
});

noticeCloseButton.addEventListener("click", () => {
  setNoticeOpen(false);
});

noticeConfirmButton.addEventListener("click", () => {
  setNoticeOpen(false);
  window.setTimeout(() => {
    launchGame();
  }, NOTICE_ANIMATION_MS - 40);
});

noticeModal.addEventListener("click", (event) => {
  if (event.target === noticeModal) {
    setNoticeOpen(false);
  }
});

window.addEventListener("pointermove", (event) => {
  if (event.pointerType !== "mouse") {
    return;
  }

  const pointerDeltaX = event.clientX - lastPointerPosition.x;
  const pointerDeltaY = event.clientY - lastPointerPosition.y;
  lastPointerPosition = { x: event.clientX, y: event.clientY };
  nudgePotatoCursorRotation(pointerDeltaX, pointerDeltaY);
  isCursorPointerActive = true;

  if (!isGameScreenActive()) {
    return;
  }

  const arenaRect = arenaScene?.getBoundingClientRect();
  if (!arenaRect) {
    return;
  }

  isPointerOverArena =
    event.clientX >= arenaRect.left &&
    event.clientX <= arenaRect.right &&
    event.clientY >= arenaRect.top &&
    event.clientY <= arenaRect.bottom;

  if (!isPointerOverArena) {
    setPotatoCursorVisible(false);
    return;
  }

  syncPotatoCursor(event.clientX, event.clientY);
  setPotatoCursorVisible(true);
});

arenaScene?.addEventListener("pointerleave", () => {
  isPointerOverArena = false;
  resetPotatoCursorRotation();
  setPotatoCursorVisible(false);
});

arenaScene?.addEventListener("pointerenter", (event) => {
  if (event.pointerType === "mouse") {
    isCursorPointerActive = true;
  } else {
    isCursorPointerActive = false;
  }

  if (event.pointerType !== "mouse") {
    setPotatoCursorVisible(false);
    return;
  }

  isPointerOverArena = true;
  lastPointerPosition = { x: event.clientX, y: event.clientY };
  resetPotatoCursorRotation();
  syncPotatoCursor(event.clientX, event.clientY);
  setPotatoCursorVisible(true);
});

arenaScene?.addEventListener("pointerdown", (event) => {
  const isMousePrimaryClick = event.pointerType === "mouse" && event.button === 0;
  const isDirectTouchThrow = event.pointerType === "touch" || event.pointerType === "pen";

  if (!isMousePrimaryClick && !isDirectTouchThrow) {
    return;
  }

  event.preventDefault();
  isCursorPointerActive = event.pointerType === "mouse";
  isPointerOverArena = true;
  lastPointerPosition = { x: event.clientX, y: event.clientY };
  throwPotato(event.clientX, event.clientY);
});

window.addEventListener("resize", () => {
  if (!isGameScreenActive()) {
    return;
  }

  syncPotatoCursor();
  updateDebugHitboxOverlay();
});

window.addEventListener("blur", () => {
  isPointerOverArena = false;
  isCursorPointerActive = false;
  clearPotatoCursorReload();
  resetPotatoCursorRotation();
  setPotatoCursorVisible(false);
  stopDebugHitboxTracking();
});

potatoCursor?.addEventListener("load", () => {
  refreshPotatoHitPolygon();
  updateDebugHitboxOverlay();
});

if (potatoCursor?.complete) {
  refreshPotatoHitPolygon();
}

helloWords[helloIndex].classList.add("is-visible");
updateLaunchState();
setPotatoCursorRotation();
window.setInterval(rotateHello, 1600);
