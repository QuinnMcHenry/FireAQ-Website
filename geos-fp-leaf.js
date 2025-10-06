var map = L.map('map2').setView([20, 0], 2);
// add a tile layer to the map (OpenStreetMap)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap',
    noWrap: true
}).addTo(map);

let geosLabels = [], labels = [];
let currentGroup = "geosfp";
let minLayer = 1;
let maxLayer = 14;
let activeLayer = null;
let lastMarker = null;
let lastCoords = null;

var legend = L.control({ position: 'bottomright' });

function getGeosLegend() {
  return `
  <div class="legend-header">
    <span>Air Quality</span>
    <button class="legend-toggle" type="button" onclick="toggleLegend(this); event.stopPropagation();">−</button>
    </div>
    <div class="legend-body">
    <i style="background:#FFFFFF"></i> <span>Good (0-12)</span><br>
    <i style="background:#ffff00"></i> <span>Moderate (12-35)</span><br>
    <i style="background:#ffaa01"></i> <span>Unhealthy for Sensitive Groups (35-55)</span><br>
    <i style="background:#fc3c34"></i> <span>Unhealthy (55-150)</span><br>
    <i style="background:#9900fa"></i> <span>Very Unhealthy (150-250)</span><br>
    <i style="background:#4a1f21"></i> <span>Hazardous (250+)</span><br>
  </div>
    `;
}

function getAQCategory(value) {
  if (value < 12) return {text: "Good", color: "#38a801"};
  if (value < 35) return {text: "Moderate", color: "#ffff00"};
  if (value < 55) return {text: "Unhealthy for Sensitive Groups", color: "#ffaa01"};
  if (value < 150) return {text: "Unhealthy", color: "#fc3c34"};
  if (value < 250) return {text: "Very Unhealthy", color: "#9900fa"};
  return {text: "Hazardous", color: "#4a1f21"};
}

function toggleLegend(btn) {
  const legend = btn.closest('.legend');
  const body = legend.querySelector('.legend-body');
  if (body.style.display === "none") {
    body.style.display = "";
    btn.textContent = "−";
  } else {
    body.style.display = "none";
    btn.textContent = "+";
  }
}

legend.onAdd = function (map) {
  var div = L.DomUtil.create('div', 'legend');
  div.innerHTML = getGeosLegend();
  return div;
};

legend.addTo(map);

function customTickLabel(idx, label) {
  // label: e.g. "Forecast 08:00 06/12/2025 AKDT"
  const match = label.match(/Forecast (\d{2}):(\d{2}) (\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return label;
  const hour = parseInt(match[1], 10);
  const minute = match[2];
  const day = match[3];
  const month = match[4];

  // First tick (8am) gets date
  if (idx === 0 && hour === 8) {
    return `8:30am (${day}/${month})`;
  }
  // Every 2am gets date
  if (hour === 2) {
    return `2:30am (${day}/${month})`;
  }
  if (hour === 8) {
    return '8:30am';
  }
  if (hour === 14) {
    return '2:30pm';
  }
  if (hour === 20) {
    return '8:30pm';
  }
  return `${hour}:${minute}`;
}

function extractDayMonth(label) {
  const match = label.match(/(\d{2})\/(\d{2})\/\d{4}/);
  if (match) {
    return `${match[2]}/${match[1]}`;
  }
  return "";
}

function updateSliderTicks(labels) {
  const tickContainer = document.getElementById('slider-ticks');
  tickContainer.innerHTML = '';
  labels.forEach((label, i) => {
    const tickText = customTickLabel(i, label);
    const tick = document.createElement('span');
    tick.textContent = tickText;
    tickContainer.appendChild(tick);
  });
}

function drawGraph(pmValues, visValues, currentGroup, sliderIdx = 0) {
  const yValues = currentGroup === "pm25"
    ? pmValues.map(Number)
    : visValues.map(v => Number(v) / 1609.34);

  const label = currentGroup === "pm25" ? "PM2.5 (µg/m³)" : "Visibility";
  const lineColor = currentGroup === "pm25" ? '#1f77b4' : '#ff7f0e';

  // Use simple numeric x-values to ensure even spacing
  const xVals = labels.map((_, i) => i); // [0, 1, 2, ...]
  const tickLabels = labels.map((l, i) => customTickLabel(i, l)); // readable labels

  const trace = {
    x: xVals,
    y: yValues,
    type: 'scatter',
    mode: 'lines+markers',
    name: label,
    line: {
      color: lineColor,
      width: 3
    },
    marker: {
      size: 6,
      symbol: 'circle',
      color: lineColor
    }
  };

  const verticalLine = {
    type: 'line',
    xref: 'x',
    x0: sliderIdx,
    x1: sliderIdx,
    yref: 'paper',
    y0: 0,
    y1: 1,
    line: {
      color: 'red',
      width: 2,
      dash: 'dot'
    }
  };

  const layout = {
    title: {
      text: `${label} Forecast`,
      font: { size: 18 }
    },
    margin: { l: 50, r: 30, t: 40, b: 80 },
    xaxis: {
      tickmode: 'array',
      tickvals: xVals,
      ticktext: tickLabels,
      tickfont: { size: 10 },
      tickangle: 45
    },
    yaxis: {
      title: label,
      showgrid: true,
      gridcolor: '#e5ecf6',
      zeroline: false
    },
    plot_bgcolor: '#f9f9f9',
    paper_bgcolor: '#f9f9f9',
    shapes: [verticalLine]
  };

  Plotly.newPlot('graph', [trace], layout, { displayModeBar: false });
}


// Layer definition: Only GEOS-FP
const geosLayer = L.esri.dynamicMapLayer({
  url: "https://fire-dev-2.gina.alaska.edu/arcgis/rest/services/GEOS_FP_Global_Air_Quality_Forecast/MapServer",
  opacity: 0.6,
  layers: [1]
});

// Add only the GEOS-FP layer by default
geosLayer.addTo(map);
activeLayer = geosLayer;

// Fetch layer metadata and initialize everything
fetch("https://fire-dev-2.gina.alaska.edu/arcgis/rest/services/GEOS_FP_Global_Air_Quality_Forecast/MapServer?f=json")
  .then(response => response.json())
  .then(data => {
    // get layer names for GEOS-FP
    const geosLayersMeta = data.layers.filter(l => l.id >= 1 && l.id <= 14);
    geosLabels = geosLayersMeta.map(l => l.name);
    const startLabel = geosLabels[0].replace(/^Forecast\s*/, '').replace(/\s*AKDT$/i, '').trim();
    const endLabel = geosLabels[13].replace(/^Forecast\s*/, '').replace(/\s*AKDT$/i, '').trim();
    document.getElementById("top-banner").innerHTML = `GEOS forecast: <br> <p>${startLabel} - ${endLabel} </p> <br> <a href="HOME.html">← Home Page</a>`

    // Set defaults for GEOS-FP
    currentGroup = "geosfp";
    labels = geosLabels;
    minLayer = 1;
    maxLayer = 14;
    activeLayer = geosLayer;
    updateSliderTicks(labels);

    // UI elements
    const slider = document.getElementById("layer-slider");
    const forecastTime = document.getElementById("forecast-time");
    const prevBtn = document.getElementById("prev-frame");
    const nextBtn = document.getElementById("next-frame");
    const playPauseBtn = document.getElementById("play-pause");

    // Fetch initial pixel values for the map center and draw the graph
    const center = map.getCenter();
    const geometry = {
      spatialReference: { latestWkid: 4326 },
      x: center.lng,
      y: center.lat
    };

    // --- Slider and Button Events ---
    let playing = false;
    let playInterval = null;

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
        }, 900);
      } else {
        clearInterval(playInterval);
      }
    });

    // --- Helper Functions ---
    function updateLayer(index) {
      slider.value = index + 1;
      forecastTime.innerHTML = labels[index];
      activeLayer.setLayers([minLayer + index]);
      updateSliderTicks(labels);

      const geosValues = JSON.parse(sessionStorage.getItem('geosItems') || "[]");
      drawGraph(geosValues, index);

      // AQ indicator
      document.getElementById("aq-indicator-info").innerText = "Air Quality (48 hours):";
      const avgGeos = geosValues.reduce((sum, v) => sum + Number(v), 0) / geosValues.length;
      const cat = getAQCategory(avgGeos);
      document.getElementById("aq-indicator").innerHTML =
        `<span style="background:${cat.color};padding:6px 16px;border-radius:6px;">${cat.text}</span>`;

      // --- Update marker popup value on slider change ---
      if (lastMarker) {
        const latlng = lastMarker.getLatLng();
        let goodVal = geosValues[index];
        lastMarker.bindPopup(
          goodVal + " AQI" +
          "<br><span style='font-size:11px;color:#666'>" +
          latlng.lat.toFixed(4) + ", " + latlng.lng.toFixed(4) +
          "</span>"
        ).openPopup();
      }
    }

    function pauseSlider() {
      if (playInterval) {
        clearInterval(playInterval);
        playInterval = null;
        playing = false;
        document.getElementById('play-pause').innerHTML = "Play"
      }
    }

    // --- Search ---
    const searchInput = document.getElementById("search-input");
    const button = document.getElementById("search-btn");
    searchInput.addEventListener("keydown", function(event) {
      if (event.key == "Enter") {
        button.click();
      }
    });
    button.addEventListener("click", function() {
      document.getElementById('graph').style.display = '';
      let query = document.getElementById("search-input").value;
      fetch(`https://nominatim.openstreetmap.org/search?q=${JSON.stringify(query)}&format=json`)
      .then(response => response.json())
      .then(result => {
        if (result != undefined) {
          if (lastMarker) {
            map.removeLayer(lastMarker);
          }
          const place = result[0];
          const coords = {
            lat: parseFloat(place.lat),
            lng: parseFloat(place.lon)
          };

          fetch(`https://nominatim.openstreetmap.org/reverse?lat=${coords.lat}&lon=${coords.lng}&format=json`)
            .then(response => response.json())
            .then(result => {
              if (result != undefined) {
                if (result.address["town"] != undefined) {
                  document.getElementById("place-title").innerText = result.address["town"];
                } else if (result.address["city"] != undefined) {
                  document.getElementById("place-title").innerText = result.address["city"];
                } else if (result.address["county"] != undefined && result.address["county"] != "Unorganized Borough") {
                  document.getElementById("place-title").innerText = result.address["county"];
                } else {
                  document.getElementById("place-title").innerText = result.address["state"];
                }
              }
            });
          lastMarker = L.marker(coords).addTo(map);
          map.flyTo([coords.lat, coords.lng], 7)
          lastCoords = coords;
          sessionStorage.setItem('selectedCoords', JSON.stringify(coords));

          const geometry = {
            spatialReference: { latestWkid: 4326 },
            x: coords.lng,
            y: coords.lat
          };

          const url = "https://fire-dev-2.gina.alaska.edu/arcgis/rest/services/image_service_SMOKE_VIS/MosaicDateset_VIS_SMOKE/ImageServer/identify" +
            "?geometry=" + encodeURIComponent(JSON.stringify(geometry)) +
            "&geometryType=esriGeometryPoint" +
            "&returnPixelValues=true" +
            "&processAsMultidimensional=true" +
            "&f=json";

          fetch(url)
            .then(response => response.json())
            .then(result => {
              if (result.value !== undefined) {
                const values = result.value.split(";").map(v => v.trim());
                const geosValues = values.slice(0, 8);
                sessionStorage.setItem('geosItems', JSON.stringify(geosValues));
                const sliderIdx = parseInt(slider.value, 10) - 1;
                drawGraph(geosValues, sliderIdx);

                // AQ indicator
                document.getElementById("aq-indicator-info").innerText = "Air Quality (48 hours):";
                const avgGeos = geosValues.reduce((sum, v) => sum + Number(v), 0) / geosValues.length;
                const cat = getAQCategory(avgGeos);
                document.getElementById("aq-indicator").innerHTML =
                  `<span style="background:${cat.color};padding:6px 16px;border-radius:6px;">${cat.text}</span>`;

                // Marker popup
                if (lastMarker) {
                  const latlng = lastMarker.getLatLng();
                  let goodVal = geosValues[sliderIdx];
                  lastMarker.bindPopup(
                    goodVal + " AQI" +
                    "<br><span style='font-size:11px;color:#666'>" +
                    latlng.lat.toFixed(4) + ", " + latlng.lng.toFixed(4) +
                    "</span>"
                  ).openPopup();
                }
              }
            });
        }
      })
    });
  });
