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

EXPOSE 8200

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8200"]
