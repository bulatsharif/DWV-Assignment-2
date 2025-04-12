import pandas as pd
import requests
import time

CSV_PATH = "../data/ip_addresses.csv"
URL_TO_SEND = "http://receiver:5001/receive"

df = pd.read_csv(CSV_PATH)
df = df.sort_values(by='Timestamp', ascending=True)

intervals = []

timestamps = pd.to_datetime(df['Timestamp'])

for index in range(len(df) - 1):
    current_time = timestamps.iloc[index]
    next_time = timestamps.iloc[index + 1]
    time_difference = (next_time - current_time).total_seconds()
    intervals.append(time_difference)
    
intervals.append(0.1)    

for index in range(len(df)):
    row_dict = df.iloc[index].to_dict()
    response = requests.post(url=URL_TO_SEND, json=row_dict)
    if (response.status_code != 200):
        print(f"Error sending data: {response.status_code}")
        
    time.sleep(intervals[index])

        
        
        