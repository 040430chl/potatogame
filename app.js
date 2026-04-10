const screens = {
  welcome: document.querySelector('[data-screen="welcome"]'),
  setup: document.querySelector('[data-screen="setup"]'),
  game: document.querySelector('[data-screen="game"]'),
};

const helloWords = Array.from(document.querySelectorAll(".hello-word"));
const startButton = document.getElementById("startButton");
const launchButton = document.getElementById("launchButton");
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
const photoMonolithFrame = document.querySelector(".photo-monolith-frame");
const potatoCursor = document.getElementById("potatoCursor");
const potatoProjectiles = document.getElementById("potatoProjectiles");

const NOTICE_ANIMATION_MS = 320;
const POTATO_SPRITE_PATH = "./resources/common_potato.png";
const POTATO_THROW_MS = 860;
const POTATO_RESPAWN_MS = 110;
const POTATO_CURSOR_RELOAD_MS = 95;
const POTATO_CURSOR_BASE_ROTATION = -18;
const POTATO_IMPACT_SAMPLES = 96;
const POTATO_IMPACT_RADIUS = 26;

let helloIndex = 0;
let activePhoto = null;
let noticeHideTimer = null;
let potatoRespawnTimer = null;
let potatoCursorReloadTimer = null;
let potatoCursorRotationFrame = null;
let isPotatoReady = true;
let isPointerOverArena = false;
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
    isVisible && isGameScreenActive() && isPotatoReady && isPointerOverArena,
  );
};

const clearThrownPotatoes = () => {
  if (!potatoProjectiles) {
    return;
  }

  while (potatoProjectiles.firstChild) {
    potatoProjectiles.firstChild.remove();
  }
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

const findImpactPoint = ({
  sceneX,
  sceneY,
  throwX,
  initialVelocityY,
  gravity,
  peakTime,
}) => {
  const targetRect = getArenaRelativeRect(photoMonolithFrame);
  if (!targetRect) {
    return null;
  }

  const paddedRect = {
    left: targetRect.left - POTATO_IMPACT_RADIUS,
    right: targetRect.right + POTATO_IMPACT_RADIUS,
    top: targetRect.top - POTATO_IMPACT_RADIUS,
    bottom: targetRect.bottom + POTATO_IMPACT_RADIUS,
  };

  const sampleStart = Math.max(peakTime, 0.08);

  for (let index = 0; index <= POTATO_IMPACT_SAMPLES; index += 1) {
    const progress = lerp(sampleStart, 1, index / POTATO_IMPACT_SAMPLES);
    const point = getProjectilePositionAtProgress(
      progress,
      sceneX,
      sceneY,
      throwX,
      initialVelocityY,
      gravity,
    );

    if (
      point.x >= paddedRect.left &&
      point.x <= paddedRect.right &&
      point.y >= paddedRect.top &&
      point.y <= paddedRect.bottom
    ) {
      return {
        progress,
        x: point.x,
        y: point.y,
        targetRect,
      };
    }
  }

  return null;
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
  if (!arenaScene || !potatoProjectiles || !isGameScreenActive() || !isPotatoReady) {
    return;
  }

  const cursorState = syncPotatoCursor(clientX, clientY);
  if (!cursorState) {
    return;
  }

  const { rect, sceneX, sceneY } = cursorState;
  const horizontalPull = (0.5 - sceneX / rect.width) * Math.min(rect.width * 0.2, 128);
  const verticalRatio = clamp(sceneY / rect.height, 0, 1);
  const maxDownwardTravel = clamp(rect.height * 0.14, 84, 144);
  const maxUpwardTravel = clamp(rect.height * 0.44, 280, 420);
  const throwX = Math.round(horizontalPull);
  const throwY = Math.round(lerp(maxDownwardTravel, -maxUpwardTravel, verticalRatio));
  const peakTime = lerp(0.48, 0.35, verticalRatio);
  const arcLift = clamp(rect.height * (0.16 + verticalRatio * 0.14), 110, 220);
  const arcOvershoot = clamp(Math.abs(throwY) * lerp(0.2, 0.34, verticalRatio), 44, 132);
  const throwArcX = Math.round(throwX * 0.38);
  const throwArcY = Math.min(-Math.round(arcLift), throwY - arcOvershoot);
  const gravity = (2 * (throwArcY - throwY * peakTime)) / (peakTime * peakTime - peakTime);
  const initialVelocityY = throwY - 0.5 * gravity;
  const impactPoint = findImpactPoint({
    sceneX,
    sceneY,
    throwX,
    initialVelocityY,
    gravity,
    peakTime,
  });
  const spinDirection = throwX === 0
    ? (potatoCursorRotation >= POTATO_CURSOR_BASE_ROTATION ? 1 : -1)
    : (throwX >= 0 ? 1 : -1);
  const rotationStart = potatoCursorRotation;
  const rotationTravel = 188 * spinDirection;

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

  const animateProjectile = (now) => {
    if (!projectile.isConnected) {
      return;
    }

    const progress = clamp((now - throwStart) / POTATO_THROW_MS, 0, 1);
    const x = lerp(0, throwX, easeOutQuad(progress));
    const y = initialVelocityY * progress + 0.5 * gravity * progress * progress;
    const rotationProgress = 1 - (1 - progress) ** 1.18;
    const rotation = rotationStart + rotationTravel * rotationProgress;
    const scale = lerp(1, 0.18, easeOutQuad(progress));
    const fadeProgress = clamp((progress - peakTime) / (1 - peakTime), 0, 1);
    const opacity = lerp(0.98, 0, easeInQuad(fadeProgress));

    projectile.style.transform =
      `translate(-42%, -40%) translate(${x}px, ${y}px) rotate(${rotation}deg) scale(${scale})`;
    projectile.style.opacity = `${opacity}`;

    if (impactPoint && progress >= impactPoint.progress) {
      projectile.remove();
      spawnPotatoImpact(impactPoint);
      return;
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
    isPointerOverArena = true;
    resetPotatoCursorRotation();
    syncPotatoCursor();
    setPotatoCursorVisible(true);
    playPotatoCursorReload();
    return;
  }

  clearPotatoRespawnTimer();
  clearPotatoCursorReload();
  isPotatoReady = true;
  isPointerOverArena = false;
  resetPotatoCursorRotation();
  setPotatoCursorVisible(false);
  clearThrownPotatoes();
};

const rotateHello = () => {
  helloWords[helloIndex].classList.remove("is-visible");
  helloIndex = (helloIndex + 1) % helloWords.length;
  helloWords[helloIndex].classList.add("is-visible");
};

const updateLaunchState = () => {
  launchButton.disabled = !activePhoto;
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
  if (!activePhoto || !gamePhoto) {
    return;
  }

  gameSessionLabel.textContent = sessionName.value.trim() || "Potato Target";
  gameFileName.textContent = activePhoto.name;
  showScreen("game");
};

const applyFile = (file) => {
  if (!file || !file.type.startsWith("image/")) {
    return;
  }

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

photoInput.addEventListener("change", (event) => {
  const [file] = event.target.files ?? [];
  applyFile(file);
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
  if (event.pointerType !== "mouse") {
    return;
  }

  isPointerOverArena = true;
  lastPointerPosition = { x: event.clientX, y: event.clientY };
  resetPotatoCursorRotation();
  syncPotatoCursor(event.clientX, event.clientY);
  setPotatoCursorVisible(true);
});

arenaScene?.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "mouse" || event.button !== 0) {
    return;
  }

  event.preventDefault();
  isPointerOverArena = true;
  lastPointerPosition = { x: event.clientX, y: event.clientY };
  throwPotato(event.clientX, event.clientY);
});

window.addEventListener("resize", () => {
  if (!isGameScreenActive()) {
    return;
  }

  syncPotatoCursor();
});

window.addEventListener("blur", () => {
  isPointerOverArena = false;
  clearPotatoCursorReload();
  resetPotatoCursorRotation();
  setPotatoCursorVisible(false);
});

helloWords[helloIndex].classList.add("is-visible");
updateLaunchState();
setPotatoCursorRotation();
window.setInterval(rotateHello, 1600);
