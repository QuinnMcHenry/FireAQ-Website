var map = L.map('map2').setView([64.774125, -151.875], 3);
map.setMaxBounds(map.getBounds());

// Base map layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap',
  minZoom: 3
}).addTo(map);

// Color helper
function getColor(pm) {
  if (pm <= 12) return 'green';
  if (pm <= 35) return 'yellow';
  if (pm <= 55) return 'orange';
  if (pm <= 150) return 'red';
  if (pm <= 250) return 'purple';
  return 'brown';
}

const purpleMarkers = [];

// Fetch PurpleAir sensor data
fetch("./GREENING/PurpleAir_Obs/merged/converted.json")
  .then(response => response.json())
  .then(data => {
    const seen = new Set();
    let firstValidTimestamp = null;

    data.forEach(sensor => {
      const key = sensor.SiteName;
      const pm = Number(sensor["AveragePM2.5"]);
      const sensorIndex = sensor["sensor_index"];

      if (!seen.has(key) && !isNaN(pm)) {
        seen.add(key);

        if (!firstValidTimestamp) {
          const dt = new Date(sensor.time_stamp);
          const utcString = dt.toUTCString();
          document.getElementById('last-updated').textContent = "Last updated: " + utcString;
          firstValidTimestamp = dt
        }

        const color = getColor(pm);
        const icon = L.divIcon({
          className: '',
          html: `<div style="
            width:18px;
            height:18px;
            background:${color};
            border:2px solid #222;
            border-radius:3px;
            box-sizing:border-box;
            opacity:0.85;"></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9]
        });

        const marker = L.marker([sensor.Latitude, sensor.Longitude], { icon }).addTo(map);
purpleMarkers.push(marker);

// Build the popup container once
const widgetID = `PurpleAirWidget_${sensorIndex}_module_US_EPA_AQI_conversion_C0_average_10_layer_US_EPA_AQI`;
const container = document.createElement('div');
container.id = widgetID;
container.style.width = '240px';
container.style.maxHeight = '280px';
container.style.overflowY = 'auto';
container.style.overflowX = 'hidden';
container.style.padding = '4px';
container.textContent = `Loading PurpleAir Widget for ${sensor.SiteName}...`;

// Bind the popup once
const popup = L.popup({
  autoPan: true,
  autoPanPadding: [20, 50],
  maxWidth: 280,
  className: 'custom-popup'
}).setContent(container);

marker.bindPopup(popup);

// Handle marker click
marker.on('click', function () {
  // Reopen the existing popup
  marker.openPopup();

  // Sidebar indicator
  document.getElementById('pm25-indicator').innerHTML =
    `Selected: <span style="
      background:${color};
      color:black;
      font-weight:bold;
      padding: 4px 8px;
      border: 1px solid black;
      border-radius: 4px;
      display: inline-block;
    ">${key}</span>`;

  // Load widget script once
  const existingScript = document.querySelector(`script[src*="${widgetID}"]`);
  if (!existingScript) {
    const script = document.createElement('script');
    script.src = `https://www.purpleair.com/pa.widget.js?key=2MGTD3LZB2FURLZK&module=US_EPA_AQI&conversion=C0&average=10&layer=US_EPA_AQI&container=${widgetID}`;
    document.body.appendChild(script);
  }
});


      }
    });

    // Load NEW circle markers from another dataset
    fetch("./GREENING/DEC_Obs/merged/converted_DEC.json")
      .then(response => {
        if (!response.ok) throw new Error("New dataset not found.");
        return response.json();
      })
      .then(newData => {
        newData.forEach(entry => {
          const pm = Number(entry.FinalValue);
          if (!isNaN(pm)) {
            const color = getColor(pm);

            const circle = L.circleMarker([entry.Latitude, entry.Longitude], {
              radius: 15,
              fillColor: color,
              color: "#000",
              weight: 1,
              opacity: 0.75,
              fillOpacity: 0.85
            }).addTo(map);

            circle.bindPopup(
              `<b>${entry.SiteName}</b><br>PM2.5: ${pm.toFixed(2)}<br>DEC DATA`
            );

            circle.on('click', function () {
              document.getElementById('pm25-indicator').innerHTML =
                `Selected: <span style="
                  background:${color};
                  color:black;
                  font-weight:bold;
                  padding: 4px 8px;
                  border: 1px solid black;
                  border-radius: 4px;
                  display: inline-block;
                ">${pm.toFixed(2)}</span>`;
            });
          }
        });
      })
      .catch(err => {
        console.warn("New data fetch failed:", err.message);
      });

    // Toggle visibility of PurpleAir markers
    document.getElementById('toggle-dec-only').addEventListener('change', function () {
      const showOnlyDEC = this.checked;
      purpleMarkers.forEach(marker => {
        if (showOnlyDEC) {
          map.removeLayer(marker);
        } else {
          marker.addTo(map);
        }
      });
    });
  });
