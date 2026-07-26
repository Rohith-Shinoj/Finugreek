FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y gcc curl && rm -rf /var/lib/apt-get/lists/*

# Copy and install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy project files
COPY backend/ ./backend
COPY datasets/ ./datasets

EXPOSE 8080

# Command to run FastAPI
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8080"]
