FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY alembic.ini .
COPY migrations ./migrations

# Non-root: also used by the worker/migrate services, which share this
# image. /data/segmentations is pre-created here so that when Docker
# populates a fresh named volume from it, the copied directory is already
# owned by appuser (a pre-existing root-owned volume needs a one-time
# `chown -R 1000:1000` after upgrading, see docs/*/admin/deployment.md).
RUN useradd --create-home --uid 1000 --shell /usr/sbin/nologin appuser \
    && mkdir -p /data/segmentations \
    && chown -R appuser:appuser /app /data/segmentations
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/v1/health')" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
