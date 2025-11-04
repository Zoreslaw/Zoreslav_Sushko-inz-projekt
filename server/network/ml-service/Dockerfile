# ML Service Dockerfile - Python + PyTorch + Flask
FROM python:3.11-slim

LABEL maintainer="TeamUp ML Service"
LABEL description="Two-Tower V6 Recommendation Model Service"

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY ml-service/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY ml-service/app.py .
COPY models/ ./models/
COPY data/ ./data/
COPY recommendation/ ./recommendation/

# Create non-root user
RUN useradd -m -u 1000 mluser && \
    chown -R mluser:mluser /app

USER mluser

# Expose port
EXPOSE 5000

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Run Flask app with gunicorn for production
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "4", "--threads", "2", "--timeout", "60", "--access-logfile", "-", "--error-logfile", "-", "app:app"]

