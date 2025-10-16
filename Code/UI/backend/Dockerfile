# Use an official lightweight Python image
FROM python:3.11-slim

# Set work directory inside the container
WORKDIR /app

# Copy dependency list
COPY requirements.txt .

# Install dependencies efficiently
RUN pip install --no-cache-dir -r requirements.txt

# Copy your backend code
COPY . .

# Expose FastAPI port
EXPOSE 8000

# Set environment variables (optional defaults)
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

# Start FastAPI (with uvicorn)
CMD ["uvicorn", "api_server:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
