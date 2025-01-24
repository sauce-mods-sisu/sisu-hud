import * as common from '/pages/src/common.mjs';

const hudContent      = document.getElementById('hud-content');
const resizeHandle    = document.querySelector('.resize-handle');
const statsContainer  = document.getElementById('stats-container');
const scaleSlider     = document.getElementById('scale-slider');
const resetBtn        = document.getElementById('reset-visibility-btn');

let USER = 0;

const settings             = common.settingsStore.get();
const configNamespace      = "sisu-hud-config-";
const fieldStateSettingKey = configNamespace + 'hudFieldOrder';
const boundingBoxSettingsKey = configNamespace + 'sisu-hud-bounds';
const textScalingFactorSettingsKey = configNamespace + 'sisu-hud-text-scaling';
const modalSettingsKey = configNamespace + 'sisu-general-settings';

const renderer             = new common.Renderer(hudContent, { fps: 2 });

let fields = [
  { id: 'cadence', label: 'Cadence', icon: 'icons/cadence.svg', valueClass: 'cadence-value',  isVisible: true },
  { id: 'draft',   label: 'Draft',   icon: 'icons/wind.svg',     valueClass: 'draft-value',    isVisible: true },
  { id: 'hr',      label: 'Heart Rate', icon: 'icons/heart.svg', valueClass: 'hr-value',       isVisible: true },
  { id: 'power',   label: 'Power',   icon: 'icons/bolt.svg',     valueClass: 'power-value',    isVisible: true },
  { id: 'wkg',     label: 'w/kg',    icon: 'icons/wkg.svg',      valueClass: 'wkg-value',      isVisible: true },
  { id: 'speed',   label: 'Speed',   icon: 'icons/speedometer.svg', valueClass: 'speed-value', isVisible: true },
  { id: 'wbal',    label: 'wBal',    icon: 'icons/battery-half.svg', valueClass: 'wbal-value', isVisible: true },
  { id: 'time',    label: 'Time on Course', icon: 'icons/clock.svg', valueClass: 'time-value', isVisible: true },
  { id: 'kj',    label: 'kj', icon: 'icons/kj.svg', valueClass: 'kj-value', isVisible: true },
  { id: 'distance',    label: 'distance', icon: 'icons/ruler-horizontal.svg', valueClass: 'distance-value', isVisible: true },
  { id: 'climb',    label: 'climb', icon: 'icons/mountain.svg', valueClass: 'climb-value', isVisible: true },
  { id: 'grade',    label: 'Grade', icon: 'icons/grade.svg', valueClass: 'grade-value', isVisible: true },
];

// Assume this code runs in the same scope you have `settings` and `modalSettingsKey`
// Parse the JSON
const modalSettings = JSON.parse(settings[modalSettingsKey] || "{}");

// Attempt to get iconColor with fallback
let iconColor = modalSettings?.iconColor ?? "black";

// Now you can see if the data is present and if the fallback is being triggered.


// Load saved field state
const savedFieldState = JSON.parse(settings[fieldStateSettingKey] || "[]");
if (Array.isArray(savedFieldState)) {
  savedFieldState.forEach(saved => {
    const orig = fields.find(f => f.id === saved.id);
    if (orig) orig.isVisible = saved.isVisible;
  });
  fields.sort((a, b) =>
    savedFieldState.findIndex(x => x.id === a.id) -
    savedFieldState.findIndex(x => x.id === b.id)
  );
}

// Load bounding box positions
const hudBox = settings[boundingBoxSettingsKey] || false;
if (hudBox) {
  hudContent.style.width  = hudBox.width  + "px";
  hudContent.style.height = hudBox.height + "px";
  hudContent.style.top    = hudBox.top    + "px";
  hudContent.style.left   = hudBox.left   + "px";
} else {
  // defaults
  hudContent.style.top = "5vh";
  hudContent.style.left = "5vw";
  hudContent.style.width = "50vw";
  hudContent.style.height = "40vh";
}

// Load saved text scaling factor
const baseFontSize = 48;

const savedScale = parseFloat(settings[textScalingFactorSettingsKey] || "1");
scaleSlider.value = savedScale;
statsContainer.style.fontSize = (baseFontSize * savedScale) + 'px';

renderFields();
initDragAndDrop();

let startX, startY, originalWidth, originalHeight;

resizeHandle.addEventListener('mousedown', e => {
  e.preventDefault();
  startX = e.clientX; startY = e.clientY;
  originalWidth  = hudContent.offsetWidth;
  originalHeight = hudContent.offsetHeight;
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
});

function onMouseMove(e) {
  const dx = e.clientX - startX;
  const dy = e.clientY - startY;

  let newWidth = originalWidth + dx;
  let newHeight = originalHeight + dy;

  const winWidth = window.innerWidth * 0.95;
  const winHeight = window.innerHeight * 0.95;

  newWidth = Math.min(newWidth, winWidth);
  newHeight = Math.min(newHeight, winHeight);

  newWidth = Math.max(newWidth, 100);
  newHeight = Math.max(newHeight, 100);

  hudContent.style.width = newWidth + 'px';
  hudContent.style.height = newHeight + 'px';
}

function saveHudBox() {
  const rect = hudContent.getBoundingClientRect();
  const hudBox = {
    width:  rect.width,
    height: rect.height,
    top:    rect.top,
    left:   rect.left
  };
  common.settingsStore.set(boundingBoxSettingsKey, hudBox);
}

function onMouseUp() {
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup', onMouseUp);

  saveHudBox();
}

scaleSlider.addEventListener('input', e => {
  const scale = parseFloat(e.target.value);
  statsContainer.style.fontSize = (baseFontSize * scale) + 'px';
  common.settingsStore.set(textScalingFactorSettingsKey, scale);
});

resetBtn.addEventListener('click', resetAllVisibility);

function initDragAndDrop() {
  new Sortable(statsContainer, {
    animation: 150,
    handle: '.stat-row',
    onEnd: () => {
      const newOrder = [...statsContainer.querySelectorAll('.stat-row')]
        .map(el => el.dataset.id);
      fields.sort((a, b) => newOrder.indexOf(a.id) - newOrder.indexOf(b.id));
      saveFields();
    }
  });
}

function resetAllVisibility() {
  fields.forEach(f => f.isVisible = true);
  saveFields();
  renderFields();
}

function hideField(fieldId, rowElement) {
  rowElement.remove();
  const field = fields.find(f => f.id === fieldId);
  if (!field) return;
  field.isVisible = false;
  saveFields();
}

async function inlineSvgIcon(container, svgUrl, color) {
  try {
    const response = await fetch(svgUrl);
    if (!response.ok) {
      console.error(`Failed to fetch ${svgUrl}`, response.status);
      return;
    }
    const svgText = await response.text();

    // Parse the string into a live DOM node
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, "image/svg+xml");
    const svgElem = doc.querySelector('svg');

    if (!svgElem) {
      console.error(`No <svg> found in ${svgUrl}`);
      return;
    }

    // OPTIONAL: set a default fill or use "currentColor" technique
    // svgElem.style.fill = '#888'; 

    // Clear out container and insert the <svg>
    container.innerHTML = "";
    container.appendChild(svgElem);
    if (color) {
      svgElem.style.color = color;
    }
  } catch (err) {
    console.error(`Error loading ${svgUrl}`, err);
  }
}

function renderFields() {
  statsContainer.innerHTML = '';
  fields.forEach(field => {
    if (!field.isVisible) return;

    const row = document.createElement('div');
    row.classList.add('stat-row');
    row.dataset.id = field.id;

    // 1) Create container for the icon
    const iconContainer = document.createElement('div');
    iconContainer.classList.add('stat-icon');
    iconContainer.dataset.src = field.icon;
    iconContainer.addEventListener('contextmenu', e => {
      e.preventDefault();
      hideField(field.id, row);
    });
    row.appendChild(iconContainer);

    // 2) Create the data value <span>
    const span = document.createElement('span');
    span.classList.add('stat-value', field.valueClass);
    row.appendChild(span);

    // 3) Append row to DOM
    statsContainer.appendChild(row);
    // 4) *Now* fetch & inline the icon
    inlineSvgIcon(iconContainer, field.icon, iconColor);
  });
}

function saveFields() {
  common.settingsStore.set(fieldStateSettingKey, JSON.stringify(fields));
}

function updateStats(data) {
  fields.forEach(field => {
    const span = document.querySelector(`.${field.valueClass}`);
    if (!span) return;
    const val = data[field.id];
    span.textContent = val != null ? val : '--';
  });
}

const closeBtn = document.getElementById('close-btn');
if (closeBtn) {
  closeBtn.addEventListener('click', () => {
    window.close();
  });
}

window.addEventListener('resize', onWindowResize);

function clampHud(winWidth, winHeight) {
  const hudRect = hudContent.getBoundingClientRect();

  // 1) Possibly shrink HUD to fit if it’s bigger than window
  let newW = hudRect.width;
  let newH = hudRect.height;
  if (newW > winWidth) newW = winWidth;
  if (newH > winHeight) newH = winHeight;

  hudContent.style.width = newW + 'px';
  hudContent.style.height = newH + 'px';

  // 2) Re-check bounding box after we’ve adjusted size
  const newRect = hudContent.getBoundingClientRect();
  let currentLeft = parseFloat(hudContent.style.left) || newRect.left;
  let currentTop  = parseFloat(hudContent.style.top)  || newRect.top;

  // 3) Clamp position: if right or bottom edge is off-screen, move it back
  if (currentLeft + newRect.width > winWidth) {
    currentLeft = winWidth - newRect.width;
  }
  if (currentTop + newRect.height > winHeight) {
    currentTop = winHeight - newRect.height;
  }

  // 4) Prevent negative
  if (currentLeft < 0) currentLeft = 0;
  if (currentTop < 0) currentTop = 0;

  hudContent.style.left = currentLeft + 'px';
  hudContent.style.top  = currentTop + 'px';
}

function onWindowResize() {
  console.log('Window Resize!')
  // The window has a new width/height:
  const winWidth = window.innerWidth;
  const winHeight = window.innerHeight;

  clampHud(winWidth, winHeight);
}


renderer.addCallback(rawData => {
  if (!rawData) return;

  const athlete = rawData.athlete || {};
  const state   = rawData.state   || {};

  const numericPower  = Number(state.power  ?? 0);
  const numericWeight = Number(athlete.weight ?? 0);
  const numericWBal   = Number(rawData.wBal ?? -1);

  const updatedStats = {
    cadence: (state.cadence !== undefined) ? Number(state.cadence).toFixed(0) : "N/A",
    draft:   (state.draft   !== undefined) ? Number(state.draft).toFixed(0)   : "N/A",
    hr:      (state.heartrate && state.heartrate !== 0) ? Number(state.heartrate).toFixed(0) : "--",
    power:   (numericPower || numericPower === 0) ? numericPower.toFixed(0)   : "N/A",
    speed:   (state.speed   !== undefined) ? Number(state.speed).toFixed(1)   : "N/A",
    wkg:     (numericWeight > 0)           ? (numericPower / numericWeight).toFixed(2) : "N/A",
    time:    (state.time    !== undefined) ? formatTime(Number(state.time).toFixed(0)) : "--",
    kj:    (state.kj    !== undefined) ? Number(state.kj).toFixed(0) : "--",
    distance: (state.distance !== undefined)
    ? ((Number(state.distance) / 1000).toFixed(1) + " km")
    : "--",
    climb:    (state.climbing    !== undefined) ? Number(state.climbing).toFixed(0) : "--",
    wbal:    "N/A",
    grade: (state.grade !== undefined)
    ? (Number(state.grade) * 100).toFixed(2)  + " %"
    : "--",
  };

  if (numericWBal >= 0) {
    const kj = numericWBal / 1000;
    updatedStats.wbal = (Math.floor(kj * 10) / 10).toFixed(1) + " kj";
  }

  updateStats(updatedStats);
});

function formatTime(secondsString) {
  if (typeof secondsString !== "string") return "--";
  const totalSeconds = parseInt(secondsString, 10);
  if (Number.isNaN(totalSeconds)) return "--";
  const hours   = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs    = totalSeconds % 60;
  return `${hours}:${String(minutes).padStart(2,"0")}:${String(secs).padStart(2,"0")}`;
}

document.addEventListener('DOMContentLoaded', () => {
  const dialog = document.getElementById('config-dialog');
  const openConfigBtn = document.getElementById('open-config-btn');
  const closeConfigBtn = document.getElementById('close-config-btn');
  const saveConfigBtn = document.getElementById('save-config-btn');
  const configForm = document.getElementById('config-form');

  // === Load/Save functions (just examples; your real code may differ) ===
  function loadSettings() {
   
  }

  function saveSettings(modalSettings) {
    common.settingsStore.set(modalSettingsKey, JSON.stringify(modalSettings));
  }

  function applySettings(settings) {
    const iconColor = settings.iconColor || '#000';

    // For each inline <svg> we already inserted:
    document.querySelectorAll('.stat-icon-container svg').forEach(svgEl => {
      svgEl.style.fill = iconColor;
    });
  }

  // applySettings(settings);

  // =====================================================================


  openConfigBtn.addEventListener('click', () => {
    dialog.showModal();
  });

  closeConfigBtn.addEventListener('click', () => {
    dialog.close();
  });

  // Handle "Save" in the dialog
  saveConfigBtn.addEventListener('click', (e) => {
    e.preventDefault(); // Stop the <form> from closing the dialog automatically
    
    console.log('--- Begin Save Handler Debug ---');
    
    // 1. Read form data
    const formData = new FormData(configForm);
  
    // 2. See every entry in the form (including the color picker)
    console.log('Form data entries:');
    for (const [key, value] of formData.entries()) {
      console.log(`  ${key} = ${value}`);
    }
  
    // 3. Build newSettings from what’s in `settings`
    const newSettings = {};
    // Object.keys(settings).forEach(key => {
    //   // For each known key, we’re interpreting "on" or null from checkboxes
    //   newSettings[key] = formData.get(key) === 'on';
    // });
  
    // If you actually want to save the iconColor, handle it explicitly
    // (because above logic only works for checkboxes).
    let iconColor = formData.get('iconColor') || '#000000';
  
    document.querySelectorAll('.stat-icon svg').forEach(svgEl => {
      svgEl.style.fill = iconColor;
    });
    // 4. Debug print what newSettings looks like
    console.log('newSettings before saving:', newSettings);
  
    newSettings.iconColor = iconColor;
    // 5. Save & Apply
    saveSettings(newSettings);
    console.log('Settings saved! Now calling applySettings().');
  
    //applySettings(newSettings);
  
    // 6. Close the dialog
    dialog.close();
  
    console.log('--- End Save Handler Debug ---');
  });  
});

async function main() {
  common.subscribe('athlete/watching', async data => {
    if (data.athleteId != USER) {
      USER = data.athleteId;
      console.log("Switched to", USER);
    }
    renderer.setData(data);
    renderer.render();
  });
  addEventListener('resize', () => renderer.render({ force: true }));
  renderer.render();
}
main();
