# Content-Based Recommendation Service Dockerfile
FROM python:3.11-slim

LABEL maintainer="TeamUp CB Service"
LABEL description="Content-Based Recommendation Service"

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY src/ ./src/

# Create non-root user
RUN useradd -m -u 1000 cbuser && \
    chown -R cbuser:cbuser /app

USER cbuser

# Expose port
EXPOSE 5001

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:5001/health || exit 1

# Run FastAPI app with uvicorn
CMD ["uvicorn", "src.api:app", "--host", "0.0.0.0", "--port", "5001", "--workers", "2"]

