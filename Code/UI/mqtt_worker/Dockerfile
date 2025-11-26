FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create non-root user
# RUN useradd -m workeruser
# USER workeruser

# # Optional: healthcheck
# HEALTHCHECK CMD python healthcheck.py || exit 1

CMD ["python", "worker.py"]
