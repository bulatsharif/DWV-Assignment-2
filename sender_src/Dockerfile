# python 3.11 slim as the base for container
FROM python:3.11-slim

# set the working directory
WORKDIR /proj

# copy the application to the working directory
COPY sender_src/ . 

# copy the dataset 
COPY data/ /data/

# install the dependencies
RUN pip install --no-cache-dir -r requirements.txt

# run the application of sender
CMD ["python", "sender.py"]