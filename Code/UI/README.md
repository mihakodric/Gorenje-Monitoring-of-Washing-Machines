# Project Setup

This project uses Docker Compose to run a full-stack application with TimescaleDB, MQTT broker, backend, and React frontend.  

## Prerequisites

- Docker and Docker Compose installed on your system  
- Your machine connected to the local network (for accessing the frontend from other devices)  

---

## 1. Configure Environment Variables

The frontend requires the API URL of the backend. To make it work both on your computer and other devices in the same network, you must define the host IP in an `.env` file.

1. Create a `.env` file in the project root:

```bash
touch .env
```

2. Add the following line, replacing `YOUR_HOST_IP` with your computer’s LAN IP:

```env
HOST_IP=YOUR_HOST_IP
```

- On Linux/macOS, you can find your LAN IP with:

```bash
hostname -I | awk '{print $1}'
```

- On Windows (Command Prompt):

```cmd
ipconfig
```

---

## 2. Docker Compose Configuration

In the `docker-compose.yml`, the frontend service uses this variable:

```yaml
frontend:
  environment:
    - REACT_APP_API_URL=http://${HOST_IP}:8000
```

> Make sure `HOST_IP` in `.env` matches your local machine’s IP. This allows the frontend to connect to the backend and makes it accessible from other devices on the same network.

---

## 3. Start the Project

Run:

```bash
docker-compose up --build
```

- Frontend will be available at `http://<HOST_IP>:3000`  
- Backend will be available at `http://<HOST_IP>:8000`  

You can now access the frontend from your computer or any device on the same Wi-Fi network.

---

## 4. Notes

- If your LAN IP changes, update the `.env` file and restart the containers.  
- This setup avoids hardcoding the IP directly in the `docker-compose.yml`.  
