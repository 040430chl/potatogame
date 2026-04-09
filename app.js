const screens = {
  welcome: document.querySelector('[data-screen="welcome"]'),
  setup: document.querySelector('[data-screen="setup"]'),
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

let helloIndex = 0;
let activePhoto = null;

const showScreen = (target) => {
  Object.entries(screens).forEach(([name, element]) => {
    const isActive = name === target;
    element.classList.toggle("is-active", isActive);
    element.setAttribute("aria-hidden", String(!isActive));
  });
};

const rotateHello = () => {
  helloWords[helloIndex].classList.remove("is-visible");
  helloIndex = (helloIndex + 1) % helloWords.length;
  helloWords[helloIndex].classList.add("is-visible");
};

const updateLaunchState = () => {
  launchButton.disabled = !activePhoto;
};

const applyFile = (file) => {
  if (!file || !file.type.startsWith("image/")) {
    return;
  }

  activePhoto = file;
  fileName.textContent = file.name;

  const reader = new FileReader();
  reader.onload = (event) => {
    previewImage.src = event.target?.result;
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

launchButton.addEventListener("click", () => {
  const sessionLabel = sessionName.value.trim() || "새 세션";
  window.alert(`"${sessionLabel}" 준비 완료.\n다음 단계에서 감자 던지기 게임 화면을 연결하면 됩니다.`);
});

helloWords[helloIndex].classList.add("is-visible");
updateLaunchState();
window.setInterval(rotateHello, 1600);
