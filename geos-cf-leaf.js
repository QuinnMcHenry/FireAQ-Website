var map = L.map('map3').setView([20, 0], 2);

// Base map
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap',
  noWrap: true
}).addTo(map);


// --- GEOS Layer ---
const geosLayer = L.esri.dynamicMapLayer({
  url: "https://fire-dev-2.gina.alaska.edu/arcgis/rest/services/GEOS_CF_Forecast/MapServer",
  opacity: 0.8,
  layers: [1]
});
geosLayer.addTo(map);

let currentGroup = "geoscf";
let geosLabels = [];
let labels = [];
let activeLayer = geosLayer;
let minLayer = 1;
let maxLayer = 15;
let lastMarker = null;
let lastCoords = null;

const slider = document.getElementById("layer-slider");
const forecastTime = document.getElementById("forecast-time");
const prevBtn = document.getElementById("prev-frame");
const nextBtn = document.getElementById("next-frame");
const playPauseBtn = document.getElementById("play-pause");

let playing = false;
let playInterval = null;

// --- Search ---
const searchInput = document.getElementById("search-input");
const button = document.getElementById("search-btn");

searchInput.addEventListener("keydown", function(event) {
  if (event.key == "Enter") {
    button.click();
  }
});

button.addEventListener("click", function () {
  document.getElementById('graph').style.display = '';
  let query = document.getElementById("search-input").value;
  fetch(`https://nominatim.openstreetmap.org/search?q=${JSON.stringify(query)}&format=json`)
    .then(response => response.json())
    .then(result => {
      if (result !== undefined && result.length > 0) {
        if (lastMarker) {
          map.removeLayer(lastMarker);
        }
        const place = result[0];
        const coords = {
          lat: parseFloat(place.lat),
          lng: parseFloat(place.lon)
        };

        // Get and display location name
        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${coords.lat}&lon=${coords.lng}&format=json`)
          .then(response => response.json())
          .then(result => {
            if (result && result.address) {
              if (result.address["town"]) {
                document.getElementById("place-title").innerText = result.address["town"];
              } else if (result.address["city"]) {
                document.getElementById("place-title").innerText = result.address["city"];
              } else if (result.address["county"] && result.address["county"] !== "Unorganized Borough") {
                document.getElementById("place-title").innerText = result.address["county"];
              } else {
                document.getElementById("place-title").innerText = result.address["state"];
              }
            }
          });

        // Move the map and set marker
        //lastMarker = L.marker(coords).addTo(map);
        map.flyTo([coords.lat, coords.lng], 7);
        lastCoords = coords;
        sessionStorage.setItem('selectedCoords', JSON.stringify(coords));

        // You can now fetch values or update UI using coords
        // Add any additional `geoscf`-specific value-fetch logic here if needed
      }
    });
});


fetch("https://fire-dev-2.gina.alaska.edu/arcgis/rest/services/GEOS_CF_Forecast/MapServer?f=json")
  .then(response => response.json())
  .then(data => {
    const geosLayersMeta = data.layers.filter(l => l.id >= 1 && l.id <= 15);
    geosLabels = geosLayersMeta.map(l => l.name);
    labels = geosLabels;

    initSlider();
    updateLayer(0);  // Show initial layer

    const startLabel = geosLabels[0].replace(/^Forecast\s*/, '').replace(/\s*AKDT$/i, '').trim();
    const endLabel = geosLabels[14].replace(/^Forecast\s*/, '').replace(/\s*AKDT$/i, '').trim();

    document.getElementById("top-banner").innerHTML = `
      GEOS forecast:<br>
      <p>${startLabel} - ${endLabel}</p>
      <br><a href="HOME.html">← Home Page</a>
    `;
  });

// Pause auto-play
function pauseSlider() {
  if (playInterval) {
    clearInterval(playInterval);
    playInterval = null;
    playing = false;
    playPauseBtn.textContent = "Play";
  }
}

// Update visible GEOS layer + UI
function updateLayer(index) {
  slider.value = index + 1;
  forecastTime.textContent = labels[index];
  activeLayer.setLayers([minLayer + index]);
  updateSliderTicks(labels);

  const geosValues = JSON.parse(sessionStorage.getItem('geosItems') || "[]");

  if (lastMarker) {
    const latlng = lastMarker.getLatLng();
    const val = geosValues[index];
    lastMarker.bindPopup(`${val} AQI<br><span style='font-size:11px;color:#666'>${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}</span>`).openPopup();
  }
}

// Slider tick rendering
function updateSliderTicks(labels) {
  const tickContainer = document.getElementById('slider-ticks');
  tickContainer.innerHTML = '';
  labels.forEach((label, i) => {
    const tick = document.createElement('span');
    tick.textContent = customTickLabel(i, label);
    tickContainer.appendChild(tick);
  });
}

function customTickLabel(idx, label) {
  const match = label.match(/Forecast (\d{2}):(\d{2}) (\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return label;
  console.log(match)

  const hour = parseInt(match[1], 10);
  const minute = match[2];
  const month = match[3], day = match[4]; // MM/DD

  if (idx === 0 && hour === 12) return `[${month}/${day}]`;
  if (hour === 0) return `[${month}/${day}]`;
  return `${hour}:${minute}`;
}


// Initialize slider + events
function initSlider() {
  slider.min = 1;
  slider.max = labels.length;
  slider.value = 1;
  updateSliderTicks(labels);

  slider.addEventListener("input", function () {
    updateLayer(this.value - 1);
    pauseSlider();
  });

  prevBtn.addEventListener("click", function () {
    let idx = parseInt(slider.value, 10) - 2;
    if (idx < 0) idx = labels.length - 1;
    updateLayer(idx);
    pauseSlider();
  });

  nextBtn.addEventListener("click", function () {
    let idx = parseInt(slider.value, 10);
    if (idx >= labels.length) idx = 0;
    updateLayer(idx);
    pauseSlider();
  });

  playPauseBtn.addEventListener("click", function () {
    playing = !playing;
    playPauseBtn.textContent = playing ? "Pause" : "Play";
    if (playing) {
      playInterval = setInterval(() => {
        let idx = parseInt(slider.value, 10);
        if (idx >= labels.length) idx = 0;
        updateLayer(idx);
      }, 700);
    } else {
      pauseSlider();
    }
  });
}

// Legend
const legend = L.control({ position: 'bottomright' });
legend.onAdd = function () {
  const div = L.DomUtil.create('div', 'legend');
  div.innerHTML = getGeosLegend();
  return div;
};
legend.addTo(map);

function getGeosLegend() {
  return `
    <div class="legend-header">
      <span>Air Quality</span>
      <button class="legend-toggle" onclick="toggleLegend(this); event.stopPropagation();">−</button>
    </div>
    <div class="legend-body">
      <i style="background:#38a801"></i> Good (0-12)<br>
      <i style="background:#ffff00"></i> Moderate (12-35)<br>
      <i style="background:#ffaa01"></i> Sensitive (35-55)<br>
      <i style="background:#fc3c34"></i> Unhealthy (55-150)<br>
      <i style="background:#9900fa"></i> Very Unhealthy (150-250)<br>
      <i style="background:#4a1f21"></i> Hazardous (250+)<br>
    </div>`;
}

function toggleLegend(btn) {
  const body = btn.closest('.legend').querySelector('.legend-body');
  const visible = body.style.display !== 'none';
  body.style.display = visible ? 'none' : '';
  btn.textContent = visible ? '+' : '−';
}
