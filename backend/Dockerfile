FROM python:3.11-slim

WORKDIR /app

# Build tools needed to compile CmdStan
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install CmdStan binary (prophet 1.1.5 backend — baked into image at build time)
RUN python -c "import cmdstanpy; cmdstanpy.install_cmdstan(progress=False)"

COPY . .

EXPOSE 8000

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]
