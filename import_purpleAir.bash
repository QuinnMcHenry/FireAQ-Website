#!/bin/bash

archive_dir_purp=/archive/GREENING/qdmchenry/historical_purple_air/
archive_dir_dec=/archive/GREENING/qdmchenry/historical_dec/

cd /var/www/html/fireaq_repo/fireaq

echo "Starting run at $(date)"

rm -f GREENING/PurpleAir_Obs/merged/PPAir*.csv
rm -f GREENING/PurpleAir_Obs/merged/converted.json

rm -f GREENING/DEC_Obs/merged/DEC_*.csv
rm -f GREENING/DEC_Obs/merged/converted_dec.json

python -u A_auto_purp.py
python -u A_auto_dec.py

input_file_purp=$(ls GREENING/PurpleAir_Obs/merged/PPAir*.csv 2>/dev/null | head -n 1)
input_file_dec=$(ls GREENING/DEC_Obs/merged/DEC_*.csv 2>/dev/null | head -n 1)


if [ -z "$input_file_purp" ]; then
  echo "No PPAir*.csv file found in GREENING/PurpleAir_Obs/merged."
  exit 1
fi

if [ -z "$input_file_dec" ]; then
  echo "No DEC_*.csv file found in GREENING/DEC_Obs/merged."
  exit 1
fi

echo "Saving merged CSVs to chinook and clearing /raw."

scp GREENING/PurpleAir_Obs/merged/PPAir*.csv qdmchenry@chinook04.alaska.edu:/$archive_dir_purp
scp GREENING/DEC_Obs/merged/DEC_*.csv qdmchenry@chinook04.alaska.edu:/$archive_dir_dec

rm -rf GREENING/PurpleAir_Obs/raw/*
rm GREENING/PurpleAir_Obs/merged/PPAir*.csv

rm -rf GREENING/DEC_Obs/raw/*
rm GREENING/DEC_Obs/merged/DEC_*.csv

echo "Executed successfully."
