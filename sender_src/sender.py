import pandas as pd # import the pandas for csv 
import requests # import requests for sending the data
import time # needed to send the information accordingly to the dataset

CSV_PATH = "../data/ip_addresses.csv"  # path to the csv file
URL_TO_SEND = "http://receiver:5001/receive" # path to the backend receiver
# here it is receiver and not localhost, since it is in the docker container

# read the csv file
df = pd.read_csv(CSV_PATH)
# sort the values by the timestamp, so that it will be chronically in correct order
df = df.sort_values(by='Timestamp', ascending=True)
# rename the column since there is space which is not good
df = df.rename(columns = {"ip address": "ip"})

# intervals, calculated as the difference between neighbouring timestamps, so that to send packets in the preserved time interval
intervals = []

# convert the timestamp to datetime format
timestamps = pd.to_datetime(df['Timestamp'])

# calculate the time difference between the timestamps and populating the intervals array
for index in range(len(df) - 1):
    current_time = timestamps.iloc[index]
    next_time = timestamps.iloc[index + 1]
    time_difference = (next_time - current_time).total_seconds()
    intervals.append(time_difference)
    
# since there is no pair for last message, just add some value for it
intervals.append(0.1)    

# send the data to the backend flask with correct time intervals 
for index in range(len(df)):
    row_dict = df.iloc[index].to_dict()
    response = requests.post(url=URL_TO_SEND, json=row_dict)
    if (response.status_code != 200):
        print(f"Error sending data: {response.status_code}")
    time.sleep(intervals[index])

        
        
        