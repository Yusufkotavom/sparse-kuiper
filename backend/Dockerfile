# Gunakan image Python resmi yang ringan
FROM python:3.11-slim

# Set working directory di dalam container
WORKDIR /app

# Install system dependencies yang dibutuhkan untuk Playwright dan library lainnya
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    software-properties-common \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    librandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements.txt terlebih dahulu untuk memanfaatkan caching Docker layer
COPY requirements.txt .

# Install dependencies Python
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers (chromium & firefox sesuai config)
RUN playwright install chromium firefox --with-deps

# Copy seluruh kode backend ke dalam container
COPY . .

# Expose port yang digunakan FastAPI
EXPOSE 8000

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV APP_ENV=production

# Jalankan aplikasi menggunakan uvicorn dengan --reload untuk testing lokal
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
