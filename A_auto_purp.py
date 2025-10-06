from __future__ import print_function
import requests
import os
import pandas as pd
import datetime
import numpy as np
import csv
import json
import glob
import re

# quinns key: C48C707A-4C6B-11F0-81BE-42010A80001F
# Jingqiu key: 4F15D3C5-51F3-11F0-81BE-42010A80001F

# Get today's date for filenames
today_str = datetime.datetime.today().strftime('%Y%m%d')

dir_PurpleAir_raw = './GREENING/PurpleAir_Obs/raw/'
dir_PurpleAir_merge = './GREENING/PurpleAir_Obs/merged/'

# Ensure output directories exist
if not os.path.exists(dir_PurpleAir_raw):
    os.makedirs(dir_PurpleAir_raw)
if not os.path.exists(dir_PurpleAir_merge):
    os.makedirs(dir_PurpleAir_merge)

# Get sensor metadata
my_headers = {'Content-Type':'application/json','X-API-Key' : '4F15D3C5-51F3-11F0-81BE-42010A80001F',
              'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36'}

purple_request = (
    "https://api.purpleair.com/v1/sensors"
    "?fields=name,latitude,longitude"
    "&nwlat=71.289324&nwlng=-177.912008&selat=54.730463&selng=-128.75775"
)
response = requests.get(purple_request, headers=my_headers)
p = response.json()
print(p)


Alaska_sites_details = pd.DataFrame(p['data'], columns=p['fields'])

for _, row in Alaska_sites_details.iterrows():
        if "DEC" in row['name'] or "Dec" in row['name']:
            Alaska_sites_details.drop(_, inplace=True)
print(Alaska_sites_details)

# Download the latest value for each sensor
def new_download_PurpleAir_PM25(dir_PurpleAir_raw):

    base_url = 'https://api.purpleair.com/v1/sensors/'
    for _, row in Alaska_sites_details.iterrows():
        sensor_index = row['sensor_index']
        sensor_name = re.sub(r'[^A-Za-z0-9_\-]', '_', row['name'])
        url = (
            base_url + str(sensor_index) +
            "?fields=sensor_index,name,pm2.5_atm_a,pm2.5_atm_b,humidity_a,humidity_b,latitude,longitude,last_seen"
        )
        response = requests.get(url, headers=my_headers)
        if response.status_code == 200:
            data = response.json().get("sensor", {})
            if not data:
                print("No data for sensor: {}".format(sensor_name))
                continue

            # Format time as ISO string from last_seen (epoch seconds)
            timestamp = datetime.datetime.utcfromtimestamp(data.get(" last_seen", 0)).strftime('%Y-%m-%dT%H:%M:%SZ')

            # Build a single-row CSV
            csv_headers = ['sensor_index', 'pm2.5_atm_a', 'pm2.5_atm_b', 'humidity_a', 'humidity_b', 'latitude', 'longitude', 'time_stamp']
            csv_row = [data.get('sensor_index'), data.get('pm2.5_atm_a'), data.get('pm2.5_atm_b'),
                       data.get('humidity_a'), data.get('humidity_b'), data.get('latitude'),
                       data.get('longitude'), timestamp]

            fname_csv = os.path.join(dir_PurpleAir_raw, "PPAir_PM25_{}_{}.csv".format(sensor_name, today_str))
            with open(fname_csv, "wb") as f:
                writer = csv.writer(f)
                writer.writerow(csv_headers)
                writer.writerow(csv_row)

            print("Downloaded latest data for sensor: {}".format(sensor_name))
        else:
            print("Failed to fetch data for {}, status code: {}".format(sensor_name, response.status_code))


def two_channels_processing(dir_PurpleAir_raw, dir_PurpleAir_merge):
    bigfile = []
    csv_files = glob.glob(os.path.join(dir_PurpleAir_raw, "PPAir_PM25_*_{}.csv".format(today_str)))

    for file in csv_files:
        print("Processing {}".format(file))
        fname = os.path.basename(file)
        sensor_name = fname[len("PPAir_PM25_") : -len("_{}.csv".format(today_str))]
        sensor_name = sensor_name.replace("_", " ")

        try:
            obsdata = pd.read_csv(file)
        except Exception as e:
            print("Could not read file {}, skipping. ERROR: {}".format(file, e))
            continue

        # Check that required columns are present
        required_columns = ['pm2.5_atm_a', 'pm2.5_atm_b', 'humidity_a', 'time_stamp', 'latitude', 'longitude']
        if obsdata.empty or not all(col in obsdata.columns for col in required_columns):
            print("Skipping file {} due to missing cols or empty data".format(file))
            continue

        row = obsdata.iloc[0]

        try:
            UTC_time = row['time_stamp']
            AK_time = (datetime.datetime.strptime(UTC_time, "%Y-%m-%dT%H:%M:%SZ") - datetime.timedelta(hours=8)).strftime('%Y-%m-%dT%H:%M:%SZ')
        except Exception as e:
            print("Timestamp conversion error in file {}: {}".format(file, e))
            AK_time = UTC_time

        try:
            a = float(row['pm2.5_atm_a'])
            b = float(row['pm2.5_atm_b'])
            rh = float(row['humidity_a'])
        except (ValueError, TypeError):
            print("Invalid numeric values in {}, skipping.".format(file))
            continue

        if a == 0 or b == 0 or rh == 0:
            print("Skipping file {} due to zero values".format(file))
            continue

        absolute_difference = abs(a - b)
        percent_difference = (absolute_difference * 2) / (a + b) if (a + b) != 0 else 1
        average = (a + b) / 2
        relative_humidity = rh / 100.0
        corrected_PM25 = 0.524 * average - 0.0862 * relative_humidity + 5.75

        if (absolute_difference <= 5 or percent_difference <= 0.1) and not np.isnan(corrected_PM25):
            avg_value = corrected_PM25
        else:
            avg_value = np.nan

        df_row = pd.DataFrame([{
            'sensor_index': row['sensor_index'],
            'time_stamp': AK_time,
            'AveragePM2.5': avg_value,
            'SiteName': sensor_name,
            'Latitude': row['latitude'],
            'Longitude': row['longitude']
        }])

        bigfile.append(df_row)

    # Merge and write output
    if bigfile:
        frame = pd.concat(bigfile, ignore_index=True)
        frame = frame.dropna(subset=['AveragePM2.5'])
        merged_csv = os.path.join(dir_PurpleAir_merge, "PPAir_PM25_merged_{}.csv".format(today_str))
        frame.to_csv(merged_csv, index=False)

        with open(os.path.join(dir_PurpleAir_merge, "converted.json"), 'w') as json_file:
            json.dump(frame.to_dict(orient='records'), json_file, indent=4)
        print("Saved merged data to {}".format(merged_csv))
    else:
        print("No valid data to merge.")


        

# Run the workflow
#new_download_PurpleAir_PM25(dir_PurpleAir_raw)
#two_channels_processing(dir_PurpleAir_raw, dir_PurpleAir_merge)