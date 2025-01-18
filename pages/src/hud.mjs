import * as common from '/pages/src/common.mjs';

const hudContent      = document.getElementById('hud-content');
const resizeHandle    = document.querySelector('.resize-handle');
const statsContainer  = document.getElementById('stats-container');
const scaleSlider     = document.getElementById('scale-slider');
const resetBtn        = document.getElementById('reset-visibility-btn');
const tmpl            = document.getElementById('stats-template');

let USER = 0;
const settings             = common.settingsStore.get();
const configNamespace      = "sisu-hud-config-";
const fieldStateSettingKey = configNamespace + 'hudFieldOrder';
const renderer             = new common.Renderer(hudContent, { fps: 1 });

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
  { id: 'climb',    label: 'climb', icon: 'icons/mountain.svg', valueClass: 'climb-value', isVisible: true }
];

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
  hudContent.style.width  = Math.max(100, originalWidth + dx) + 'px';
  hudContent.style.height = Math.max(50,  originalHeight + dy) + 'px';
}

function onMouseUp() {
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup', onMouseUp);
}

scaleSlider.addEventListener('input', e => {
  const scale = parseFloat(e.target.value);
  statsContainer.style.fontSize = (24 * scale) + 'px';
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

function hideField(fieldId) {
  console.log("hideField for:", fieldId);
  const field = fields.find(f => f.id === fieldId);
  if (!field) return;
  field.isVisible = false;
  saveFields();
  renderFields();
}

function renderFields() {
  statsContainer.innerHTML = '';
  fields.forEach(field => {
    if (!field.isVisible) return;
    const row = document.createElement('div');
    row.classList.add('stat-row');
    row.dataset.id = field.id;

    const img = document.createElement('img');
    img.src = field.icon;
    img.alt = field.label;
    img.classList.add('stat-icon');
    img.addEventListener('contextmenu', e => {
      e.preventDefault();
      hideField(field.id);
    });

    const span = document.createElement('span');
    span.classList.add('stat-value', field.valueClass);

    row.appendChild(img);
    row.appendChild(span);
    statsContainer.appendChild(row);
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

renderer.addCallback(rawData => {
  console.log("callback hit!");
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
    distance: (state.eventDistance !== undefined)
    ? ((Number(state.eventDistance) / 1000).toFixed(1) + " km")
    : "--",
    climb:    (state.climbing    !== undefined) ? Number(state.climbing).toFixed(0) : "--",
    wbal:    "N/A"
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
