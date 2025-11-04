# syntax=docker/dockerfile:1.6
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    procps \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY ml-admin/requirements.txt .

# Install Python dependencies with BuildKit cache
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-cache-dir -r requirements.txt

# Copy API code
COPY ml-admin/api.py .

# Copy training script (for manual triggering)
COPY ml-training/train_from_db.py .

# Copy network modules (needed for training)
COPY network/ /app/network/

EXPOSE 6000

CMD ["python", "api.py"]



