# syntax=docker/dockerfile:1.6
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY ml-training/requirements.txt .

# Install Python dependencies with BuildKit cache
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-cache-dir -r requirements.txt

# Copy training scripts
COPY ml-training/train_from_db.py .
COPY ml-training/scheduler.py .

# Copy network modules (needed for training)
COPY network/ /app/network/

# Create directories for shared data
RUN mkdir -p /shared/models /shared/logs

# Run scheduler by default
CMD ["python", "scheduler.py"]



