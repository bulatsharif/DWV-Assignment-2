FROM python:3.11-slim

WORKDIR /proj

COPY . .

RUN pip install --no-cache-dir -r requirements.txt

EXPOSE 5001

CMD ["python", "receiver.py"]