FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential libgl1 libglib2.0-0 libxrender1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /service

COPY requirements.txt /service/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY app /service/app

# Non-root. /data/segmentations is pre-created here so that when Docker
# populates a fresh named volume from it, the copied directory is already
# owned by appuser (a pre-existing root-owned volume needs a one-time
# `chown -R 1000:1000` after upgrading, see docs/*/admin/deployment.md).
RUN useradd --create-home --uid 1000 --shell /usr/sbin/nologin appuser \
    && mkdir -p /data/segmentations \
    && chown -R appuser:appuser /service /data/segmentations
USER appuser

EXPOSE 8200

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8200/health')" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8200"]
