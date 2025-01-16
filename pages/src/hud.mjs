import * as common from '/pages/src/common.mjs';

// Grab references
const hudContent = document.getElementById('hud-content');
const resizeHandle = document.querySelector('.resize-handle');
const statsContainer = document.getElementById('stats-container');
const tmpl = document.getElementById('stats-template');
const scaleSlider = document.getElementById('scale-slider');

let USER = 0;
const renderer = new common.Renderer(hudContent, {fps: 1});

/* 
  1) Resizing bounding box in real px,
     so items can reflow horizontally/vertically via flex-wrap.
*/
let startX, startY, originalWidth, originalHeight;

resizeHandle.addEventListener('mousedown', (e) => {
  e.preventDefault();
  startX = e.clientX;
  startY = e.clientY;
  originalWidth = hudContent.offsetWidth;
  originalHeight = hudContent.offsetHeight;

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
});

function onMouseMove(e) {
  const dx = e.clientX - startX;
  const dy = e.clientY - startY;

  const newWidth  = Math.max(100, originalWidth + dx);
  const newHeight = Math.max(50,  originalHeight + dy);

  hudContent.style.width  = newWidth + 'px';
  hudContent.style.height = newHeight + 'px';
}

function onMouseUp() {
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup', onMouseUp);
}

/*
  2) A slider to scale the text/icons inside #stats-container
     (keeping box dimension for layout).
*/
scaleSlider.addEventListener('input', e => {
  const scaleFactor = parseFloat(e.target.value);
  // Adjust the container’s font-size based on the slider
  statsContainer.style.fontSize = (24 * scaleFactor) + 'px';
});

function renderDataFields(stats) {
    // Clear old content
    statsContainer.innerHTML = '';

    // Clone the <template>'s content
    const view = tmpl.content.cloneNode(true);

    // Populate each stat
    view.querySelector('.cadence-value').textContent = stats.cadence ?? "—";
    view.querySelector('.draft-value').textContent   = stats.draft   ?? "—";
    view.querySelector('.hr-value').textContent      = stats.hr      ?? "—";
    view.querySelector('.power-value').textContent   = stats.power   ?? "—";
    view.querySelector('.wkg-value').textContent     = stats.wkg     ?? "—";
    view.querySelector('.speed-value').textContent   = stats.speed   ?? "—";
    view.querySelector('.wbal-value').textContent    = stats.wBal    ?? "—";
    view.querySelector('.time-value').textContent    = stats.time    ?? "—";

    // Append the cloned layout into #hud-content
    statsContainer.appendChild(view);
}

renderer.addCallback(data => {
    console.log("callback hit!")
    if (!data) return;
  
    const renderData = {
        cadence: 90,
        draft: 65,
        hr: 150,
        power: 230,
        wkg: 3.00,
        speed: 38.2,
        wBal: "20.0 kj",
        time: "00:00:00"
    };

    const athlete = data.athlete || {};
    const stats   = data.stats   || {};
    const state   = data.state   || {};
    
    // Convert or safely fallback to 0
    const numericPower  = Number(state.power  ?? 0);
    const numericWeight = Number(athlete.weight ?? 0);
    
    // We'll treat wBal as joules. If stats.wBal is 20,000 (joules), then
    // in kilojoules it should be 20.0 kj once truncated.
    const numericWBal = Number(stats.wBal ?? -1); // -1 means "no valid data"
    
    /* ---------- BASIC STATS ---------- */
    const cadence = (state.cadence !== undefined)
      ? Number(state.cadence).toFixed(0)
      : "N/A";
    
    const draft = (state.draft !== undefined)
      ? Number(state.draft).toFixed(0)
      : "N/A";
    
    const hr = (state.heartrate !== undefined && state.heartrate !== 0)
      ? Number(state.heartrate).toFixed(0)
      : "--";
    
    // Power as an integer
    const power = (numericPower || numericPower === 0)
      ? numericPower.toFixed(0)
      : "N/A";
    
    // Speed to 1 decimal, fallback "N/A"
    const speed = (state.speed !== undefined)
      ? Number(state.speed).toFixed(1)
      : "N/A";
    
    /* ---------- W/KG ---------- */
    const wkg = (numericWeight > 0)
      ? (numericPower / numericWeight).toFixed(2)
      : "N/A";

    const time = (state.time !== undefined)
        ? formatTime(Number(state.time).toFixed(0))
        : "--"

    /* ---------- WATT BALANCE (KJ) ---------- */
    let wBal = "N/A";
    
    // Only compute if numericWBal >= 0
    if (numericWBal >= 0) {
      // Convert from joules to kilojoules
      const kj = numericWBal / 1000;  
      // Truncate to 1 decimal place
      const truncatedVal = Math.floor(kj * 10) / 10; 
      // Format as "20.0 kj" (no rounding)
      wBal = truncatedVal.toFixed(1) + " kj";
    }
    
    renderData.cadence = cadence;
    renderData.draft = draft;
    renderData.hr = hr;
    renderData.power = power;
    renderData.wkg = wkg;
    renderData.speed = speed;
    renderData.wBal = wBal;
    renderData.time = time;

    renderDataFields(renderData);

});
  
function formatTime(secondsString) {
    // Ensure it's a string
    if (typeof secondsString !== "string") {
      return "--";
    }
  
    // Parse integer
    const totalSeconds = parseInt(secondsString, 10);
    // If parse fails or result is NaN, fallback
    if (Number.isNaN(totalSeconds)) {
      return "--";
    }
  
    // Compute hours, minutes, seconds
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
  
    // Format hours (can be single digit or more)
    const hh = String(hours);
    // Minutes and seconds should be zero-padded to 2 digits
    const mm = String(minutes).padStart(2, "0");
    const ss = String(secs).padStart(2, "0");
  
    return `${hh}:${mm}:${ss}`;
}

async function main() {

    common.subscribe('athlete/watching', async data => {
        if (data.athleteId != USER){
            USER         = data.athleteId;
            console.log("Switched to ",USER);
        }

        renderer.setData(data);
        renderer.render();
    });

    addEventListener('resize', () => {
        renderer.render({force: true});
    });
    renderer.render();
}
main();
