import os
import requests
import glob
import pandas as pd
from datetime import datetime, timedelta
import json

import json
import math

def remove_nan_fields_from_json_file(input_path, output_path):
    with open(input_path, 'r') as infile:
        data = json.load(infile)
    
    def clean(obj):
        if isinstance(obj, dict):
            return {k: clean(v) for k, v in obj.items() if not (isinstance(v, float) and math.isnan(v))}
        elif isinstance(obj, list):
            return [clean(item) for item in obj]
        return obj

    cleaned_data = clean(data)

    with open(output_path, 'w') as outfile:
        json.dump(cleaned_data, outfile, indent=2)

#define the API downloading
def new_download_DEC_PM25(FromDateRaw,ToDateRaw,dir_DEC_raw):
    StationsRaw_list = [42,10,1,20,8,17]
    # sheetname_list = ["A Street (Fairbanks)","Butte (Mat-Su)", "Garden (Anch.)",\
    #                  "Hurst Road (North Pole)","Floyd Dryden","NCORE (Fairbanks)"]
    # sitename_list = ["A Street","Butte","Floyd Dryden","Garden",\
    #                  "Hurst Road","Laurel","Ncore","Parkgate"]
    # filename_list = ["A_Street","Butte","Floyd_Dryden","Garden",\
    #                  "Hurst_Road","Laurel","Ncore","Parkgate"]
    sitename_list = ["A Street","Garden",\
                     "Hurst Road","Ncore"]
    filename_list = ["A_Street","Garden",\
                     "Hurst_Road","Ncore"]

    base_url='https://dec.alaska.gov/Applications/air/AirVision/api/averagedata'
    my_headers = {'apikey' : '81DB3CCB-7448-434F-9F9B-C572FE283160','Accept':'text/csv',\
                  'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) \
                  AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36'}

    for isite in range(0,len(filename_list)):
        # parameters
        sitename=sitename_list[isite]
        parameters='PM25L'
        interval='001h'
        download_url=base_url+'?sites='+sitename+'&parameters='+parameters+'&interval='+interval+'&start='+FromDateRaw+'&end='+ToDateRaw
        #url_test='https://dec.alaska.gov/Applications/air/AirVision/api/averagedata\
        #?sites=NCore&parameters=PM25L&interval=001h&start=2022-06-14T17:30:00&end=2022-06-15T13:59:59'
        response = requests.get(download_url, headers=my_headers)
        datestr = "__"+FromDateRaw+"__"+ToDateRaw
        datestr = datestr.replace(":","-")
        fname_csv = os.path.join( dir_DEC_raw, "DEC_PM25_"+filename_list[isite]+datestr+".csv" )
        os.system('rm -f '+fname_csv)
        with open(fname_csv, "w") as f:
            f.write(response.text)

        print("write to "+fname_csv)

def merge_to_1_file(FromDateRaw,ToDateRaw,dir_DEC_merge):
    datestr = "__"+FromDateRaw+"__"+ToDateRaw
    datestr = datestr.replace(":","-")
    fileslist = glob.glob(dir_DEC_raw+'*'+datestr+'*.csv')
    bigfile = []
    for file in fileslist:
        obsdata = pd.read_csv(file, index_col=None, header=0)
        bigfile.append(obsdata)

    # print(li)
    frame = pd.concat(bigfile, axis=0, ignore_index=True, sort=True)
    frame = frame.drop(columns=['RawLoggerFlags'])
    fout_csv = os.path.join( dir_DEC_merge, "DEC_Alaska_PM25"+datestr+".csv" )
    csv_data = frame.to_csv(fout_csv,columns=['SystemStandardizedDate',\
    'FinalValue','SiteName','Latitude','Longitude','AqsParameterCode'])

    with open(os.path.join(dir_DEC_merge, "converted_DEC.json"), 'w') as json_file:
        json.dump(frame.to_dict(orient='records'), json_file, indent=4)
        print("Saved merged data to {}".format(json_file))

#get today and yesterday's date in YYYY-MM-DD form
today_date=datetime.today().strftime('%Y-%m-%d')
yesterday_date=(datetime.now() - timedelta(1)).strftime('%Y-%m-%d')
FromDateRaw=yesterday_date+'T12:00:00'
ToDateRaw=today_date+'T12:00:00'
dir_DEC_raw=  './GREENING//DEC_Obs/raw/' #"./GREENING/DEC_Obs/raw/"
dir_DEC_merge= './GREENING/DEC_Obs/merged/' #""./GREENING/DEC_Obs/merged/""

#execute the downloading
new_download_DEC_PM25(FromDateRaw,ToDateRaw,dir_DEC_raw)
merge_to_1_file(FromDateRaw,ToDateRaw,dir_DEC_merge)

remove_nan_fields_from_json_file("./GREENING/DEC_Obs/merged/converted_DEC.json", "./GREENING/DEC_Obs/merged/converted_DEC.json")