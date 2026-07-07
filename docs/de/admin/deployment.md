# Deployment-Leitfaden

Vollständige Radiolyze-Installation — von der Servervorbereitung bis zum laufenden, verifizierten System.
Lesen Sie zuerst [Systemanforderungen](index.md#systemanforderungen).

---

## Voraussetzungen

### Software

| Komponente | Mindestversion | Installation |
|---|---|---|
| Docker Engine | 24.x | [docs.docker.com/engine/install](https://docs.docker.com/engine/install/) |
| Docker Compose Plugin | v2.x | Bei Docker Desktop inklusive; Linux: `sudo apt install docker-compose-plugin` |
| Git | Aktuell | `sudo apt install git` |

Prüfen:

```bash
docker --version
docker compose version
git --version
```

### Ports

| Port | Dienst | Offen für |
|---|---|---|
| 5173 | Frontend UI (Dev) oder 80/443 (Prod) | Client-Workstations |
| 8000 | Backend API | Nur intern (Frontend) |
| 8042 | Orthanc DICOMweb / UI | Modalitäten, Admin-Workstations |
| 4242 | DICOM C-STORE (Orthanc) | Modalitäten |
| 5432 | PostgreSQL | Nur intern |
| 6379 | Redis | Nur intern |

---

## Schritt 1: Repository klonen

```bash
git clone https://github.com/radiolyze/radiolyze.git
cd radiolyze
```

---

## Schritt 2: Umgebung konfigurieren

```bash
cp env.example .env
```

`.env` mit Ihren Einstellungen bearbeiten:

```bash
# Für MedGemma erforderlich (auf huggingface.co beziehen)
HUGGINGFACE_HUB_TOKEN=hf_xxxxxxxxxxxxxxxx

# In Produktion ändern!
VITE_DICOM_WEB_USERNAME=ihr_orthanc_benutzer
VITE_DICOM_WEB_PASSWORD=ihr_starkes_passwort

# Für Docker-Deployments diese Werte belassen:
VITE_API_PROXY_TARGET=http://backend:8000
VITE_DICOM_WEB_PROXY_TARGET=http://orthanc:8042
```

---

## Schritt 3: Deployment-Modus wählen

=== "Nur CPU (Evaluation)"
    ```bash
    docker compose up --build -d
    ```

=== "NVIDIA GPU"
    ```bash
    sudo ./scripts/setup-nvidia-docker.sh

    docker compose \
      -f docker-compose.yml \
      -f docker/compose/gpu.yml \
      --profile gpu \
      up --build -d
    ```

=== "AMD ROCm"
    ```bash
    DOCKER_BUILDKIT=1 docker build -f docker/Dockerfile.rocm -t vllm-rocm .

    docker compose \
      -f docker-compose.yml \
      -f docker/compose/gpu.yml \
      -f docker/compose/rocm.yml \
      --profile rocm \
      up --build -d
    ```

=== "Mit Whisper ASR"
    ```bash
    docker compose \
      -f docker-compose.yml \
      -f docker/compose/whisper.yml \
      up --build -d
    ```

---

## Schritt 4: Dienste verifizieren

60–120 Sekunden warten, dann prüfen:

```bash
docker compose ps

curl http://localhost:8000/api/v1/health
curl -u orthanc:orthanc http://localhost:8042/api/system
```

---

## Schritt 5: DICOM-Daten prüfen

```bash
curl -s -u orthanc:orthanc http://localhost:8042/studies \
  | python3 -c "import sys,json; print(len(json.load(sys.stdin)), 'Studien')"
```

---

## Schritt 6: Anwendung öffnen

`http://localhost:5173` (oder Serverhostname) im Browser öffnen.

---

## Produktions-Checkliste

- [ ] **TLS / HTTPS** — TLS an NGINX oder anderem Reverse Proxy terminieren (siehe unten oder das [TLS-Overlay](#https-hinzufugen-nginx-reverse-proxy))
- [ ] **Orthanc-Zugangsdaten geändert** — Standard `orthanc/orthanc` ersetzen
- [ ] **PostgreSQL-Zugangsdaten geändert** — starke Passwörter in `.env`
- [ ] **JWT-Secrets gesetzt** — zufällige Secrets für Token-Signierung generieren
- [ ] **Firewall-Regeln angewendet** — nur 80/443 für Clients; 5432, 6379, 8000 intern
- [ ] **Backup konfiguriert** — siehe [Backup und Recovery](backup-recovery.md)
- [ ] **Monitoring eingerichtet** — siehe [Observability-Leitfaden](../operations/observability.md)
- [ ] **Security-Hardening abgeschlossen** — siehe [Security-Hardening](security-hardening.md)

---

## HTTPS hinzufügen (NGINX Reverse Proxy)

### Option A: das eingebaute TLS-Overlay (empfohlen)

`docker/compose/tls.yml` fügt einen `reverse-proxy`-Dienst (NGINX) hinzu,
der HTTPS auf 443 terminiert, 80 → 443 weiterleitet, HSTS sendet und alles
an den `frontend`-Dienst weiterreicht:

```bash
mkdir -p certs
# Zertifikat hier ablegen als certs/fullchain.pem + certs/privkey.pem
# (Certbot/Let's Encrypt, oder die PKI der eigenen Institution für
# abgeschottete Krankenhausnetze — dort ist Certbots automatische
# HTTP-01-Challenge nicht angebracht).

echo "NGINX_SERVER_NAME=radiolyze.ihrkrankenhaus.de" >> .env
echo "ENABLE_HSTS=true" >> .env

docker compose -f docker-compose.yml -f docker/compose/tls.yml up --build -d
```

Die vollständige Liste der `TLS_*`-Variablen (Zertifikatspfade,
Zertifikatsverzeichnis) steht in `env.example`. Die NGINX-Konfiguration des
Overlays liegt in `docker/nginx-tls.conf.template` und wird beim
Container-Start gerendert — siehe die Kommentare in dieser Datei, falls
Anpassungen nötig sind (z. B. um stattdessen auf das Produktions-Image
`docker/Dockerfile.frontend` auf Port 8080 statt auf den Vite-Dev-Server
auf 5173 zu zeigen).

### Option B: ein externer Reverse Proxy

Wer NGINX lieber außerhalb von Docker betreibt (z. B. eine bestehende
Host-Installation, die weitere Dienste verwaltet), zeigt stattdessen auf
die exponierten Ports des Stacks:

```nginx
server {
    listen 80;
    server_name radiolyze.ihrkrankenhaus.de;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name radiolyze.ihrkrankenhaus.de;

    ssl_certificate     /etc/ssl/certs/radiolyze.crt;
    ssl_certificate_key /etc/ssl/private/radiolyze.key;
    ssl_protocols       TLSv1.2 TLSv1.3;

    add_header Strict-Transport-Security "max-age=31536000" always;

    # Frontend (Dev-Server proxied /api und /dicom-web selbst — siehe vite.config.ts)
    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

In beiden Fällen: [Certbot](https://certbot.eff.org/) für kostenlose
Let's-Encrypt-Zertifikate nutzen (für abgeschottete Krankenhausnetze
ungeeignet — dort die PKI der eigenen Institution verwenden).

---

## Aktualisieren

```bash
git pull origin main
docker compose up --build -d
docker compose ps
curl http://localhost:8000/api/v1/health
```

**Update von einem Deployment vor der Container-Härtung:** Die Backend-,
Worker- und Segmenter-Images laufen jetzt als Non-Root-Benutzer `appuser`
(UID 1000) statt als root. Wurden die Named Volumes `seg-data` (und bei
GPU-Segmenter-Deployments `totalseg-models`) mit einer älteren Version
dieser Images angelegt, gehören sie noch root — nach dem Pull der neuen
Images einmalig die Berechtigungen korrigieren, bevor die Container
gestartet werden:

```bash
docker compose run --rm --user root backend chown -R 1000:1000 /data/segmentations
# nur bei GPU-Segmenter:
docker compose -f docker-compose.yml -f docker/compose/gpu.yml run --rm --user root segmenter chown -R 1000:1000 /models
```

Frisch angelegte Volumes bei einer Neuinstallation benötigen diesen Schritt
nicht — sie werden automatisch mit den richtigen Berechtigungen angelegt.

---

## Fehlerbehebung Erstinstallation

```bash
# Logs eines Dienstes anzeigen
docker compose logs --tail=50 backend

# Port-Konflikte prüfen
sudo lsof -i :5173

# Keine Studien in der Arbeitsliste
docker compose logs backend | grep -i seed
docker compose restart backend

# GPU nicht erkannt
```
Siehe [GPU-Setup](gpu-setup.md#fehlerbehebung).
