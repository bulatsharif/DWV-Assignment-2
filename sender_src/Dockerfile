FROM python:3.11-slim


WORKDIR /proj

COPY sender_src/ . 

COPY data/ /data/

RUN pip install --no-cache-dir -r requirements.txt

CMD ["python", "sender.py"]