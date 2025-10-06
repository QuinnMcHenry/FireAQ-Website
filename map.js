var map = L.map('map').setView([64.774125, -151.875], 3);
map.setMaxBounds(map.getBounds());

// add a tile layer to the map (OpenStreetMap)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap',
    minZoom: 3
}).addTo(map);

let visLabels = [], pmLabels = [], geosLabels = [], labels = [];
let currentGroup = "pm25";
let minLayer = 10;
let maxLayer = 17;
let activeLayer = null;
let lastMarker = null;
let lastCoords = null;

var legend = L.control({ position: 'bottomright' });
function getVisLegendHTML() {
  return `
  <div class="legend-header">
      <span>Visibility</span>
      <button class="legend-toggle" type="button" onclick="toggleLegend(this); event.stopPropagation();">−</button>
    </div>
    <div class="legend-body">
    <i style="background:#fc3c34"></i> <span>Less than 1 mile</span><br>
    <i style="background:#ffaa01"></i> <span>1-2 miles</span><br>
    <i style="background:#ffff00"></i> <span>2-3 miles</span><br>
    <i style="background:#56ff00"></i> <span>3-6 miles</span><br>
    <i style="background:#38a801"></i> <span>Over 6 miles</span><br>
    </div>
    `;
}



function getPmLegendHTML() {
  return `
  <div class="legend-header">
    <span>PM2.5</span>
    <button class="legend-toggle" type="button" onclick="toggleLegend(this); event.stopPropagation();">−</button>
    </div>
    <div class="legend-body">
    <i style="background:#ffffff"></i> <span>0-1 µg/m³</span><br>
    <i style="background:#d0e1f2"></i> <span>1-2 µg/m³</span><br>
    <i style="background:#94c4df"></i> <span>2-4 µg/m³</span><br>
    <i style="background:#4a98c9"></i> <span>4-6 µg/m³</span><br>
    <i style="background:#1665ab"></i> <span>6-8 µg/m³</span><br>
    <i style="background:#108446"></i> <span>8-12 µg/m³</span><br>
    <i style="background:#53b45f"></i> <span>12-16 µg/m³</span><br>
    <i style="background:#a2d86a"></i> <span>16-20 µg/m³</span><br>
    <i style="background:#fff6b0"></i> <span>20-25 µg/m³</span><br>
    <i style="background:#fcaa5f"></i> <span>25-30 µg/m³</span><br>
    <i style="background:#f7844e"></i> <span>30-40 µg/m³</span><br>
    <i style="background:#ed5f3b"></i> <span>40-60 µg/m³</span><br>
    <i style="background:#c21d27"></i> <span>60-100 µg/m³</span><br>
    <i style="background:#a50026"></i> <span>100-200 µg/m³</span><br>
    <i style="background:#9900fa"></i> <span>200+ µg/m³</span><br>
    </div>
    `;
}

function getGeosLegend() {
  return `
  <div class="legend-header">
    <span>Air Quality</span>
    <button class="legend-toggle" type="button" onclick="toggleLegend(this); event.stopPropagation();">−</button>
    </div>
    <div class="legend-body">
    <i style="background:#38a801"></i> <span>Good (0-12)</span><br>
    <i style="background:#ffff00"></i> <span>Moderate (12-35)</span><br>
    <i style="background:#ffaa01"></i> <span>Unhealthy for Sensitive Groups (35-55)</span><br>
    <i style="background:#fc3c34"></i> <span>Unhealthy (55-150)</span><br>
    <i style="background:#9900fa"></i> <span>Very Unhealthy (150-250)</span><br>
    <i style="background:#4a1f21"></i> <span>Hazardous (250+)</span><br>
  </div>
    `;
}


function getAQCategory(value, group) {
  if (group === "pm25") {
    if (value < 1) return {text: "Excellent", color: "#ffffff"};
    if (value < 2) return {text: "Good", color: "#d0e1f2"};
    if (value < 4) return {text: "Fair", color: "#94c4df"};
    if (value < 6) return {text: "Moderate", color: "#4a98c9"};
    if (value < 8) return {text: "Moderate-High", color: "#1665ab"};
    if (value < 12) return {text: "High", color: "#108446"};
    if (value < 16) return {text: "Very High", color: "#53b45f"};
    if (value < 20) return {text: "Unhealthy", color: "#a2d86a"};
    if (value < 25) return {text: "Unhealthy", color: "#fff6b0"};
    if (value < 30) return {text: "Very Unhealthy", color: "#fcaa5f"};
    if (value < 40) return {text: "Hazardous", color: "#f7844e"};
    if (value < 60) return {text: "Hazardous", color: "#ed5f3b"};
    if (value < 100) return {text: "Extremely Hazardous", color: "#c21d27"};
    if (value < 200) return {text: "Extremely Hazardous", color: "#a50026"};
    return {text: "Extreme", color: "#9900fa"};
  } else { // visibility
    if (value < 1609) return {text: "Very Poor", color: "#fc3c34"};
    if (value < 3218) return {text: "Poor", color: "#ffaa01"};
    if (value < 4827) return {text: "Moderate", color: "#ffff00"};
    if (value < 9654) return {text: "Good", color: "#56ff00"};
    return {text: "Excellent", color: "#38a801"};
  }
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
  div.innerHTML = getPmLegendHTML(); // Default to pm2.5
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
    return `8am (${day}/${month})`;
  }
  // Every 2am gets date
  if (hour === 2) {
    return `2am (${day}/${month})`;
  }
  if (hour === 8) {
    return '8am';
  }
  if (hour === 14) {
    return '2pm';
  }
  if (hour === 20) {
    return '8pm';
  }
  return `${hour}:${minute}`;
}

function updateLegend(group) {
  const legendDiv = document.querySelector('.legend');
  if (group === "vis") {
    legendDiv.innerHTML = getVisLegendHTML()
  } else if (group === "pm25") {
    legendDiv.innerHTML = getPmLegendHTML()
  } else {
    legendDiv.innerHTML = getGeosLegend()
  }
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


// Layer definitions
const visLayer = L.esri.dynamicMapLayer({
  url: "https://fire-dev-2.gina.alaska.edu/arcgis/rest/services/HRRR_Smoke_Forecast/MapServer",
  opacity: 0.6,
  layers: [1]
});
const pmLayer = L.esri.dynamicMapLayer({
  url: "https://fire-dev-2.gina.alaska.edu/arcgis/rest/services/HRRR_Smoke_Forecast/MapServer",
  opacity: 1.0,
  layers: [10]
});
const geosLayer = L.esri.dynamicMapLayer({
  url: "https://fire-dev-2.gina.alaska.edu/arcgis/rest/services/GEOS_FP_Air_Quality_Forecast/MapServer",
  opacity: 0.6,
  layers: [1]
});

// Add only the PM2.5 layer by default
pmLayer.addTo(map);
activeLayer = pmLayer;

// Fetch layer metadata and initialize everything
fetch("https://fire-dev-2.gina.alaska.edu/arcgis/rest/services/HRRR_Smoke_Forecast/MapServer?f=json")
  .then(response => response.json())
  .then(data => {
    // get layer names for both groups
    const visLayersMeta = data.layers.filter(l => l.id >= 1 && l.id <= 8);
    const pmLayersMeta = data.layers.filter(l => l.id >= 10 && l.id <= 17);
    const geosLayersMeta = data.layers.filter(l => l.id >= 1 && l.id <= 8);
    visLabels = visLayersMeta.map(l => l.name);
    pmLabels = pmLayersMeta.map(l => l.name);
    geosLabels = geosLayersMeta.map(l => l.name);

    // Set defaults for PM2.5
    currentGroup = "pm25";
    labels = pmLabels;
    minLayer = 10;
    maxLayer = 17;
    activeLayer = pmLayer;
    updateSliderTicks(labels);

    // UI elements
    const slider = document.getElementById("layer-slider");
    const forecastTime = document.getElementById("forecast-time");
    const prevBtn = document.getElementById("prev-frame");
    const nextBtn = document.getElementById("next-frame");
    const playPauseBtn = document.getElementById("play-pause");
    const mobileNextframe = document.getElementById("mobile-next-frame");
    const mobilePrevFrame = document.getElementById("mobile-prev-frame");
    const mobilePlayPause = document.getElementById("mobile-play-pause");
    const groupRadios = document.getElementsByName("layer-group");
    updateLayer(0);

    // Fetch initial pixel values for the map center and draw the graph
    const center = map.getCenter();
    const geometry = {
      spatialReference: { latestWkid: 4326 },
      x: center.lng,
      y: center.lat
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
          const pmValues = values.slice(0, 8);
          const visValues = values.slice(8, 16);
          sessionStorage.setItem('pmItems', JSON.stringify(pmValues));
          sessionStorage.setItem('visItems', JSON.stringify(visValues));
          drawGraph(pmValues, visValues, currentGroup, 0);
        }
      });

    // --- Event Listeners and Map Clicks ---
    map.on("click", function (event) {
      document.getElementById("aq-indicator-map").style.display = 'flex';
      document.getElementById('graph').style.display = '';
      
      
      if (lastMarker) {
        map.removeLayer(lastMarker);
      }
      if (currentGroup === "geosfp") {
        return;
      }
      lastMarker = L.marker(event.latlng).addTo(map);
      lastCoords = event.latlng;
      sessionStorage.setItem('selectedCoords', JSON.stringify(event.latlng));

      lastMarker.on('popupclose', function() {
        map.removeLayer(lastMarker);
        lastMarker = null;
      });

      const geometry = {
        spatialReference: { latestWkid: 4326 },
        x: event.latlng.lng,
        y: event.latlng.lat
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
            const pmValues = values.slice(0, 8)
            const visValues = values.slice(8, 16)
            sessionStorage.setItem('pmItems', JSON.stringify(pmValues));
            sessionStorage.setItem('visItems', JSON.stringify(visValues));
if (currentGroup === "vis") {
  document.getElementById("aq-indicator-info").innerText = "Visibility (48 hours):";
  const avgVis = visValues.reduce((sum, v) => sum + Number(v), 0) / visValues.length;
  const cat = getAQCategory(avgVis, currentGroup);
  document.getElementById("aq-indicator").innerHTML =
    `<span style="background:${cat.color};padding:6px 16px;border-radius:6px;">${cat.text}</span>`;
} else if (currentGroup === "pm25") {
  document.getElementById("aq-indicator-info").innerText = "PM2.5 Level (48 hours):";
  const avgPm = pmValues.reduce((sum, v) => sum + Number(v), 0) / pmValues.length;
  const cat = getAQCategory(avgPm, currentGroup);
  document.getElementById("aq-indicator").innerHTML =
    `<span style="background:${cat.color};padding:6px 16px;border-radius:6px;">${cat.text}</span>`;
}
            const sliderIdx = parseInt(slider.value, 10) - 1;
            drawGraph(pmValues, visValues, currentGroup, sliderIdx)
            const sliderNum = parseInt(slider.value);

            console.log("result: " + result.value)
            console.log("currentGroup: " + currentGroup)
            console.log(event.latlng)
            console.log("slider pos: " +parseInt(slider.value))
            console.log(values)
            console.log("vis values: " + visValues)
            console.log("pm values: " + pmValues)

            let goodVal = "";
            if (currentGroup === "pm25" ) {
              goodVal = pmValues[sliderNum - 1];
              const latlng = lastMarker.getLatLng();
              if (goodVal >= 0.01) {
              lastMarker.bindPopup(
                goodVal + "µg/m³" +
                "<br><span style='font-size:11px;color:#666'>" +
                latlng.lat.toFixed(4) + ", " + latlng.lng.toFixed(4) +
                "</span>"
              ).openPopup();
            } else {
              lastMarker.bindPopup(
                "< 0.01" + "µg/m³" +
                "<br><span style='font-size:11px;color:#666'>" +
                latlng.lat.toFixed(4) + ", " + latlng.lng.toFixed(4) +
                "</span>"
              ).openPopup();
            }
              console.log(goodVal);
            } else {
              goodVal = visValues[sliderNum - 1];
              let mileMeter = goodVal / 1609;
              const latlng = lastMarker.getLatLng();
              if (mileMeter >= 1) {
                lastMarker.bindPopup(
                  mileMeter.toFixed(2) + " miles" +
                  "<br><span style='font-size:11px;color:#666'>" +
                  latlng.lat.toFixed(4) + ", " + latlng.lng.toFixed(4) +
                  "</span>"
                ).openPopup();
              } else {
                lastMarker.bindPopup(
                  goodVal + " meters" +
                  "<br><span style='font-size:11px;color:#666'>" +
                  latlng.lat.toFixed(4) + ", " + latlng.lng.toFixed(4) +
                  "</span>"
                ).openPopup();
              }
            }

          } else {
            lastMarker.bindPopup(
              "Pixel value: " + result.properties.value +
              "<br><span style='font-size:11px;color:#666'>" +
              lastMarker.getLatLng().lat.toFixed(4) + ", " + lastMarker.getLatLng().lng.toFixed(4) +
              "</span>"
            ).openPopup();

          }
           
        })
        .catch(() => {
          lastMarker.bindPopup(
            "No pixel value found" +
            "<br><span style='font-size:11px;color:#666'>" +
            lastMarker.getLatLng().lat.toFixed(4) + ", " + lastMarker.getLatLng().lng.toFixed(4) +
            "</span>"
          ).openPopup();
        });



        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${event.latlng["lat"]}&lon=${event.latlng["lng"]}&format=json`)
          .then(response => response.json())
          .then(result => {
            if (result != undefined) {
              console.log(result)
              if (result.address["town"] != undefined) {
              document.getElementById("place-title").innerText = result.address["town"]
            } else if (result.address["city"] != undefined) {
                document.getElementById("place-title").innerText = result.address["city"]
                } else if (result.address["county"] != undefined && result.address["county"] != "Unorganized Borough") {
                  document.getElementById("place-title").innerText = result.address["county"];
                  } else {
                    document.getElementById("place-title").innerText = result.address["state"];
                  }
            }
          })

    
    });



    // --- Group Radio Buttons ---
    groupRadios.forEach(radio => {
      radio.addEventListener("change", function () {
        if (this.checked) {
          currentGroup = this.value;
          sessionStorage.setItem("currentGroup", JSON.stringify(currentGroup));
          switchGroup(currentGroup);
        }
      });
    });

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
        }, 1000);
      } else {
        clearInterval(playInterval);
      }
    });


document.getElementById('mobile-prev-frame').onclick = function() {
  document.getElementById('prev-frame').click();
};
document.getElementById('mobile-play-pause').onclick = function() {
  document.getElementById('play-pause').click();
};
document.getElementById('mobile-next-frame').onclick = function() {
  document.getElementById('next-frame').click();
};


    // --- Helper Functions ---
    function updateLayer(index) {
  slider.value = index + 1;
  forecastTime.innerHTML = labels[index];
  const startLabel = labels[0].replace(/^Forecast\s*/, '').replace(/\s*AKDT$/i, '').trim();
  const endLabel = labels[7].replace(/^Forecast\s*/, '').replace(/\s*AKDT$/i, '').trim();
  document.getElementById("top-banner").innerHTML = `HRRR forecast: <br> <p>${startLabel} - ${endLabel} </p> <br> <a href="HOME.html">← Home Page</a>`
  activeLayer.setLayers([minLayer + index]);
  updateSliderTicks(labels);
  const pmValues = JSON.parse(sessionStorage.getItem('pmItems') || "[]");
  const visValues = JSON.parse(sessionStorage.getItem('visItems') || "[]");
  drawGraph(pmValues, visValues, currentGroup, index);
  if (currentGroup === "vis") {
  document.getElementById("aq-indicator-info").innerText = "Visibility (48 hours):";
  const avgVis = visValues.reduce((sum, v) => sum + Number(v), 0) / visValues.length;
  const cat = getAQCategory(avgVis, currentGroup);
  document.getElementById("aq-indicator").innerHTML =
    `<span style="background:${cat.color};padding:6px 16px;border-radius:6px;">${cat.text}</span>`;
} else if (currentGroup === "pm25") {
  document.getElementById("aq-indicator-info").innerText = "PM2.5 Level (48 hours):";
  const avgPm = pmValues.reduce((sum, v) => sum + Number(v), 0) / pmValues.length;
  const cat = getAQCategory(avgPm, currentGroup);
  document.getElementById("aq-indicator").innerHTML =
    `<span style="background:${cat.color};padding:6px 16px;border-radius:6px;">${cat.text}</span>`;
}

  // --- Update marker popup value on slider change ---
  if (lastMarker) {
    const latlng = lastMarker.getLatLng();
    let goodVal = "";
    if (currentGroup === "pm25") {
      goodVal = pmValues[index];
      if (goodVal >= 0.01) {
      lastMarker.bindPopup(
        goodVal + "µg/m³" +
        "<br><span style='font-size:11px;color:#666'>" +
        latlng.lat.toFixed(4) + ", " + latlng.lng.toFixed(4) +
        "</span>"
      ).openPopup();
    } else {
      lastMarker.bindPopup(
        "< 0.01" + "µg/m³" +
        "<br><span style='font-size:11px;color:#666'>" +
        latlng.lat.toFixed(4) + ", " + latlng.lng.toFixed(4) +
        "</span>"
      ).openPopup();
    }
    } else if (currentGroup === "vis") {
      goodVal = visValues[index];
      let mileMeter = goodVal / 1609;
      if (mileMeter >= 1) {
        lastMarker.bindPopup(
          mileMeter.toFixed(2) + " miles" +
          "<br><span style='font-size:11px;color:#666'>" +
          latlng.lat.toFixed(4) + ", " + latlng.lng.toFixed(4) +
          "</span>"
        ).openPopup();
      } else {
        lastMarker.bindPopup(
          goodVal + " meters" +
          "<br><span style='font-size:11px;color:#666'>" +
          latlng.lat.toFixed(4) + ", " + latlng.lng.toFixed(4) +
          "</span>"
        ).openPopup();
      }
    }
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

    function switchGroup(group) {
      map.removeLayer(visLayer);
      map.removeLayer(pmLayer);
      map.removeLayer(geosLayer);

      if (group === "vis") {
        activeLayer = visLayer;
        labels = visLabels;
        updateSliderTicks(labels);
        minLayer = 1;
        maxLayer = 8;
        visLayer.addTo(map);
      } else if (group === "pm25") {
        activeLayer = pmLayer;
        labels = pmLabels;
        updateSliderTicks(labels);
        minLayer = 10;
        maxLayer = 17;
        pmLayer.addTo(map);
      } else {
        map.removeLayer(lastMarker);
        activeLayer = geosLayer;
        labels = geosLabels;
        updateSliderTicks(labels);
        minLayer = 1;
        maxLayer = 8;
        geosLayer.addTo(map);
      }
      slider.min = 1;
      slider.max = labels.length;
      let idx = parseInt(slider.value, 10) - 1;
      if (isNaN(idx) || idx < 0 || idx >= labels.length) idx = 0;
      updateLayer(idx);
      updateLegend(group);
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
      document.getElementById("aq-indicator-map").style.display = 'flex';
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
          if (currentGroup != "geosfp") {
            lastMarker = L.marker(coords).addTo(map);
            
          }
          map.flyTo([coords.lat, coords.lng], 7)
          lastCoords = coords;
          sessionStorage.setItem('selectedCoords', JSON.stringify(coords));

          lastMarker.on('popupclose', function() {
        map.removeLayer(lastMarker);
        lastMarker = null;
      });
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
                const pmValues = values.slice(0, 8)
                const visValues = values.slice(8, 16)
                sessionStorage.setItem('pmItems', JSON.stringify(pmValues));
                sessionStorage.setItem('visItems', JSON.stringify(visValues));
if (currentGroup === "vis") {
  document.getElementById("aq-indicator-info").innerText = "Visibility (48 hours):";
  const avgVis = visValues.reduce((sum, v) => sum + Number(v), 0) / visValues.length;
  const cat = getAQCategory(avgVis, currentGroup);
  document.getElementById("aq-indicator").innerHTML =
    `<span style="background:${cat.color};padding:6px 16px;border-radius:6px;">${cat.text}</span>`;
} else if (currentGroup === "pm25") {
  document.getElementById("aq-indicator-info").innerText = "PM2.5 Level (48 hours):";
  const avgPm = pmValues.reduce((sum, v) => sum + Number(v), 0) / pmValues.length;
  const cat = getAQCategory(avgPm, currentGroup);
  document.getElementById("aq-indicator").innerHTML =
    `<span style="background:${cat.color};padding:6px 16px;border-radius:6px;">${cat.text}</span>`;
}
                const sliderIdx = parseInt(slider.value, 10) - 1;
                drawGraph(pmValues, visValues, currentGroup, sliderIdx);

                // --- Add this popup logic ---
                const sliderNum = parseInt(slider.value);
                let goodVal = "";
                if (lastMarker) {
                  const latlng = lastMarker.getLatLng();
                  if (currentGroup === "pm25") {
                    goodVal = pmValues[sliderNum - 1];
                    if (goodVal >= 0.01) {
                    lastMarker.bindPopup(
                      goodVal + "µg/m³" +
                      "<br><span style='font-size:11px;color:#666'>" +
                      latlng.lat.toFixed(4) + ", " + latlng.lng.toFixed(4) +
                      "</span>"
                    ).openPopup();
                  } else {
                    lastMarker.bindPopup(
                      "< 0.01" + "µg/m³" +
                      "<br><span style='font-size:11px;color:#666'>" +
                      latlng.lat.toFixed(4) + ", " + latlng.lng.toFixed(4) +
                      "</span>"
                    ).openPopup();
                  }
                  } else {
                    goodVal = visValues[sliderNum - 1];
                    let mileMeter = goodVal / 1609;
                    if (mileMeter >= 1) {
                      lastMarker.bindPopup(
                        mileMeter.toFixed(2) + " miles" +
                        "<br><span style='font-size:11px;color:#666'>" +
                        latlng.lat.toFixed(4) + ", " + latlng.lng.toFixed(4) +
                        "</span>"
                      ).openPopup();
                    } else {
                      lastMarker.bindPopup(
                        goodVal + " meters" +
                        "<br><span style='font-size:11px;color:#666'>" +
                        latlng.lat.toFixed(4) + ", " + latlng.lng.toFixed(4) +
                        "</span>"
                      ).openPopup();
                    }
                  }
                }
              }
            });
        }
      })
    });
  });