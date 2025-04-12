# Traffic Visualizer

This repository contains interactive web-based visualization tool that simulates and displays web traffic originating from various global locations in real time. This repository was done as the solution for the Assignment II of Data Wrangling and Visualization course.
It consists of three major components:

1. A **Python sender** script that simulates traffic based on a provided CSV dataset.
2. A **Flask server** that receives and parses the data.
3. A **Three.js-based frontend** that displays incoming requests as animated markers on a globe with real-time analytics.

All components are fully containerized and orchestrated using Docker Compose, making the deployment process streamlined and consistent.

***Author: Bulat Sharipov, DS-01***

## Assignment Mapping

### 1. **Data Generation (Python Sender)** 

- The project includes a Python script (`sender.py`) that loads a dataset from a CSV file.
- The script calculates the time difference between each packet, so that it can preserve the time intervals between sending packets
- Packets are sent to the Flask server in **JSON format via HTTP POST** requests using the `requests` package.

**Implementation:** `sender_src/sender.py`

---

### 2. **Data Receiving (Flask Server)** 

- A Flask app (`receiver.py`) listens for incoming traffic.
- It exposes:
  - `POST /receive` to accept packet data from the sender.
  - `GET /get_data/<index>` to allow the frontend to fetch data by index.
- The server stores packets in-memory and provides them to the frontend on demand.
- CORS is handled with `flask_cors` to allow cross-origin requests from the frontend.

**Implementation:** `receiver_src/receiver.py`

---

### 3. **Visualization (Frontend with Three.js)** [50 points]

#### Location on World Map (Globe)
- A 3D globe is created using **Three.js** and rendered via WebGL.
- Globe visualization for this task was inspired by Lab 11 of this course.
- Packets are plotted as small colored dots:
  - **Green** for normal traffic
  - **Red** for suspicious packets
- The dots appear gradually, respecting the dataset's temporal ordering.
- Each dot remains visible for 10 seconds before disappearing to prevent clutter.

#### Real-Time Interactions
- **Tooltip** on hover shows IP, country, and suspicious status.
- **Live country leaderboard** shows most active traffic sources, auto-updated every second.
- **Activity graphs**:
  - One for **overall traffic**.
  - Three dedicated charts for **USA**, **Russia**, and **China**.
  - All plots are built using **Chart.js** and styled to be lightweight and transparent.

**Implementation:** `visualization/index.js`, `visualization/index.html`

---

### 4. **Deployment with Docker Compose** [15 points]

- Each component is placed in its own Docker container:
  - **Sender** (Python script)
  - **Receiver** (Flask server)
  - **Frontend** (Three.js static server)
- A `docker-compose.yml` orchestrates all services:
  - `receiver` exposes port `5001`
  - `visualization` runs a static HTTP server on `8080`
  - `sender` depends on the receiver
- With one command, the whole project is deployed and running:

```bash
docker-compose up --build
```

**Implementation:** `docker-compose.yml`, individual `Dockerfile`s

---

## Project Structure

```
.
├── sender_src/
│   ├── sender.py
│   └── Dockerfile
├── receiver_src/
│   ├── receiver.py
│   └── Dockerfile
├── visualization/
│   ├── index.html
│   ├── index.js
│   ├── lib/
│   │   └── OrbitControls.js
│   └── Dockerfile
├── data/
│   └── dataset.csv
├── docker-compose.yml
└── README.md
```

---

## How to Run

1. **Ensure Docker and Docker Compose are installed.**
2. Clone the repository and navigate into it:
   ```bash
   git clone <repo-url>
   cd traffic-visualizer
   ```
3. Start the entire project:
   ```bash
   docker-compose up --build
   ```
4. Open the frontend in your browser:
   ```
   http://localhost:8080
   ```
